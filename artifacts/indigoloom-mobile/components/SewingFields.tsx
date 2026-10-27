import type { FabricUnit, SewingProject, SewingStage } from '@workspace/api-client-react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LoomText, StatusChip, fonts } from '@/components/loom';
import { FabricPhoto, fabricUnits } from '@/components/FabricFields';
import { useSewingColors } from '@/hooks/useColors';

export const sewingStages: Array<{ value: SewingStage; label: string }> = [
  { value: 'prep', label: 'Prep' },
  { value: 'cut', label: 'Cut' },
  { value: 'sew', label: 'Sew' },
  { value: 'fit', label: 'Fit' },
  { value: 'finish', label: 'Finish' },
];

export function stageIndex(stage: SewingStage): number {
  return sewingStages.findIndex((item) => item.value === stage);
}

export function fabricAmount(amount: number | null, unit: FabricUnit): string {
  if (amount === null) return '';
  return `${amount} ${(fabricUnits.find((item) => item.value === unit) ?? fabricUnits[0]).amount}`;
}

// What's left of a stash fabric once a finished project's share is taken off.
export function amountLeft(amount: number, used: number): number {
  return Math.max(0, Math.round((amount - used) * 100) / 100);
}

// The five stages as a track: stages before the current one are done, and a
// finished project has done them all.
export function StageTrack({ project }: { project: Pick<SewingProject, 'stage' | 'status'> }) {
  const colors = useSewingColors();
  const current = project.status === 'completed' ? sewingStages.length : stageIndex(project.stage);
  const label = project.status === 'completed' ? 'Finished' : project.status === 'planning' ? 'Not started' : `Stage: ${sewingStages[current]?.label}`;
  return (
    <View style={styles.track} accessible accessibilityLabel={label}>
      {sewingStages.map((item, index) => (
        <View key={item.value} style={[styles.step, { backgroundColor: index < current || (index === current && project.status !== 'planning') ? colors.primary : colors.border, opacity: index === current && project.status !== 'planning' && project.status !== 'completed' ? 0.5 : 1 }]} />
      ))}
    </View>
  );
}

export function SewingProjectCard({ project }: { project: SewingProject }) {
  const colors = useSewingColors();
  const first = project.fabrics[0]?.fabric;
  const meta = [project.patternName, project.sizeMade && `Size ${project.sizeMade}`].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/sewing/[id]', params: { id: project.id } })}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
      testID={`sewing-card-${project.id}`}
    >
      {first ? <FabricPhoto fabric={first} index={0} style={[styles.photo, { backgroundColor: colors.selectedWash }]} /> : (
        <View style={[styles.photo, styles.noPhoto, { backgroundColor: colors.selectedWash }]}><Feather name="scissors" size={24} color={colors.primary} /></View>
      )}
      <View style={styles.body}>
        <View style={{ flexDirection: 'row' }}><StatusChip status={project.status} /></View>
        <LoomText serif numberOfLines={2} style={[styles.title, { color: colors.foreground }]}>{project.title}</LoomText>
        {meta ? <LoomText numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 14 }}>{meta}</LoomText> : null}
        <StageTrack project={project} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 5, marginTop: 6 },
  step: { flex: 1, height: 5, borderRadius: 3 },
  card: { width: '100%', borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  photo: { width: '100%', aspectRatio: 16 / 9 },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 13, gap: 5 },
  title: { fontSize: 20, lineHeight: 25, fontFamily: fonts.display },
});
