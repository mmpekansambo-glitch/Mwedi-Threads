import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetSewingOverviewQueryKey, getGetSewingProjectQueryKey, getGetSewingProjectsQueryKey, getGetStashFabricsQueryKey,
  useDeleteSewingProject, useGetSewingProject, useUpdateSewingProject, useUpdateStashFabric,
} from '@workspace/api-client-react';
import type { ProjectStatus, SewingProject, SewingStage } from '@workspace/api-client-react';
import { ErrorState, LoadingState, LoomButton, LoomText, SignedInGate, StatusChip, fonts } from '@/components/loom';
import { FabricPhoto, fabricName } from '@/components/FabricFields';
import { amountLeft, fabricAmount, sewingStages, stageIndex } from '@/components/SewingFields';
import { useSewingColors } from '@/hooks/useColors';

// After a project is finished, offers to take the fabric it used off the stash.
function FabricLeftPrompt({ project, onDone }: { project: SewingProject; onDone: () => void }) {
  const colors = useSewingColors();
  const client = useQueryClient();
  const updateFabric = useUpdateStashFabric();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const changes = project.fabrics.filter((item) => item.amountUsed !== null && item.fabric.amount !== null);
  if (!changes.length) return null;
  const apply = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await Promise.all(changes.map((item) => updateFabric.mutateAsync({ fabricId: item.stashFabricId, data: { amount: amountLeft(item.fabric.amount!, item.amountUsed!) } })));
      void client.invalidateQueries({ queryKey: getGetStashFabricsQueryKey() });
      void client.invalidateQueries({ queryKey: getGetSewingProjectQueryKey(project.id) });
      void client.invalidateQueries({ queryKey: getGetSewingOverviewQueryKey() });
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={[styles.prompt, { backgroundColor: colors.warningWash, borderColor: colors.warningBorder }]} testID="prompt-fabric-left">
      <LoomText style={{ color: colors.warningText, fontFamily: fonts.semibold, fontSize: 15 }}>Take the fabric you used off your stash?</LoomText>
      {changes.map((item) => (
        <LoomText key={item.stashFabricId} style={{ color: colors.warningText, fontSize: 14, marginTop: 4 }}>
          {fabricName(item.fabric)}: {fabricAmount(item.fabric.amount, item.fabric.unit)} → {fabricAmount(amountLeft(item.fabric.amount!, item.amountUsed!), item.fabric.unit)}
        </LoomText>
      ))}
      {failed ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14, marginTop: 6 }}>We could not update your stash just now. Please try again.</LoomText> : null}
      <View style={styles.promptActions}>
        <LoomButton title="Not now" variant="quiet" onPress={onDone} testID="button-keep-stash" />
        <LoomButton title="Update stash" onPress={() => { void apply(); }} busy={saving} testID="button-update-stash" />
      </View>
    </View>
  );
}

function SewingProjectView({ project }: { project: SewingProject }) {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const { finished } = useLocalSearchParams<{ finished?: string }>();
  const update = useUpdateSewingProject();
  const remove = useDeleteSewingProject();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [prompt, setPrompt] = useState(finished === '1');
  // Finishing here or in the edit form brings up the stash prompt.
  const lastStatus = useRef(project.status);
  useEffect(() => {
    if (project.status === 'completed' && lastStatus.current !== 'completed') setPrompt(true);
    lastStatus.current = project.status;
  }, [project.status]);

  const refresh = (saved: SewingProject) => {
    client.setQueryData(getGetSewingProjectQueryKey(saved.id), saved);
    void client.invalidateQueries({ queryKey: getGetSewingProjectsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetSewingOverviewQueryKey() });
  };
  const change = (data: { stage?: SewingStage; status?: ProjectStatus }) => update.mutate({ sewingProjectId: project.id, data }, { onSuccess: refresh });
  // Picking a stage on a project that hasn't started yet starts it.
  const pickStage = (stage: SewingStage) => change(project.status === 'planning' || project.status === 'paused' ? { stage, status: 'in_progress' } : { stage });
  const deleteProject = () => remove.mutate({ sewingProjectId: project.id }, {
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: getGetSewingProjectsQueryKey() });
      void client.invalidateQueries({ queryKey: getGetSewingOverviewQueryKey() });
      router.back();
    },
  });
  const current = stageIndex(project.stage);
  const facts = [['Pattern', project.patternName], ['Designer', project.patternDesigner], ['Size made', project.sizeMade]].filter(([, value]) => value);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 9, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.navButton}><Feather name="arrow-left" size={19} color={colors.primaryText} /></Pressable>
        <LoomText numberOfLines={1} style={[styles.navTitle, { color: colors.foreground }]}>{project.title}</LoomText>
        <View style={{ flexDirection: 'row' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit project" onPress={() => router.push({ pathname: '/sewing/new', params: { id: project.id } })} style={styles.navButton} testID="button-edit-sewing-project"><Feather name="edit-2" size={17} color={colors.primaryText} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Delete project" onPress={() => setConfirmDelete(true)} style={styles.navButton} testID="button-delete-sewing-project"><Feather name="trash-2" size={18} color={colors.destructive} /></Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {confirmDelete ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>Delete this project?</LoomText>
            <LoomText style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>Your fabric stays in your stash.</LoomText>
            <View style={styles.promptActions}>
              <LoomButton title="Cancel" variant="quiet" onPress={() => setConfirmDelete(false)} />
              <LoomButton title="Delete project" variant="danger" onPress={deleteProject} busy={remove.isPending} testID="button-confirm-delete-sewing-project" />
            </View>
          </View>
        ) : null}
        {prompt && project.status === 'completed' ? <FabricLeftPrompt project={project} onDone={() => setPrompt(false)} /> : null}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LoomText serif style={[styles.title, { color: colors.foreground }]}>{project.title}</LoomText>
          <View style={styles.statusRow}>
            <StatusChip status={project.status} />
            {project.completedAt ? <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>Finished {new Date(`${project.completedAt}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</LoomText> : null}
          </View>
          <View style={styles.stages} accessibilityRole="radiogroup" accessibilityLabel="Stage">
            {sewingStages.map((item, index) => {
              const done = project.status === 'completed' || index < current;
              const isCurrent = project.status !== 'completed' && project.status !== 'planning' && index === current;
              return (
                <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: isCurrent, disabled: project.status === 'completed' }} disabled={update.isPending || project.status === 'completed'} onPress={() => pickStage(item.value)} style={[styles.stage, { borderColor: isCurrent ? colors.primary : colors.border, backgroundColor: isCurrent ? colors.selectedWash : colors.card }]} testID={`button-stage-${item.value}`}>
                  <View style={[styles.stageDot, { backgroundColor: done ? colors.primary : colors.selectedWash, borderColor: isCurrent ? colors.primary : 'transparent' }]}>
                    {done ? <Feather name="check" size={12} color={colors.primaryForeground} /> : <LoomText style={{ fontSize: 12, color: isCurrent ? colors.primaryText : colors.mutedForeground, fontFamily: fonts.bold }}>{index + 1}</LoomText>}
                  </View>
                  <LoomText style={{ fontSize: 13, fontFamily: fonts.bold, color: isCurrent ? colors.foreground : colors.mutedForeground }}>{item.label}</LoomText>
                </Pressable>
              );
            })}
          </View>
          {project.status === 'completed'
            ? <LoomButton title="Reopen project" variant="secondary" onPress={() => change({ status: 'in_progress' })} busy={update.isPending} testID="button-reopen-sewing-project" />
            : <LoomButton title="Mark finished" icon="check" onPress={() => change({ status: 'completed' })} busy={update.isPending} testID="button-finish-sewing-project" />}
          {update.isError ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14, marginTop: 8 }}>We could not save that just now. Please try again.</LoomText> : null}
          {facts.length ? (
            <View style={styles.facts}>
              {facts.map(([label, value]) => (
                <View key={label}>
                  <LoomText style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: fonts.bold }}>{label}</LoomText>
                  <LoomText style={{ color: colors.foreground, fontSize: 16 }}>{value}</LoomText>
                </View>
              ))}
            </View>
          ) : null}
          {([['Fit changes', project.fitChanges], ['Notes', project.notes]] as const).map(([label, value]) => value ? (
            <View key={label} style={{ marginTop: 14 }}>
              <LoomText style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: fonts.bold }}>{label}</LoomText>
              <LoomText style={{ color: colors.foreground, fontSize: 16, lineHeight: 23 }}>{value}</LoomText>
            </View>
          ) : null)}
        </View>
        <LoomText serif style={[styles.section, { color: colors.foreground }]}>Fabric</LoomText>
        {project.fabrics.length ? project.fabrics.map((item) => (
          <Pressable key={item.stashFabricId} accessibilityRole="button" onPress={() => router.push({ pathname: '/fabric/[id]', params: { id: item.stashFabricId } })} style={[styles.fabric, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`project-fabric-${item.stashFabricId}`}>
            <FabricPhoto fabric={item.fabric} index={0} style={[styles.fabricPhoto, { backgroundColor: colors.selectedWash }]} />
            <View style={{ flex: 1 }}>
              <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16 }}>{fabricName(item.fabric)}</LoomText>
              {item.amountUsed !== null ? <LoomText style={{ color: colors.primaryText, fontSize: 14, fontFamily: fonts.semibold }}>Uses {fabricAmount(item.amountUsed, item.fabric.unit)}</LoomText> : null}
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        )) : <LoomText style={{ color: colors.mutedForeground, fontSize: 15 }}>No fabric on this project yet.</LoomText>}
      </ScrollView>
    </View>
  );
}

export default function SewingProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useSewingColors();
  const query = useGetSewingProject(id);
  return (
    <SignedInGate>
      {query.data ? <SewingProjectView project={query.data} /> : (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background }}>
          {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : <LoadingState label="Finding this project…" />}
        </View>
      )}
    </SignedInGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  navButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: fonts.semibold, fontSize: 16, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { width: '100%', maxWidth: 650, alignSelf: 'center', padding: 20 },
  card: { borderWidth: 1, borderRadius: 18, padding: 17, marginBottom: 14 },
  title: { fontSize: 28, lineHeight: 34, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  stages: { flexDirection: 'row', gap: 5, marginBottom: 14 },
  stage: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center', gap: 5 },
  stageDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginTop: 16 },
  section: { fontSize: 24, marginTop: 8, marginBottom: 10 },
  fabric: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 9, marginBottom: 10 },
  fabricPhoto: { width: 72, height: 72, borderRadius: 10 },
  prompt: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  promptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
});
