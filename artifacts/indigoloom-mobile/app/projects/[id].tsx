import { useEffect, useState } from 'react';
import { useAddProgress, useDeleteProgressPhoto, useDeleteProject, useGetProject, getGetDashboardQueryKey, getGetProjectQueryKey, getGetProjectsQueryKey, requestProgressPhotoUpload } from '@workspace/api-client-react';
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
  const [completion, setCompletion] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingPhotoEntryId, setRemovingPhotoEntryId] = useState('');
  const project = query.data;
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
    void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
  };

  const saveProgress = async () => {
    const percent = Number(completion);
    if (!notes.trim() || !Number.isInteger(percent) || percent < 0 || percent > 100) {
      setMessage('Add a note and a whole-number completion value between 0 and 100.');
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
      data: { notes: notes.trim(), completionPercent: percent, ...(photoPath ? { photoPath } : {}) },
    }, {
      onSuccess: () => {
        setNotes('');
        setCompletion('');
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
          {project ? <Pressable accessibilityRole="button" accessibilityLabel="Edit project" onPress={() => router.push({ pathname: '/projects/[id]/edit', params: { id } })} style={styles.navButton}><Feather name="edit-2" size={17} color={colors.primary} /></Pressable> : <View style={styles.navButton} />}
        </View>
        {query.isLoading ? <LoomText style={[styles.loading, { color: colors.mutedForeground }]}>Gathering this project’s notes…</LoomText> : query.isError || !project ? (
          <View style={styles.center}><LoomText serif style={{ color: colors.foreground, fontSize: 23 }}>Project not found</LoomText><LoomText style={{ color: colors.mutedForeground, marginTop: 7 }}>It may have been removed or moved.</LoomText><LoomButton title="Back to projects" onPress={() => router.replace('/(tabs)/projects')} variant="secondary" style={{ marginTop: 16 }} /></View>
        ) : (
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}>
          <View style={[styles.hero, { backgroundColor: project.craft === 'knitting' ? colors.knitWash : colors.crochetWash }]}>
              <LoomText style={[styles.kicker, { color: colors.mutedForeground }]}>{project.craft === 'knitting' ? 'KNITTING JOURNAL' : 'CROCHET JOURNAL'}</LoomText>
              <LoomText serif style={[styles.title, { color: colors.foreground }]}>{project.title}</LoomText>
              <View style={styles.statusLine}><StatusChip status={project.status} /><LoomText style={{ color: colors.mutedForeground, fontSize: 11 }}>{project.completionPercent}% complete</LoomText></View>
              <ProgressBar value={project.completionPercent} />
            </View>
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LoomText style={[styles.sectionLabel, { color: colors.primary }]}>THE PROJECT NOTES</LoomText>
              {[
                ['Pattern', project.patternName],
                ['Designer', project.designerWebsite ? project.designerPageTitle || project.designerWebsite : project.patternDesigner],
                ['Yarn', [project.yarnBrand, project.yarnType, project.yarnColor].filter(Boolean).join(' · ') || null],
                ['Previous yarn note', project.yarn],
                ['Tools', project.tools],
                ['Started', project.startedAt ? formatProjectDate(project.startedAt, project.startedAtPrecision) : null],
                ['Target date', project.targetDate ? formatProjectDate(project.targetDate, project.targetDatePrecision) : null],
              ].filter((entry) => entry[1]).map(([label, value]) => (
                <View key={label} style={[styles.infoRow, { borderBottomColor: colors.border }]}><LoomText style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</LoomText>{label === 'Designer' && project.designerWebsite ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(project.designerWebsite!).catch(() => Alert.alert('Unable to open website', 'Check the saved link and try again.')); }}><LoomText style={[styles.infoValue, { color: colors.primary, textDecorationLine: 'underline' }]}>{value}</LoomText></Pressable> : <LoomText style={[styles.infoValue, { color: colors.foreground }]}>{value}</LoomText>}</View>
              ))}
              {project.description ? <LoomText style={[styles.description, { color: colors.foreground }]}>{project.description}</LoomText> : null}
            </View>
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>Leave a progress note</LoomText>
              <LoomText style={[styles.help, { color: colors.mutedForeground }]}>A few words after a session. Your progress adds up, quietly.</LoomText>
              <FormFieldLabel>What changed today?</FormFieldLabel>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Rows completed, a tricky section, a new color…" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlignVertical="top" style={[...inputStyle, styles.notesInput]} testID="input-progress-notes" />
              <FormFieldLabel>Progress photo (optional)</FormFieldLabel>
              <View style={styles.photoControls}>
                <Pressable accessibilityRole="button" onPress={pickPhoto} style={[styles.photoButton, { borderColor: colors.border }]} testID="button-pick-progress-photo">
                  <Feather name="image" size={16} color={colors.primary} />
                  <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 12 }}>{photo ? 'Choose another photo' : 'Choose a photo'}</LoomText>
                </Pressable>
                {photo ? <Pressable accessibilityRole="button" accessibilityLabel="Remove selected photo" onPress={() => setPhoto(null)} style={styles.removePhotoButton}><Feather name="x" size={18} color={colors.mutedForeground} /></Pressable> : null}
              </View>
              {photo ? <Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" accessibilityLabel="Selected progress photo preview" /> : null}
              <FormFieldLabel>Completion (0–100%)</FormFieldLabel>
              <TextInput value={completion || String(project.completionPercent)} onChangeText={setCompletion} placeholder="0–100" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" style={inputStyle} testID="input-progress-percent" />
              {message ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 12, marginBottom: 11 }}>{message}</LoomText> : null}
              <LoomButton title="Save progress note" icon="feather" onPress={saveProgress} busy={addProgress.isPending || photoUploading} disabled={!notes.trim()} testID="button-save-progress" />
            </View>
            <View style={styles.sectionHeading}><LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>The journey so far</LoomText><LoomText style={{ color: colors.mutedForeground, fontSize: 11 }}>{project.progress.length} notes</LoomText></View>
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
                      <LoomText style={{ color: colors.destructive, fontFamily: fonts.semibold, fontSize: 11 }}>
                        {removingPhotoEntryId === entry.id ? 'Removing photo…' : 'Remove photo'}
                      </LoomText>
                    </Pressable>
                  </> : null}
                </View>
              </View>
            )) : <LoomText style={[styles.noNotes, { color: colors.mutedForeground }]}>No notes yet. Add one after your next making session.</LoomText>}
            <View style={styles.deleteSection}>
              {confirmDelete ? (
                <View style={[styles.confirm, { backgroundColor: colors.warningWash, borderColor: colors.warningBorder }]}>
                  <LoomText style={{ color: colors.warningText, fontFamily: fonts.semibold, fontSize: 12, flex: 1 }}>Delete this project and its progress notes?</LoomText>
                  <LoomButton title="Keep it" variant="secondary" onPress={() => setConfirmDelete(false)} />
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
  navTitle: { fontSize: 13, fontFamily: fonts.semibold, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { paddingHorizontal: 18, paddingTop: 18, maxWidth: 740, width: '100%', alignSelf: 'center' },
  loading: { textAlign: 'center', marginTop: 55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  hero: { borderRadius: 18, padding: 19, gap: 11, overflow: 'hidden', marginBottom: 13 },
  kicker: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.1 },
  title: { fontSize: 30, lineHeight: 36 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailCard: { borderWidth: 1, borderRadius: 16, padding: 17, marginBottom: 13 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.1, marginBottom: 12 },
  infoRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1 },
  infoLabel: { fontSize: 11 },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 11, fontFamily: fonts.medium },
  description: { marginTop: 12, lineHeight: 19, fontSize: 13 },
  sectionTitle: { fontSize: 22 },
  help: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 15 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: fonts.body, marginBottom: 12 },
  notesInput: { minHeight: 84, paddingTop: 12 },
  photoControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  photoButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  removePhotoButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  photoPreview: { width: '100%', height: 190, borderRadius: 12, marginBottom: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10, marginBottom: 11 },
  progressEntry: { borderWidth: 1, borderRadius: 13, padding: 13, flexDirection: 'row', gap: 10, marginBottom: 8 },
  entryMarker: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  entryMeta: { fontFamily: fonts.semibold, fontSize: 10 },
  entryNotes: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  savedPhoto: { width: '100%', height: 220, borderRadius: 12, marginTop: 10, backgroundColor: '#eee' },
  removeSavedPhoto: { minHeight: 38, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 2 },
  noNotes: { fontSize: 12, paddingVertical: 15 },
  deleteSection: { alignItems: 'flex-end', marginTop: 8 },
  confirm: { borderWidth: 1, borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
});
