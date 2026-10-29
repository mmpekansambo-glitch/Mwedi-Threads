import { useState, type ReactNode } from 'react';
import type { FabricUnit, SewingNeedleSize, SewingNeedleType, SewingProject, SewingStage } from '@workspace/api-client-react';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LoomText, StatusChip, fonts } from '@/components/loom';
import { FabricPhoto, fabricUnits } from '@/components/FabricFields';
import { ITEM_HEIGHT, Wheel } from '@/components/ProjectDateField';
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

// Tapping the current stage again unchecks it: the project steps back one
// stage, and unchecking Prep puts it back to Not started. Any other stage is
// picked as usual, which starts a project that hasn't started yet.
export function stageChange(project: Pick<SewingProject, 'stage' | 'status'>, stage: SewingStage): { stage?: SewingStage; status?: SewingProject['status'] } {
  const at = stageIndex(stage);
  if (project.status !== 'planning' && project.status !== 'completed' && project.stage === stage) {
    return at === 0 ? { status: 'planning' } : { stage: sewingStages[at - 1]!.value };
  }
  return project.status === 'planning' || project.status === 'paused' ? { stage, status: 'in_progress' } : { stage };
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
        <View style={[styles.photo, styles.noPhoto, { backgroundColor: colors.selectedWash }]}><Feather name="scissors" size={24} color={colors.primaryText} /></View>
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

export const machineNeedleTypes: Array<{ value: SewingNeedleType; label: string }> = [
  { value: 'universal', label: 'Universal' },
  { value: 'ballpoint', label: 'Ballpoint' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'jeans', label: 'Jeans' },
  { value: 'microtex', label: 'Microtex' },
  { value: 'quilting', label: 'Quilting' },
  { value: 'leather', label: 'Leather' },
  { value: 'topstitch', label: 'Topstitch' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'metallic', label: 'Metallic' },
];

export const machineNeedleSizes: SewingNeedleSize[] = ['60/8', '65/9', '70/10', '75/11', '80/12', '90/14', '100/16', '110/18'];

export function needleLabel(project: Pick<SewingProject, 'needleType' | 'needleSize'>): string {
  return [machineNeedleTypes.find((item) => item.value === project.needleType)?.label, project.needleSize].filter(Boolean).join(' ');
}

// A form row that reads "Add" until filled; tapping it opens one or more
// scroll wheels side by side. Keeps optional details out of the way.
export function TapWheelRow({ label, shown, wheels, onDone, onClear, first, testID }: {
  label: string;
  shown: ReactNode;
  wheels: Array<{ label: string; items: string[]; index: number }>;
  onDone: (indexes: number[]) => void;
  onClear: () => void;
  first?: boolean;
  testID: string;
}) {
  const colors = useSewingColors();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>([]);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => { setDraft(wheels.map((wheel) => wheel.index)); setIsOpen(true); }}
        style={[styles.tapRow, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}
        testID={testID}
      >
        <LoomText style={{ flex: 1, color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16 }}>{label}</LoomText>
        {shown ? <View style={styles.tapValue}>{shown}</View> : (
          <View style={styles.tapValue}>
            <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>Add</LoomText>
            <Feather name="chevron-right" size={16} color={colors.primaryText} />
          </View>
        )}
      </Pressable>
      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel={`Close ${label.toLowerCase()} picker`} onPress={() => setIsOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeading}>
              <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)} style={styles.headingButton}>
                <LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancel</LoomText>
              </Pressable>
              <LoomText serif style={{ color: colors.foreground, fontSize: 20 }}>{label}</LoomText>
              <Pressable accessibilityRole="button" onPress={() => { onDone(draft); setIsOpen(false); }} style={styles.headingButton} testID={`${testID}-done`}>
                <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'right' }}>Done</LoomText>
              </Pressable>
            </View>
            <View style={[styles.wheels, { backgroundColor: colors.selectedWash }]}>
              <View pointerEvents="none" style={[styles.wheelBand, { borderColor: colors.accent }]} />
              {wheels.map((wheel, place) => (
                <Wheel key={wheel.label} label={wheel.label} items={wheel.items} index={draft[place] ?? 0} onChange={(index) => setDraft((current) => current.map((value, at) => (at === place ? index : value)))} flex={1} testID={`${testID}-wheel-${place}`} />
              ))}
            </View>
            {shown ? (
              <Pressable accessibilityRole="button" onPress={() => { onClear(); setIsOpen(false); }} style={styles.clearButton} testID={`${testID}-clear`}>
                <LoomText style={{ color: colors.destructive, fontFamily: fonts.semibold, fontSize: 15 }}>Clear {label.toLowerCase()}</LoomText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tapRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  tapValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 47, 22, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  headingButton: { minWidth: 64, paddingVertical: 10 },
  wheels: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', paddingHorizontal: 6 },
  wheelBand: { position: 'absolute', left: 8, right: 8, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, borderTopWidth: 1.5, borderBottomWidth: 1.5 },
  clearButton: { alignSelf: 'center', paddingVertical: 12, marginTop: 6 },
  track: { flexDirection: 'row', gap: 5, marginTop: 6 },
  step: { flex: 1, height: 5, borderRadius: 3 },
  card: { width: '100%', borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  photo: { width: '100%', aspectRatio: 16 / 9 },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 13, gap: 5 },
  title: { fontSize: 20, lineHeight: 25, fontFamily: fonts.display },
});
