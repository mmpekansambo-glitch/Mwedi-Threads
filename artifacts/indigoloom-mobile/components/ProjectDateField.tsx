import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { CreateProject } from '@workspace/api-client-react';
import { FormFieldLabel, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export type ProjectDatePrecision = NonNullable<CreateProject['startedAtPrecision']>;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const ITEM_HEIGHT = 44;
const NO_DAY = '—';
const pad2 = (value: number) => String(value).padStart(2, '0');
const daysIn = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

type Draft = { year: number; month: number; day: number };

function draftFromValue(value: string, precision: ProjectDatePrecision): Draft {
  const [year, month, day] = value.split('-').map(Number);
  const now = new Date();
  if (!year || !month) return { year: now.getFullYear(), month: now.getMonth(), day: 0 };
  return { year, month: month - 1, day: precision === 'day' && day ? day : 0 };
}

function formatWheelDate(value: string, precision: ProjectDatePrecision): string {
  if (!value) return '';
  const { year, month, day } = draftFromValue(value, precision);
  return day ? `${monthNames[month]} ${day}, ${year}` : `${monthNames[month]} ${year}`;
}

export function projectDateForApi(value: string, precision: ProjectDatePrecision): string | null {
  if (!value) return null;
  return precision === 'month' ? `${value.slice(0, 7)}-01` : value.slice(0, 10);
}

export function formatProjectDate(
  value: string | null | undefined,
  precision: ProjectDatePrecision,
): string {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month) return value;
  return precision === 'month'
    ? `${month}/${year.slice(-2)}`
    : `${month}/${day}/${year.slice(-2)}`;
}

export function Wheel({ label, items, index, onChange, flex, testID }: {
  label: string;
  items: string[];
  index: number;
  onChange: (index: number) => void;
  flex: number;
  testID: string;
}) {
  const colors = useColors();
  const ref = useRef<ScrollView>(null);
  const offset = useRef(index * ITEM_HEIGHT);

  useEffect(() => {
    if (Math.round(offset.current / ITEM_HEIGHT) !== index) ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
  }, [index]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    const next = Math.max(0, Math.min(items.length - 1, Math.round(offset.current / ITEM_HEIGHT)));
    if (next !== index) onChange(next);
  };

  return (
    <View
      style={{ flex, height: ITEM_HEIGHT * 5 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[index] === NO_DAY ? 'No day' : items[index] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onChange(Math.max(0, Math.min(items.length - 1, index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))))}
    >
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * ITEM_HEIGHT }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        scrollEventThrottle={32}
        onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.y; }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(event) => { if (!event.nativeEvent.velocity || Math.abs(event.nativeEvent.velocity.y) < 0.05) settle(event); }}
        nestedScrollEnabled
        testID={testID}
      >
        {items.map((item, itemIndex) => {
          const selected = itemIndex === index;
          return (
            <Pressable key={item} onPress={() => onChange(itemIndex)} style={styles.wheelItem} importantForAccessibility="no">
              <LoomText
                serif={selected}
                numberOfLines={1}
                style={{ color: selected ? colors.foreground : colors.mutedForeground, fontSize: selected ? 21 : 17, opacity: selected ? 1 : Math.max(0.35, 1 - Math.abs(itemIndex - index) * 0.3) }}
              >{item}</LoomText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ProjectDateField({
  label,
  value,
  precision,
  onChange,
  onPrecisionChange,
  testID,
}: {
  label: string;
  value: string;
  precision: ProjectDatePrecision;
  onChange: (value: string) => void;
  onPrecisionChange: (precision: ProjectDatePrecision) => void;
  testID: string;
}) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromValue(value, precision));
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 71 }, (_, offset) => thisYear - 60 + offset);
  const dayItems = [NO_DAY, ...Array.from({ length: daysIn(draft.year, draft.month) }, (_, offset) => String(offset + 1))];
  const displayValue = formatWheelDate(value, precision);

  const openPicker = () => {
    setDraft(draftFromValue(value, precision));
    setIsOpen(true);
  };

  const update = (next: Partial<Draft>) => setDraft((current) => {
    const merged = { ...current, ...next };
    return { ...merged, day: Math.min(merged.day, daysIn(merged.year, merged.month)) };
  });

  const save = () => {
    const monthValue = `${draft.year}-${pad2(draft.month + 1)}`;
    onPrecisionChange(draft.day ? 'day' : 'month');
    onChange(draft.day ? `${monthValue}-${pad2(draft.day)}` : monthValue);
    setIsOpen(false);
  };

  return (
    <View style={styles.field}>
      <FormFieldLabel>{label}</FormFieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayValue || 'Choose a date'}`}
        onPress={openPicker}
        style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.input }]}
        testID={`${testID}-calendar`}
      >
        <Feather name="calendar" size={16} color={colors.primary} />
        <LoomText style={{ flex: 1, color: displayValue ? colors.foreground : colors.mutedForeground, fontSize: 16 }}>
          {displayValue || 'Choose a date'}
        </LoomText>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="Close date picker" onPress={() => setIsOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeading}>
              <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)} style={styles.headingButton}>
                <LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancel</LoomText>
              </Pressable>
              <LoomText serif style={{ color: colors.foreground, fontSize: 20 }}>{label.replace(' (optional)', '')}</LoomText>
              <Pressable accessibilityRole="button" onPress={save} style={styles.headingButton} testID={`${testID}-done`}>
                <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'right' }}>Done</LoomText>
              </Pressable>
            </View>

            <View style={[styles.wheels, { backgroundColor: colors.selectedWash }]}>
              <View pointerEvents="none" style={[styles.wheelBand, { borderColor: colors.accent }]} />
              <Wheel label="Month" items={monthNames} index={draft.month} onChange={(month) => update({ month })} flex={1.6} testID={`${testID}-month`} />
              <Wheel label="Day, optional" items={dayItems} index={draft.day} onChange={(day) => update({ day })} flex={0.8} testID={`${testID}-day`} />
              <Wheel label="Year" items={years.map(String)} index={Math.max(0, years.indexOf(draft.year))} onChange={(yearIndex) => update({ year: years[yearIndex] })} flex={1} testID={`${testID}-year`} />
            </View>

            {value ? (
              <Pressable accessibilityRole="button" onPress={() => { onChange(''); setIsOpen(false); }} style={styles.clearButton}>
                <LoomText style={{ color: colors.destructive, fontFamily: fonts.semibold, fontSize: 15 }}>Clear date</LoomText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  dateButton: { minHeight: 46, marginTop: 8, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 47, 22, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  headingButton: { minWidth: 64, paddingVertical: 10 },
  wheels: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', paddingHorizontal: 6 },
  wheelBand: { position: 'absolute', left: 8, right: 8, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, borderTopWidth: 1.5, borderBottomWidth: 1.5 },
  wheelItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  clearButton: { alignSelf: 'center', paddingVertical: 12, marginTop: 6 },
});
