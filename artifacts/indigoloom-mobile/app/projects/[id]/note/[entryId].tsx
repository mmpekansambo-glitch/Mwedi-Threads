import { useEffect, useState } from 'react';
import { useGetProject, useUpdateProgress, getGetDashboardQueryKey, getGetProjectQueryKey, getGetProjectsQueryKey, getGetSkeinSuggestionsQueryKey } from '@workspace/api-client-react';
import type { ProgressEntry, ProjectDetail, UpdateProgress } from '@workspace/api-client-react';
import { useLocalSearchParams, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoadingState, LoomButton, LoomText, SignedInGate, fonts } from '@/components/loom';
import { ProjectDateField, type ProjectDatePrecision } from '@/components/ProjectDateField';
import { ProgressAmountInput, amountDraftFor, progressAmountForApi, type ProgressAmountDraft } from '@/components/ProgressMethod';
import { SavedProgressPhoto, pickProgressPhoto, uploadProgressPhoto } from '@/components/ProgressNote';
import { useColors } from '@/hooks/useColors';

const pad2 = (value: number) => String(value).padStart(2, '0');
const localDay = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export default function EditNoteScreen() {
  const { id, entryId } = useLocalSearchParams<{ id: string; entryId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const query = useGetProject(id);
  const project = query.data;
  const entry = project?.progress.find((note) => note.id === entryId);

  return (
    <SignedInGate>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.nav, { paddingTop: insets.top + 7, borderBottomColor: colors.border }]}>
          <LoomButton title="Cancel" variant="quiet" onPress={() => router.back()} style={{ minHeight: 38, paddingHorizontal: 8 }} />
          <LoomText style={[styles.navTitle, { color: colors.foreground }]}>Edit note</LoomText>
          <View style={{ width: 64 }} />
        </View>
        {query.isLoading ? <LoadingState label="Loading…" /> : project && entry
          ? <EditNoteForm project={project} entry={entry} />
          : <ScrollView contentContainerStyle={styles.form}><LoomText style={{ color: colors.mutedForeground }}>This note could not be found.</LoomText></ScrollView>}
      </View>
    </SignedInGate>
  );
}

function EditNoteForm({ project, entry }: { project: ProjectDetail; entry: ProgressEntry }) {
  const colors = useColors();
  const client = useQueryClient();
  const update = useUpdateProgress();
  const written = new Date(entry.createdAt);
  const isLatest = !project.progress.some((note) => note.createdAt > entry.createdAt);
  // Section ticks aren't stored per note, so the latest note starts from the
  // project's current ticks and older notes start with the count they recorded.
  const [initialAmount] = useState<ProgressAmountDraft>(() => {
    const draft = amountDraftFor({ ...project, completionPercent: entry.completionPercent }, entry.progressValue);
    if (project.progressMethod !== 'sections' || isLatest) return draft;
    const count = Math.round((entry.completionPercent / 100) * project.progressSections.length);
    return { ...draft, done: project.progressSections.slice(0, count).map((_, position) => position) };
  });
  const [notes, setNotes] = useState(entry.notes);
  const [day, setDay] = useState(localDay(written));
  const [precision, setPrecision] = useState<ProjectDatePrecision>('day');
  const [amount, setAmount] = useState(initialAmount);
  const [keepPhoto, setKeepPhoto] = useState(Boolean(entry.photoPath));
  const [newPhoto, setNewPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];

  useEffect(() => setError(''), [notes, day, amount]);

  const pickPhoto = async () => {
    const picked = await pickProgressPhoto();
    if (picked && 'error' in picked) setError(picked.error);
    else if (picked) setNewPhoto(picked);
  };

  const save = async () => {
    if (!notes.trim()) return setError('Add a note about this session.');
    if (!day || precision !== 'day') return setError('Choose the day you wrote this note.');
    if (day > localDay(new Date())) return setError('The date can’t be in the future.');
    const payload: UpdateProgress = { notes: notes.trim() };
    if (JSON.stringify(amount) !== JSON.stringify(initialAmount)) {
      const progress = progressAmountForApi(project, amount);
      if (typeof progress === 'string') return setError(progress);
      Object.assign(payload, progress);
    }
    if (day !== localDay(written)) {
      // Keep the time of day so notes written on the same day stay in order.
      const [year, month, date] = day.split('-').map(Number);
      const moved = new Date(written);
      moved.setFullYear(year, month - 1, date);
      payload.createdAt = moved.toISOString();
    }
    if (newPhoto) {
      setUploading(true);
      const uploaded = await uploadProgressPhoto(project.id, newPhoto);
      setUploading(false);
      if ('error' in uploaded) return setError(uploaded.error);
      payload.photoPath = uploaded.photoPath;
    } else if (entry.photoPath && !keepPhoto) {
      payload.photoPath = null;
    }
    update.mutate({ projectId: project.id, entryId: entry.id, data: payload }, {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
        void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetSkeinSuggestionsQueryKey() });
        router.back();
      },
      onError: () => setError('Your changes didn’t save this time. Please try again.'),
    });
  };

  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={75} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <FormFieldLabel>What did you work on?</FormFieldLabel>
        <TextInput value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" style={[...inputStyle, styles.notesInput]} testID="input-edit-note" />
        <ProjectDateField label="Date" value={day} precision={precision} onChange={setDay} onPrecisionChange={setPrecision} testID="input-edit-note-date" />
        <FormFieldLabel>Progress photo (optional)</FormFieldLabel>
        {newPhoto
          ? <Image source={{ uri: newPhoto.uri }} style={styles.photo} contentFit="cover" accessibilityLabel="New progress photo preview" />
          : entry.photoPath && keepPhoto ? <SavedProgressPhoto projectId={project.id} entryId={entry.id} style={styles.photo} /> : null}
        <View style={styles.photoControls}>
          <Pressable accessibilityRole="button" onPress={pickPhoto} style={[styles.photoButton, { borderColor: colors.border }]} testID="button-edit-note-pick-photo">
            <Feather name="image" size={17} color={colors.primary} />
            <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 }}>{newPhoto || (entry.photoPath && keepPhoto) ? 'Choose another photo' : 'Choose a photo'}</LoomText>
          </Pressable>
          {newPhoto || (entry.photoPath && keepPhoto)
            ? <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => (newPhoto ? setNewPhoto(null) : setKeepPhoto(false))} style={styles.removePhotoButton} testID="button-edit-note-remove-photo"><Feather name="x" size={18} color={colors.mutedForeground} /></Pressable>
            : null}
        </View>
        <ProgressAmountInput project={project} value={amount} onChange={setAmount} />
        {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 15, marginBottom: 12 }}>{error}</LoomText> : null}
        <LoomButton title="Save changes" icon="check" onPress={save} busy={update.isPending || uploading} disabled={!notes.trim()} testID="button-save-edit-note" />
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { minHeight: 47, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  navTitle: { fontSize: 16, fontFamily: fonts.semibold },
  form: { width: '100%', maxWidth: 650, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 38 },
  card: { width: '100%', maxWidth: '100%', minWidth: 0, borderWidth: 1, borderRadius: 18, padding: 17 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
  notesInput: { minHeight: 92, paddingTop: 12 },
  photo: { width: '100%', height: 190, borderRadius: 12, marginTop: 0, marginBottom: 10 },
  photoControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  photoButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  removePhotoButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
