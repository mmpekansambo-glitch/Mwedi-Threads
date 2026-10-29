import { useEffect, useState } from 'react';
import { getGetSewingProjectQueryKey, useGetSewingProject, useUpdateSewingProjectEntry } from '@workspace/api-client-react';
import type { SaveSewingProjectEntry, SewingProject, SewingProjectEntry } from '@workspace/api-client-react';
import { useLocalSearchParams, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoadingState, LoomButton, LoomText, SignedInGate, fonts } from '@/components/loom';
import { ProjectDateField, type ProjectDatePrecision } from '@/components/ProjectDateField';
import { useSewingColors } from '@/hooks/useColors';

const pad2 = (value: number) => String(value).padStart(2, '0');
const localDay = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export default function EditSewingNoteScreen() {
  const { id, entryId } = useLocalSearchParams<{ id: string; entryId: string }>();
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const query = useGetSewingProject(id);
  const project = query.data;
  const entry = project?.entries.find((note) => note.id === entryId);

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

function EditNoteForm({ project, entry }: { project: SewingProject; entry: SewingProjectEntry }) {
  const colors = useSewingColors();
  const client = useQueryClient();
  const update = useUpdateSewingProjectEntry();
  const written = new Date(entry.createdAt);
  const [notes, setNotes] = useState(entry.notes);
  const [day, setDay] = useState(localDay(written));
  const [precision, setPrecision] = useState<ProjectDatePrecision>('day');
  const [error, setError] = useState('');

  useEffect(() => setError(''), [notes, day]);

  const save = () => {
    if (!notes.trim()) return setError('Write a note first.');
    if (!day || precision !== 'day') return setError('Choose the day you wrote this note.');
    if (day > localDay(new Date())) return setError('The date can’t be in the future.');
    const data: SaveSewingProjectEntry = { notes: notes.trim() };
    if (day !== localDay(written)) {
      // Keep the time of day so notes written on the same day stay in order.
      const [year, month, date] = day.split('-').map(Number);
      const moved = new Date(written);
      moved.setFullYear(year, month - 1, date);
      data.createdAt = moved.toISOString();
    }
    update.mutate({ sewingProjectId: project.id, entryId: entry.id, data }, {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getGetSewingProjectQueryKey(project.id) });
        router.back();
      },
      onError: () => setError('Your changes didn’t save this time. Please try again.'),
    });
  };

  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={75} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <FormFieldLabel>What did you work on?</FormFieldLabel>
        <TextInput value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]} testID="input-edit-note" />
        <ProjectDateField label="Date" value={day} precision={precision} onChange={setDay} onPrecisionChange={setPrecision} testID="input-edit-note-date" />
        {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 15, marginBottom: 12 }}>{error}</LoomText> : null}
        <LoomButton title="Save changes" icon="check" onPress={save} busy={update.isPending} disabled={!notes.trim()} testID="button-save-edit-note" />
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
  input: { minHeight: 92, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
});
