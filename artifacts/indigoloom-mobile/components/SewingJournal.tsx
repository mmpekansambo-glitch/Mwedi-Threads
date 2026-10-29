import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSewingProjectQueryKey, useAddSewingProjectEntry, useDeleteSewingProjectEntry } from '@workspace/api-client-react';
import type { SewingProject } from '@workspace/api-client-react';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { SwipeableNote, confirmDeleteNote } from '@/components/ProgressNote';
import { showSignpost } from '@/components/Signpost';
import { useSewingColors } from '@/hooks/useColors';

// A sewing project's dated notes, newest first. Swipe right on a note to
// edit it, left to delete it.
export function SewingJournal({ project }: { project: SewingProject }) {
  const colors = useSewingColors();
  const client = useQueryClient();
  const add = useAddSewingProjectEntry();
  const remove = useDeleteSewingProjectEntry();
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const refresh = () => { void client.invalidateQueries({ queryKey: getGetSewingProjectQueryKey(project.id) }); };

  // Saves the new note and says whether it went through.
  const save = async (): Promise<boolean> => {
    if (!text.trim()) {
      setMessage('Write a note first.');
      return false;
    }
    setMessage('');
    try {
      await add.mutateAsync({ sewingProjectId: project.id, data: { notes: text.trim() } });
    } catch {
      setMessage('We could not save this note. Please try again.');
      return false;
    }
    setText('');
    refresh();
    return true;
  };

  // Only one note is open at a time: a half-written new note is saved
  // before another note opens for editing.
  const openNote = async (entryId: string) => {
    if (text.trim()) {
      if (!(await save())) return;
      showSignpost('Changes saved');
    }
    router.push({ pathname: '/sewing/[id]/note/[entryId]', params: { id: project.id, entryId } });
  };

  const deleteNote = (entryId: string) => confirmDeleteNote(() => {
    remove.mutate({ sewingProjectId: project.id, entryId }, {
      onSuccess: refresh,
      onError: () => setMessage('We could not delete that note. Please try again.'),
    });
  });

  return (
    <View style={{ marginTop: 18 }}>
      <View style={styles.heading}>
        <LoomText serif style={[styles.title, { color: colors.foreground }]}>Notes journal</LoomText>
        <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{project.entries.length} {project.entries.length === 1 ? 'note' : 'notes'}</LoomText>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <FormFieldLabel>What did you work on?</FormFieldLabel>
        <TextInput value={text} onChangeText={setText} placeholder="Cut the pieces, sewed the darts, tried on for fit…" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlignVertical="top" style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]} testID="input-sewing-note" />
        {message ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 15, marginBottom: 11 }}>{message}</LoomText> : null}
        <LoomButton title="Save note" icon="feather" onPress={() => { void save(); }} busy={add.isPending} disabled={!text.trim()} testID="button-save-sewing-note" />
      </View>
      {project.entries.length ? project.entries.map((entry) => (
        <SwipeableNote key={entry.id} sewing onEdit={() => { void openNote(entry.id); }} onDelete={() => deleteNote(entry.id)} testID={`entry-sewing-note-${entry.id}`}>
          <View style={[styles.entry, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.marker, { backgroundColor: colors.primary }]} />
            <View style={{ flex: 1 }}>
              <LoomText style={[styles.meta, { color: colors.primaryText }]}>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</LoomText>
              <LoomText style={[styles.notes, { color: colors.foreground }]}>{entry.notes}</LoomText>
            </View>
          </View>
        </SwipeableNote>
      )) : <LoomText style={{ color: colors.mutedForeground, fontSize: 15, paddingVertical: 12 }}>No notes yet.</LoomText>}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 24 },
  card: { borderWidth: 1, borderRadius: 18, padding: 17, marginBottom: 13 },
  input: { minHeight: 84, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 12 },
  entry: { borderWidth: 1, borderRadius: 13, padding: 13, flexDirection: 'row', gap: 10 },
  marker: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  meta: { fontFamily: fonts.semibold, fontSize: 13 },
  notes: { fontSize: 15, lineHeight: 22, marginTop: 5 },
});
