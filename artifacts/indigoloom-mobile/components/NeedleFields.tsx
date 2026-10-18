import { KnittingNeedleSize, KnittingNeedleType, NeedleCableLength } from '@workspace/api-zod';
import type { Project } from '@workspace/api-client-react';
import { Pressable, StyleSheet, View } from 'react-native';
import { OptionPicker } from '@/components/HookSizePicker';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

type NeedleSize = (typeof KnittingNeedleSize)[keyof typeof KnittingNeedleSize];
type NeedleType = (typeof KnittingNeedleType)[keyof typeof KnittingNeedleType];
type CableLength = (typeof NeedleCableLength)[keyof typeof NeedleCableLength];

export type Needle = { size: NeedleSize | null; type: NeedleType | null; cable: CableLength | null };
export type NeedlesDraft = { needle: Needle; second: Needle | null };

const emptyNeedle: Needle = { size: null, type: null, cable: null };
export const emptyNeedles: NeedlesDraft = { needle: emptyNeedle, second: null };

const needleSizes = Object.values(KnittingNeedleSize) as NeedleSize[];
const needleTypes = Object.values(KnittingNeedleType) as NeedleType[];
const cableLengths = Object.values(NeedleCableLength) as CableLength[];
const needleTypeLabels: Record<NeedleType, string> = {
  straight: 'Straight', circular: 'Circular', double_pointed: 'Double-pointed', interchangeable: 'Interchangeable',
};
const hasCable = (type: NeedleType | null) => type === 'circular' || type === 'interchangeable';

export function needlesForApi(draft: NeedlesDraft, isKnitting: boolean) {
  const needle = isKnitting ? draft.needle : emptyNeedle;
  const second = isKnitting && draft.second ? draft.second : emptyNeedle;
  return {
    needleSize: needle.size,
    needleType: needle.type,
    needleCableLength: hasCable(needle.type) ? needle.cable : null,
    secondNeedleSize: second.size,
    secondNeedleType: second.type,
    secondNeedleCableLength: hasCable(second.type) ? second.cable : null,
  };
}

export function needlesFromProject(project: Project): NeedlesDraft {
  return {
    needle: { size: project.needleSize, type: project.needleType, cable: project.needleCableLength },
    second: project.secondNeedleSize || project.secondNeedleType
      ? { size: project.secondNeedleSize, type: project.secondNeedleType, cable: project.secondNeedleCableLength }
      : null,
  };
}

export function describeNeedle(size: string | null, type: NeedleType | null, cable: string | null) {
  const kind = type ? needleTypeLabels[type] + (hasCable(type) && cable ? `, ${cable}` : '') : '';
  return [size, kind].filter(Boolean).join(' · ');
}

export function NeedleFields({ value, onChange, testIDPrefix }: { value: NeedlesDraft; onChange: (value: NeedlesDraft) => void; testIDPrefix: string }) {
  const colors = useColors();
  const needle = (title: string, current: Needle, update: (next: Needle) => void, name: string, remove?: () => void) => (
    <View>
      <View style={styles.heading}>
        <LoomText style={[styles.sectionLabel, { color: colors.primary }]}>{title}</LoomText>
        {remove ? <Pressable accessibilityRole="button" onPress={remove} testID={`${testIDPrefix}-remove-second-needle`}><LoomText style={{ color: colors.mutedForeground, fontSize: 14, textDecorationLine: 'underline' }}>Remove</LoomText></Pressable> : null}
      </View>
      <FormFieldLabel>Size</FormFieldLabel>
      <OptionPicker label={`${title} size`} placeholder="Choose a size" options={needleSizes} value={current.size} onChange={(size) => update({ ...current, size })} testID={`${testIDPrefix}-${name}-size`} />
      <FormFieldLabel>Type</FormFieldLabel>
      <OptionPicker label={`${title} type`} placeholder="Choose a type" options={needleTypes} optionLabel={(type) => needleTypeLabels[type]} value={current.type} onChange={(type) => update({ ...current, type })} testID={`${testIDPrefix}-${name}-type`} />
      {hasCable(current.type) ? (
        <>
          <FormFieldLabel>Cable length</FormFieldLabel>
          <OptionPicker label={`${title} cable length`} placeholder="Choose a length" options={cableLengths} value={current.cable} onChange={(cable) => update({ ...current, cable })} testID={`${testIDPrefix}-${name}-cable`} />
        </>
      ) : null}
    </View>
  );
  return (
    <>
      {needle('Needle', value.needle, (next) => onChange({ ...value, needle: next }), 'needle')}
      {value.second
        ? needle('Second needle', value.second, (next) => onChange({ ...value, second: next }), 'second-needle', () => onChange({ ...value, second: null }))
        : <LoomButton title="Add a second needle" icon="plus" variant="quiet" onPress={() => onChange({ ...value, second: emptyNeedle })} testID={`${testIDPrefix}-add-second-needle`} style={styles.add} />}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 15, marginBottom: 13 },
  add: { alignSelf: 'flex-start', marginBottom: 14 },
});
