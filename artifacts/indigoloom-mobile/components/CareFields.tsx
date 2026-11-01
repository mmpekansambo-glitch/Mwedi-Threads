import { useState } from 'react';
import { careGroups, careOption, hasCare, noCare } from '@workspace/api-client-react';
import type { CareGroup, CareShape, FabricCare } from '@workspace/api-client-react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { FormFieldLabel, LoomText, fonts } from '@/components/loom';
import { useSewingColors } from '@/hooks/useColors';

// One laundry care symbol, drawn from the shared shape data.
export function CareSymbol({ shape, size = 28, color }: { shape: CareShape; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      {shape.paths.map((d) => <Path key={d} d={d} />)}
      {shape.dots.map(([cx, cy]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.9} fill={color} stroke="none" />)}
    </Svg>
  );
}

function CareRow({ group, value, onChange, first }: { group: CareGroup; value: string | null; onChange: (value: string | null) => void; first: boolean }) {
  const colors = useSewingColors();
  const [isOpen, setIsOpen] = useState(false);
  const chosen = careOption(group, value);
  const testID = `row-care-${group.key.slice(4).toLowerCase()}`;
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setIsOpen(true)} style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }]} testID={testID}>
        <LoomText style={[styles.rowLabel, { color: colors.foreground }]}>{group.label}</LoomText>
        <View style={styles.value}>
          {chosen ? (
            <>
              <CareSymbol shape={chosen.shape} color={colors.foreground} />
              <LoomText style={{ color: colors.foreground, fontSize: 15, flexShrink: 1 }}>{chosen.label}</LoomText>
            </>
          ) : <LoomText style={{ color: colors.mutedForeground, fontSize: 15 }}>Choose</LoomText>}
        </View>
        <Feather name="chevron-right" size={16} color={colors.primaryText} />
      </Pressable>
      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel={`Close ${group.label.toLowerCase()} picker`} onPress={() => setIsOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <LoomText serif style={[styles.sheetTitle, { color: colors.foreground }]}>{group.label}</LoomText>
            <View style={styles.grid} accessibilityRole="radiogroup">
              {group.options.map((option) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={option.label}
                    onPress={() => { onChange(option.value); setIsOpen(false); }}
                    style={[styles.tile, { borderColor: selected ? colors.primary : colors.input, backgroundColor: selected ? colors.selectedWash : colors.card, borderWidth: selected ? 2 : 1 }]}
                    testID={`${testID}-${option.value}`}
                  >
                    <CareSymbol shape={option.shape} size={38} color={colors.foreground} />
                    <LoomText style={[styles.tileLabel, { color: colors.foreground }]}>{option.label}</LoomText>
                  </Pressable>
                );
              })}
            </View>
            {chosen ? (
              <Pressable accessibilityRole="button" onPress={() => { onChange(null); setIsOpen(false); }} style={styles.clear} testID={`${testID}-clear`}>
                <LoomText style={{ color: colors.mutedForeground, fontFamily: fonts.semibold, fontSize: 15 }}>Clear</LoomText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

// Optional care label for a fabric: closed behind one button until the maker
// wants it, then one row per group (Wash, Bleach, Dry, Iron, Dry clean).
export function CareField({ value, onChange }: { value: FabricCare; onChange: (care: FabricCare) => void }) {
  const colors = useSewingColors();
  const [isOpen, setIsOpen] = useState(() => hasCare(value));
  if (!isOpen) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setIsOpen(true)} style={[styles.add, { borderColor: colors.input, backgroundColor: colors.card }]} testID="button-add-care">
        <Feather name="plus" size={16} color={colors.primaryText} />
        <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>Add care instructions</LoomText>
      </Pressable>
    );
  }
  return (
    <View style={styles.field}>
      <View style={styles.heading}>
        <FormFieldLabel>Care instructions</FormFieldLabel>
        <Pressable accessibilityRole="button" onPress={() => { onChange(noCare); setIsOpen(false); }} hitSlop={8} testID="button-remove-care">
          <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 14 }}>Remove</LoomText>
        </Pressable>
      </View>
      <View style={[styles.rows, { borderColor: colors.border }]}>
        {careGroups.map((group, place) => (
          <CareRow key={group.key} group={group} first={place === 0} value={value[group.key]} onChange={(next) => onChange({ ...value, [group.key]: next })} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 12, minHeight: 46, marginBottom: 16 },
  field: { marginBottom: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rows: { borderWidth: 1, borderRadius: 12 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  rowLabel: { width: 82, fontFamily: fonts.semibold, fontSize: 16 },
  value: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 47, 22, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  sheetTitle: { fontSize: 20, textAlign: 'center', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  tile: { width: '31.5%', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4 },
  tileLabel: { fontSize: 13, fontFamily: fonts.semibold, textAlign: 'center', lineHeight: 17 },
  clear: { alignSelf: 'center', paddingVertical: 12, marginTop: 6 },
});
