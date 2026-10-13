import { useState } from 'react';
import { useAddProgress, useDeleteProject, useGetProject, getGetDashboardQueryKey, getGetProjectQueryKey, getGetProjectsQueryKey } from '@workspace/api-client-react';
import { useLocalSearchParams, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormFieldLabel, LoomButton, LoomText, ProgressBar, SignedInGate, StatusChip, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const query = useGetProject(id);
  const addProgress = useAddProgress();
  const remove = useDeleteProject();
  const [notes, setNotes] = useState('');
  const [completion, setCompletion] = useState('');
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const project = query.data;
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
    void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
  };

  const saveProgress = () => {
    const percent = Number(completion);
    if (!notes.trim() || !Number.isInteger(percent) || percent < 0 || percent > 100) {
      setMessage('Add a note and a whole-number completion value between 0 and 100.');
      return;
    }
    setMessage('');
    addProgress.mutate({ projectId: id, data: { notes: notes.trim(), completionPercent: percent } }, {
      onSuccess: () => {
        setNotes('');
        setCompletion('');
        invalidate();
      },
      onError: () => setMessage('We could not save this note. Please try again.'),
    });
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
                ['Designer', project.patternDesigner],
                ['Yarn', project.yarn],
                ['Tools', project.tools],
                ['Started', project.startedAt],
                ['Target date', project.targetDate],
              ].filter((entry) => entry[1]).map(([label, value]) => (
                <View key={label} style={[styles.infoRow, { borderBottomColor: colors.border }]}><LoomText style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</LoomText><LoomText style={[styles.infoValue, { color: colors.foreground }]}>{value}</LoomText></View>
              ))}
              {project.description ? <LoomText style={[styles.description, { color: colors.foreground }]}>{project.description}</LoomText> : null}
            </View>
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>Leave a progress note</LoomText>
              <LoomText style={[styles.help, { color: colors.mutedForeground }]}>A few words after a session. Your progress adds up, quietly.</LoomText>
              <FormFieldLabel>What changed today?</FormFieldLabel>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Rows completed, a tricky section, a new color…" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlignVertical="top" style={[...inputStyle, styles.notesInput]} testID="input-progress-notes" />
              <FormFieldLabel>Completion (0–100%)</FormFieldLabel>
              <TextInput value={completion || String(project.completionPercent)} onChangeText={setCompletion} placeholder="0–100" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" style={inputStyle} testID="input-progress-percent" />
              {message ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 12, marginBottom: 11 }}>{message}</LoomText> : null}
              <LoomButton title="Save progress note" icon="feather" onPress={saveProgress} busy={addProgress.isPending} disabled={!notes.trim()} testID="button-save-progress" />
            </View>
            <View style={styles.sectionHeading}><LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>The journey so far</LoomText><LoomText style={{ color: colors.mutedForeground, fontSize: 11 }}>{project.progress.length} notes</LoomText></View>
            {project.progress.length ? project.progress.map((entry) => (
              <View key={entry.id} style={[styles.progressEntry, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.entryMarker, { backgroundColor: colors.accent }]} />
                <View style={{ flex: 1 }}>
                  <LoomText style={[styles.entryMeta, { color: colors.primary }]}>{entry.completionPercent}% complete · {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</LoomText>
                  <LoomText style={[styles.entryNotes, { color: colors.foreground }]}>{entry.notes}</LoomText>
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
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10, marginBottom: 11 },
  progressEntry: { borderWidth: 1, borderRadius: 13, padding: 13, flexDirection: 'row', gap: 10, marginBottom: 8 },
  entryMarker: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  entryMeta: { fontFamily: fonts.semibold, fontSize: 10 },
  entryNotes: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  noNotes: { fontSize: 12, paddingVertical: 15 },
  deleteSection: { alignItems: 'flex-end', marginTop: 8 },
  confirm: { borderWidth: 1, borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
});
