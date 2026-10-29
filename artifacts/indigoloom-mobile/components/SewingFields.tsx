import { useState, type ReactNode } from 'react';
import type { FabricUnit, SewingMachineSetting, SewingNeedleSize, SewingNeedleType, SewingPresserFoot, SewingProject, SewingStage, SewingStitch } from '@workspace/api-client-react';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
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

export const machineStitches: Array<{ value: SewingStitch; label: string }> = [
  { value: 'straight', label: 'Straight' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'three_step_zigzag', label: '3-step zigzag' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'overlock', label: 'Overlock' },
  { value: 'blind_hem', label: 'Blind hem' },
  { value: 'buttonhole', label: 'Buttonhole' },
  { value: 'decorative', label: 'Decorative' },
];

export const presserFeet: Array<{ value: SewingPresserFoot; label: string }> = [
  { value: 'all_purpose', label: 'All-purpose' },
  { value: 'zipper', label: 'Zipper' },
  { value: 'walking', label: 'Walking' },
  { value: 'buttonhole', label: 'Buttonhole' },
  { value: 'blind_hem', label: 'Blind hem' },
  { value: 'rolled_hem', label: 'Rolled hem' },
  { value: 'quarter_inch', label: '1/4 inch' },
  { value: 'open_toe', label: 'Open toe' },
  { value: 'non_stick', label: 'Non-stick' },
];

// Half steps from 0 up to the limit: 0, 0.5, 1 ...
function halfSteps(max: number): number[] {
  return Array.from({ length: max * 2 + 1 }, (_, index) => index / 2);
}
const stitchLengths = halfSteps(5);
const stitchWidths = halfSteps(7);
const tensions = halfSteps(9);

const emptyMachineSetting: SewingMachineSetting = { name: null, stitch: null, stitchLength: null, stitchWidth: null, tension: null, presserFoot: null, notes: null };

export function machineSettingSummary(setting: SewingMachineSetting): string {
  return [
    machineStitches.find((item) => item.value === setting.stitch)?.label,
    setting.stitchLength !== null && `Length ${setting.stitchLength} mm`,
    setting.stitchWidth !== null && `Width ${setting.stitchWidth} mm`,
    setting.tension !== null && `Tension ${setting.tension}`,
    setting.presserFoot && `${presserFeet.find((item) => item.value === setting.presserFoot)?.label} foot`,
  ].filter(Boolean).join(' · ');
}

function hasSomething(setting: SewingMachineSetting): boolean {
  return Object.values(setting).some((value) => value !== null && value !== '');
}

function ValueText({ children }: { children: ReactNode }) {
  const colors = useSewingColors();
  return <LoomText style={{ color: colors.foreground, fontSize: 15 }}>{children}</LoomText>;
}

function NumberRow({ label, unit, items, value, fallback, onChange, testID }: {
  label: string; unit: string; items: number[]; value: number | null; fallback: number; onChange: (value: number | null) => void; testID: string;
}) {
  return (
    <TapWheelRow
      label={label}
      shown={value !== null ? <ValueText>{`${value}${unit}`}</ValueText> : null}
      wheels={[{ label, items: items.map((item) => `${item}${unit}`), index: Math.max(0, items.indexOf(value ?? fallback)) }]}
      onDone={([index]) => onChange(items[index ?? 0])}
      onClear={() => onChange(null)}
      testID={testID}
    />
  );
}

// Named sets of machine settings (Seams, Topstitch, Hem...). Each set folds
// down to one line once it's done; every part of a set is optional.
export function MachineSettingsField({ settings, onChange }: { settings: SewingMachineSetting[]; onChange: (settings: SewingMachineSetting[]) => void }) {
  const colors = useSewingColors();
  const [editing, setEditing] = useState<number | null>(null);
  const change = (index: number, update: Partial<SewingMachineSetting>) => onChange(settings.map((item, place) => (place === index ? { ...item, ...update } : item)));
  const remove = (index: number) => { onChange(settings.filter((_, place) => place !== index)); setEditing(null); };
  // Closing a set with nothing in it drops it.
  const dropsOpen = () => editing !== null && !hasSomething(settings[editing]);
  const close = () => { if (dropsOpen()) remove(editing!); else setEditing(null); };
  const edit = (index: number) => {
    const shifts = dropsOpen() && index > editing!;
    close();
    setEditing(shifts ? index - 1 : index);
  };
  const inputStyle = [styles.machineInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];

  return (
    <View style={{ marginBottom: 18 }}>
      {settings.map((setting, index) => editing === index ? (
        <View key={index} style={[styles.machineSet, { backgroundColor: colors.selectedWash, borderColor: colors.border }]} testID={`machine-set-${index}`}>
          <View style={styles.machineName}>
            <TextInput placeholderTextColor={colors.mutedForeground} value={setting.name ?? ''} onChangeText={(name) => change(index, { name: name || null })} maxLength={60} placeholder="Name, e.g. Seams or Hem" accessibilityLabel="Name of these settings" style={[inputStyle, { flex: 1, fontFamily: fonts.semibold }]} testID={`input-machine-name-${index}`} />
            <Pressable accessibilityRole="button" accessibilityLabel="Remove these settings" onPress={() => remove(index)} style={styles.machineIcon} testID={`button-remove-machine-${index}`}><Feather name="x" size={17} color={colors.mutedForeground} /></Pressable>
          </View>
          <View style={[styles.machineRows, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TapWheelRow
              first
              label="Stitch"
              shown={setting.stitch ? <ValueText>{machineStitches.find((item) => item.value === setting.stitch)?.label}</ValueText> : null}
              wheels={[{ label: 'Stitch', items: machineStitches.map((item) => item.label), index: Math.max(0, machineStitches.findIndex((item) => item.value === setting.stitch)) }]}
              onDone={([stitch]) => change(index, { stitch: machineStitches[stitch ?? 0].value })}
              onClear={() => change(index, { stitch: null })}
              testID={`row-machine-stitch-${index}`}
            />
            <NumberRow label="Length" unit=" mm" items={stitchLengths} value={setting.stitchLength} fallback={2.5} onChange={(stitchLength) => change(index, { stitchLength })} testID={`row-machine-length-${index}`} />
            <NumberRow label="Width" unit=" mm" items={stitchWidths} value={setting.stitchWidth} fallback={0} onChange={(stitchWidth) => change(index, { stitchWidth })} testID={`row-machine-width-${index}`} />
            <NumberRow label="Tension" unit="" items={tensions} value={setting.tension} fallback={4} onChange={(tension) => change(index, { tension })} testID={`row-machine-tension-${index}`} />
            <TapWheelRow
              label="Presser foot"
              shown={setting.presserFoot ? <ValueText>{presserFeet.find((item) => item.value === setting.presserFoot)?.label}</ValueText> : null}
              wheels={[{ label: 'Presser foot', items: presserFeet.map((item) => item.label), index: Math.max(0, presserFeet.findIndex((item) => item.value === setting.presserFoot)) }]}
              onDone={([foot]) => change(index, { presserFoot: presserFeet[foot ?? 0].value })}
              onClear={() => change(index, { presserFoot: null })}
              testID={`row-machine-foot-${index}`}
            />
          </View>
          <TextInput placeholderTextColor={colors.mutedForeground} value={setting.notes ?? ''} onChangeText={(notes) => change(index, { notes: notes || null })} maxLength={500} placeholder="Note (optional)" accessibilityLabel="Note for these settings" style={inputStyle} testID={`input-machine-note-${index}`} />
          <Pressable accessibilityRole="button" onPress={close} style={[styles.machineDone, { borderColor: colors.primary, backgroundColor: colors.card }]} testID={`button-machine-done-${index}`}>
            <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>Done</LoomText>
          </Pressable>
        </View>
      ) : (
        <View key={index} style={[styles.machineSet, styles.machineFolded, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`machine-set-${index}`}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${setting.name || 'machine settings'}`} onPress={() => edit(index)} style={{ flex: 1, gap: 2 }} testID={`button-edit-machine-${index}`}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16 }}>{setting.name || 'Machine settings'}</LoomText>
            {machineSettingSummary(setting) || setting.notes ? <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>{machineSettingSummary(setting) || setting.notes}</LoomText> : null}
          </Pressable>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </View>
      ))}
      {editing === null && settings.length < 10 ? (
        <Pressable accessibilityRole="button" onPress={() => { onChange([...settings, emptyMachineSetting]); setEditing(settings.length); }} style={[styles.machineAdd, { borderColor: colors.input, backgroundColor: colors.card }]} testID="button-add-machine-settings">
          <Feather name="plus" size={16} color={colors.primaryText} />
          <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>Add machine settings</LoomText>
        </Pressable>
      ) : null}
    </View>
  );
}

// Each set as a small card on the project page.
export function MachineSettingsList({ settings }: { settings: SewingMachineSetting[] }) {
  const colors = useSewingColors();
  if (!settings.length) return null;
  return (
    <View style={{ marginTop: 14, gap: 8 }} testID="sewing-machine-settings">
      <LoomText style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: fonts.bold }}>Machine settings</LoomText>
      {settings.map((setting, index) => (
        <View key={index} style={[styles.machineCard, { backgroundColor: colors.selectedWash, borderColor: colors.border }]}>
          <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16 }}>{setting.name || 'Machine settings'}</LoomText>
          {machineSettingSummary(setting) ? <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{machineSettingSummary(setting)}</LoomText> : null}
          {setting.notes ? <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{setting.notes}</LoomText> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  machineSet: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 10, marginBottom: 10 },
  machineFolded: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  machineName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  machineInput: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body },
  machineIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  machineRows: { borderWidth: 1, borderRadius: 12 },
  machineDone: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 99, paddingHorizontal: 20, minHeight: 40, justifyContent: 'center' },
  machineAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 12, minHeight: 46 },
  machineCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 3 },
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
