import { useEffect, useState } from 'react';
import { useAddProgress, useDeleteProgressPhoto, useDeleteProject, useGetProject, getGetDashboardQueryKey, getGetProjectQueryKey, getGetProjectsQueryKey, getGetSkeinSuggestionsQueryKey, requestProgressPhotoUpload } from '@workspace/api-client-react';
import { useAuth } from '@clerk/expo';
import { useLocalSearchParams, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormFieldLabel, LoomButton, LoomText, ProgressBar, SignedInGate, StatusChip, fonts } from '@/components/loom';
import { formatProjectDate } from '@/components/ProjectDateField';
import { StarButton } from '@/components/StarButton';
import { ProgressAmountInput, amountDraftFor, progressAmountForApi, progressDetail, type ProgressAmountDraft } from '@/components/ProgressMethod';
import { describeNeedle } from '@/components/NeedleFields';
import { describeProjectYarn } from '@/components/ProjectYarns';
import { SkeinSuggestions } from '@/components/SkeinSuggestions';
import { ProjectCounter } from '@/components/ProjectCounter';
import { useColors } from '@/hooks/useColors';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const query = useGetProject(id);
  const addProgress = useAddProgress();
  const removeProgressPhoto = useDeleteProgressPhoto();
  const remove = useDeleteProject();
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState<ProgressAmountDraft | null>(null);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingPhotoEntryId, setRemovingPhotoEntryId] = useState('');
  const project = query.data;
  const designerPageTitle = project?.designerPageTitle?.trim();
  const designerLinkLabel = project?.designerWebsite
    ? (designerPageTitle && designerPageTitle.length <= 72
      ? designerPageTitle
      : project.patternDesigner?.trim() || designerHostname(project.designerWebsite))
    : '';
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
    void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetSkeinSuggestionsQueryKey() });
  };

  const latestProgressValue = project?.progress.reduce<{ createdAt: string; progressValue: number | null } | undefined>(
    (latest, entry) => (!latest || entry.createdAt > latest.createdAt ? entry : latest), undefined,
  )?.progressValue;
  const amountDraft = amount ?? (project ? amountDraftFor(project, latestProgressValue) : null);

  const saveProgress = async () => {
    if (!project || !amountDraft) return;
    if (!notes.trim()) {
      setMessage('Add a note about this session.');
      return;
    }
    const progressAmount = progressAmountForApi(project, amountDraft);
    if (typeof progressAmount === 'string') {
      setMessage(progressAmount);
      return;
    }
    setMessage('');
    let photoPath: string | undefined;
    if (photo) {
      try {
        setPhotoUploading(true);
        const file = new File(photo.uri);
        const contentType = photo.mimeType || 'image/jpeg';
        const size = photo.fileSize ?? file.size;
        if (size > 10 * 1024 * 1024) {
          setMessage('Choose a photo smaller than 10 MB.');
          return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
          setMessage('Choose a JPEG, PNG, or WebP photo.');
          return;
        }
        const upload = await requestProgressPhotoUpload(id, {
          name: photo.fileName || 'progress-photo',
          size: Math.max(1, size),
          contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp',
        });
        const response = await expoFetch(upload.uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        });
        if (!response.ok) throw new Error('Photo upload failed.');
        photoPath = upload.photoPath;
      } catch {
        setMessage('We could not upload this photo. Please try again or remove it.');
        return;
      } finally {
        setPhotoUploading(false);
      }
    }
    addProgress.mutate({
      projectId: id,
      data: { notes: notes.trim(), ...progressAmount, ...(photoPath ? { photoPath } : {}) },
    }, {
      onSuccess: () => {
        setNotes('');
        setAmount(null);
        setPhoto(null);
        invalidate();
      },
      onError: () => setMessage('We could not save this note. Please try again.'),
    });
  };

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo library access', 'Allow access to choose a progress photo in Settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
        ]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (!result.canceled) {
        const selected = result.assets[0];
        if (selected) setPhoto(selected);
      }
    } catch {
      setMessage('We could not open your photo library. Please try again.');
    }
  };

  const deleteProject = () => {
    remove.mutate({ projectId: id }, {
      onSuccess: () => {
        invalidate();
        router.replace('/(tabs)/projects');
      },
      onError: () => setMessage('We could not delete this project. Please try again.'),
    });
  };

  const deleteEntryPhoto = (entryId: string) => {
    setMessage('');
    setRemovingPhotoEntryId(entryId);
    removeProgressPhoto.mutate({ projectId: id, entryId }, {
      onSuccess: invalidate,
      onError: () => setMessage('We could not remove this photo. Please try again.'),
      onSettled: () => setRemovingPhotoEntryId(''),
    });
  };

  return (
    <SignedInGate>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.nav, { paddingTop: insets.top + 7, borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.navButton}><Feather name="arrow-left" size={19} color={colors.primary} /></Pressable>
          <LoomText style={[styles.navTitle, { color: colors.foreground }]} numberOfLines={1}>{project?.title || 'Project journal'}</LoomText>
          {project ? <StarButton project={project} /> : null}
          {project ? <Pressable accessibilityRole="button" accessibilityLabel="Edit project" onPress={() => router.push({ pathname: '/projects/[id]/edit', params: { id } })} style={styles.navButton}><Feather name="edit-2" size={17} color={colors.primary} /></Pressable> : <View style={styles.navButton} />}
        </View>
        {query.isLoading ? <LoomText style={[styles.loading, { color: colors.mutedForeground }]}>Loading…</LoomText> : query.isError || !project ? (
          <View style={styles.center}><LoomText serif style={{ color: colors.foreground, fontSize: 26 }}>Project not found</LoomText><LoomText style={{ color: colors.mutedForeground, marginTop: 7 }}>It may have been removed or moved.</LoomText><LoomButton title="Back to projects" onPress={() => router.replace('/(tabs)/projects')} variant="secondary" style={{ marginTop: 16 }} /></View>
        ) : (
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}>
          <SkeinSuggestions projectId={project.id} />
          <View style={[styles.hero, { backgroundColor: project.craft === 'knitting' ? colors.knitWash : colors.crochetWash }]}>
              <LoomText serif style={[styles.title, { color: colors.foreground }]}>{project.title}</LoomText>
              <View style={styles.statusLine}><StatusChip status={project.status} /><LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{project.craft === 'knitting' ? 'Knitting' : 'Crochet'} · {project.completionPercent}% complete</LoomText></View>
              <ProgressBar value={project.completionPercent} />
              {progressDetail(project, latestProgressValue) ? <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15, marginTop: 9 }} testID="text-progress-detail">{progressDetail(project, latestProgressValue)}</LoomText> : null}
            </View>
            <ProjectCounter key={project.id} projectId={project.id} initial={project.counter} />
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LoomText style={[styles.sectionLabel, { color: colors.primary }]}>Details</LoomText>
              {[
                ['Pattern', project.patternName],
                ['Designer', project.designerWebsite ? designerLinkLabel : project.patternDesigner],
                [project.yarns.length > 1 ? 'Yarns' : 'Yarn', project.yarns.length
                  ? project.yarns.map((yarn) => [
                      yarn.heldTogether ? 'Held with the yarn above: ' : '',
                      describeProjectYarn(yarn),
                      yarn.skeinsUsed !== null ? ` · ${yarn.skeinsUsed} ${yarn.skeinsUsed === 1 ? 'skein' : 'skeins'} used` : '',
                    ].join('')).join('\n')
                  : project.yarn],
                ['Previous yarn note', project.yarns.length ? project.yarn : null],
                ...(project.craft === 'crochet'
                  ? [
                      ['Hook size', project.hookSize || 'Not added yet'],
                      ['Second hook', project.secondHookSize],
                    ]
                  : [
                      ['Needle', describeNeedle(project.needleSize, project.needleType, project.needleCableLength) || 'Not added yet'],
                      ['Second needle', describeNeedle(project.secondNeedleSize, project.secondNeedleType, project.secondNeedleCableLength) || null],
                    ]),
                ['Saved tools note', project.tools],
                ['Started', project.startedAt ? formatProjectDate(project.startedAt, project.startedAtPrecision) : null],
                ['Target date', project.targetDate ? formatProjectDate(project.targetDate, project.targetDatePrecision) : null],
                ['Finished on', project.completedAt ? formatProjectDate(project.completedAt, project.completedAtPrecision) : null],
              ].filter((entry) => entry[1]).map(([label, value]) => (
                <View key={label} style={[styles.infoRow, { borderBottomColor: colors.border }]}><LoomText style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</LoomText>{label === 'Designer' && project.designerWebsite ? <Pressable accessibilityRole="link" accessibilityLabel={`Open designer website: ${designerLinkLabel}`} accessibilityHint="Opens the saved designer website" onPress={() => { void Linking.openURL(project.designerWebsite!).catch(() => Alert.alert('Unable to open website', 'Check the saved link and try again.')); }} style={styles.designerLink}><LoomText numberOfLines={1} ellipsizeMode="tail" style={[styles.infoValue, styles.designerLinkText, { color: colors.primary, textDecorationLine: 'underline' }]}>{value}</LoomText></Pressable> : <LoomText numberOfLines={label === 'Designer' ? 1 : undefined} ellipsizeMode="tail" style={[styles.infoValue, { color: colors.foreground }]}>{value}</LoomText>}</View>
              ))}
              {project.description ? <LoomText style={[styles.description, { color: colors.foreground }]}>{project.description}</LoomText> : null}
            </View>
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>Add a progress note</LoomText>
              <FormFieldLabel>What did you work on?</FormFieldLabel>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Rows completed, a tricky section, a new color…" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlignVertical="top" style={[...inputStyle, styles.notesInput]} testID="input-progress-notes" />
              <FormFieldLabel>Progress photo (optional)</FormFieldLabel>
              <View style={styles.photoControls}>
                <Pressable accessibilityRole="button" onPress={pickPhoto} style={[styles.photoButton, { borderColor: colors.border }]} testID="button-pick-progress-photo">
                  <Feather name="image" size={16} color={colors.primary} />
                  <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 }}>{photo ? 'Choose another photo' : 'Choose a photo'}</LoomText>
                </Pressable>
                {photo ? <Pressable accessibilityRole="button" accessibilityLabel="Remove selected photo" onPress={() => setPhoto(null)} style={styles.removePhotoButton}><Feather name="x" size={18} color={colors.mutedForeground} /></Pressable> : null}
              </View>
              {photo ? <Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" accessibilityLabel="Selected progress photo preview" /> : null}
              {amountDraft ? <ProgressAmountInput project={project} value={amountDraft} onChange={setAmount} /> : null}
              {message ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 15, marginBottom: 11 }}>{message}</LoomText> : null}
              <LoomButton title="Save progress note" icon="feather" onPress={saveProgress} busy={addProgress.isPending || photoUploading} disabled={!notes.trim()} testID="button-save-progress" />
            </View>
            <View style={styles.sectionHeading}><LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>Progress journal</LoomText><LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{project.progress.length} notes</LoomText></View>
            {project.progress.length ? project.progress.map((entry) => (
              <View key={entry.id} style={[styles.progressEntry, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.entryMarker, { backgroundColor: colors.accent }]} />
                <View style={{ flex: 1 }}>
                  <LoomText style={[styles.entryMeta, { color: colors.primary }]}>{entry.completionPercent}% complete · {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</LoomText>
                  <LoomText style={[styles.entryNotes, { color: colors.foreground }]}>{entry.notes}</LoomText>
                  {entry.photoPath ? <>
                    <SavedProgressPhoto projectId={id} entryId={entry.id} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo from this progress entry"
                      onPress={() => deleteEntryPhoto(entry.id)}
                      disabled={removingPhotoEntryId === entry.id}
                      style={styles.removeSavedPhoto}
                      testID={`button-remove-progress-photo-${entry.id}`}
                    >
                      <Feather name="x" size={15} color={colors.destructive} />
                      <LoomText style={{ color: colors.destructive, fontFamily: fonts.semibold, fontSize: 14 }}>
                        {removingPhotoEntryId === entry.id ? 'Removing photo…' : 'Remove photo'}
                      </LoomText>
                    </Pressable>
                  </> : null}
                </View>
              </View>
            )) : <LoomText style={[styles.noNotes, { color: colors.mutedForeground }]}>No notes yet.</LoomText>}
            <View style={styles.deleteSection}>
              {confirmDelete ? (
                <View style={[styles.confirm, { backgroundColor: colors.warningWash, borderColor: colors.warningBorder }]}>
                  <LoomText style={{ color: colors.warningText, fontFamily: fonts.semibold, fontSize: 15, flex: 1 }}>Delete this project and its progress notes?</LoomText>
                  <LoomButton title="Cancel" variant="secondary" onPress={() => setConfirmDelete(false)} />
                  <LoomButton title="Delete" variant="danger" onPress={deleteProject} busy={remove.isPending} />
                </View>
              ) : <LoomButton title="Delete project" icon="trash-2" variant="quiet" onPress={() => setConfirmDelete(true)} />}
            </View>
          </ScrollView>
        )}
      </View>
    </SignedInGate>
  );
}

function designerHostname(website: string) {
  try {
    const labels = new URL(website).hostname.toLowerCase().replace(/^www\d*\./, '').split('.');
    const suffixes = new Set(['com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'uk', 'ca', 'au', 'nz', 'info', 'biz', 'dev', 'app', 'studio', 'shop', 'art']);
    const subdomains = new Set(['shop', 'store', 'blog', 'patterns']);
    const name = labels.find((label) => label && !suffixes.has(label) && !subdomains.has(label)) || labels[0];
    return name.split(/[-_]+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ') || website;
  } catch {
    return website.replace(/^[a-z]+:\/\/(?:www\.)?/i, '').split(/[/?#]/)[0] || website;
  }
}
function SavedProgressPhoto({ projectId, entryId }: { projectId: string; entryId: string }) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value ?? null);
    });
    return () => { active = false; };
  }, [getToken]);
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain || !token) return null;
  return (
    <Image
      source={{
        uri: `https://${domain}/api/projects/${projectId}/progress/${entryId}/photo`,
        headers: { Authorization: `Bearer ${token}` },
      }}
      style={styles.savedPhoto}
      contentFit="cover"
      accessibilityLabel="Photo from this progress entry"
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { minHeight: 47, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  navButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 16, fontFamily: fonts.semibold, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { paddingHorizontal: 18, paddingTop: 18, maxWidth: 740, width: '100%', alignSelf: 'center' },
  loading: { textAlign: 'center', marginTop: 55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  hero: { borderRadius: 18, padding: 19, gap: 11, overflow: 'hidden', marginBottom: 13 },
  title: { fontSize: 30, lineHeight: 36 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailCard: { borderWidth: 1, borderRadius: 16, padding: 17, marginBottom: 13 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 15, marginBottom: 12 },
  infoRow: { width: '100%', minWidth: 0, flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1 },
  infoLabel: { fontSize: 14 },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 14, fontFamily: fonts.medium },
  designerLink: { flex: 1, flexBasis: 0, minWidth: 0, overflow: 'hidden', alignItems: 'flex-end' },
  designerLinkText: { width: '100%', maxWidth: '100%', minWidth: 0, flexShrink: 1 },
  description: { marginTop: 12, lineHeight: 23, fontSize: 16 },
  sectionTitle: { fontSize: 25 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 12 },
  notesInput: { minHeight: 84, paddingTop: 12 },
  photoControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  photoButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  removePhotoButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  photoPreview: { width: '100%', height: 190, borderRadius: 12, marginBottom: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10, marginBottom: 11 },
  progressEntry: { borderWidth: 1, borderRadius: 13, padding: 13, flexDirection: 'row', gap: 10, marginBottom: 8 },
  entryMarker: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  entryMeta: { fontFamily: fonts.semibold, fontSize: 13 },
  entryNotes: { fontSize: 15, lineHeight: 22, marginTop: 5 },
  savedPhoto: { width: '100%', height: 220, borderRadius: 12, marginTop: 10, backgroundColor: '#EEF2F9' },
  removeSavedPhoto: { minHeight: 38, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 2 },
  noNotes: { fontSize: 15, paddingVertical: 15 },
  deleteSection: { alignItems: 'flex-end', marginTop: 8 },
  confirm: { borderWidth: 1, borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
});
