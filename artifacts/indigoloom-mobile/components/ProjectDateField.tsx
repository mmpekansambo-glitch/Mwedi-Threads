import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import type { CreateProject } from '@workspace/api-client-react';
import { FormFieldLabel, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export type ProjectDatePrecision = NonNullable<CreateProject['startedAtPrecision']>;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad2 = (value: number) => String(value).padStart(2, '0');

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
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const selectedParts = value.split('-').map(Number);
  const visibleYear = visibleMonth.getFullYear();
  const visibleMonthIndex = visibleMonth.getMonth();
  const firstWeekday = new Date(visibleYear, visibleMonthIndex, 1).getDay();
  const daysInMonth = new Date(visibleYear, visibleMonthIndex + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - firstWeekday + 1;
      return day > 0 && day <= daysInMonth ? day : null;
    },
  );
  const displayValue = formatProjectDate(value, precision);

  const openPicker = () => {
    const [selectedYear, selectedMonth] = selectedParts;
    const now = new Date();
    setVisibleMonth(new Date(
      selectedYear || now.getFullYear(),
      selectedMonth ? selectedMonth - 1 : now.getMonth(),
      1,
    ));
    setIsOpen(true);
  };

  const changePrecision = (next: ProjectDatePrecision) => {
    if (next === precision) return;
    onChange(next === 'month' ? value.slice(0, 7) : '');
    onPrecisionChange(next);
  };

  const moveCalendar = (direction: -1 | 1) => {
    setVisibleMonth(precision === 'month'
      ? new Date(visibleYear + direction, visibleMonthIndex, 1)
      : new Date(visibleYear, visibleMonthIndex + direction, 1));
  };

  const chooseDay = (day: number) => {
    onChange(`${visibleYear}-${pad2(visibleMonthIndex + 1)}-${pad2(day)}`);
    setIsOpen(false);
  };

  const chooseMonth = (monthIndex: number) => {
    onChange(`${visibleYear}-${pad2(monthIndex + 1)}`);
    setIsOpen(false);
  };

  return (
    <View style={styles.field}>
      <FormFieldLabel>{label}</FormFieldLabel>
      <View style={styles.precisionRow}>
        {([
          ['month', 'MM/YY'],
          ['day', 'MM/DD/YY'],
        ] as const).map(([item, title]) => {
          const active = precision === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => changePrecision(item)}
              style={[
                styles.precisionButton,
                {
                  backgroundColor: active ? colors.softPlum : colors.background,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              testID={`${testID}-precision-${item}`}
            >
              <LoomText style={{
                color: active ? colors.primary : colors.mutedForeground,
                fontFamily: active ? fonts.semibold : fonts.body,
                fontSize: 11,
              }}>{title}</LoomText>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayValue || (precision === 'month' ? 'Choose month and year' : 'Choose date')}`}
        onPress={openPicker}
        style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.input }]}
        testID={`${testID}-calendar`}
      >
        <Feather name="calendar" size={16} color={colors.primary} />
        <LoomText style={{ color: displayValue ? colors.foreground : colors.mutedForeground, fontSize: 13 }}>
          {displayValue || (precision === 'month' ? 'Choose month and year' : 'Choose date')}
        </LoomText>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Close calendar"
            onPress={() => setIsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: 20 }]}>
            <View style={[styles.sheetHeading, { borderBottomColor: colors.border }]}>
              <View>
                <LoomText serif style={{ color: colors.foreground, fontSize: 21 }}>
                  {precision === 'month' ? 'Choose month and year' : 'Choose a date'}
                </LoomText>
                <LoomText style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 3 }}>
                  {precision === 'month' ? 'Month and year only · MM/YY' : 'Select a day · MM/DD/YY'}
                </LoomText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close calendar"
                onPress={() => setIsOpen(false)}
                style={styles.closeButton}
              >
                <Feather name="x" size={19} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={styles.calendarHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={precision === 'month' ? 'Previous year' : 'Previous month'}
                onPress={() => moveCalendar(-1)}
                style={[styles.calendarNavButton, { borderColor: colors.border }]}
              >
                <Feather name="chevron-left" size={17} color={colors.primary} />
              </Pressable>
              <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>
                {precision === 'month'
                  ? String(visibleYear)
                  : new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(visibleMonth)}
              </LoomText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={precision === 'month' ? 'Next year' : 'Next month'}
                onPress={() => moveCalendar(1)}
                style={[styles.calendarNavButton, { borderColor: colors.border }]}
              >
                <Feather name="chevron-right" size={17} color={colors.primary} />
              </Pressable>
            </View>

            {precision === 'month' ? (
              <View style={styles.monthGrid}>
                {monthNames.map((monthName, monthIndex) => {
                  const selected = selectedParts[0] === visibleYear && selectedParts[1] === monthIndex + 1;
                  return (
                    <Pressable
                      key={monthName}
                      accessibilityRole="button"
                      accessibilityLabel={`${monthName} ${visibleYear}`}
                      onPress={() => chooseMonth(monthIndex)}
                      style={[
                        styles.monthCell,
                        {
                          backgroundColor: selected ? colors.softPlum : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <LoomText style={{
                        color: selected ? colors.primary : colors.foreground,
                        fontFamily: selected ? fonts.semibold : fonts.body,
                        fontSize: 12,
                      }}>{monthName.slice(0, 3)}</LoomText>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
                <View style={styles.weekdayRow}>
                  {weekdays.map((weekday, index) => (
                    <LoomText key={`${weekday}-${index}`} style={[styles.weekday, { color: colors.mutedForeground }]}>
                      {weekday}
                    </LoomText>
                  ))}
                </View>
                <View style={styles.dayGrid}>
                  {cells.map((day, index) => {
                    if (day === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
                    const selected = selectedParts[0] === visibleYear
                      && selectedParts[1] === visibleMonthIndex + 1
                      && selectedParts[2] === day;
                    return (
                      <Pressable
                        key={day}
                        accessibilityRole="button"
                        accessibilityLabel={new Date(visibleYear, visibleMonthIndex, day).toLocaleDateString()}
                        accessibilityState={{ selected }}
                        onPress={() => chooseDay(day)}
                        style={[
                          styles.dayCell,
                          selected && { backgroundColor: colors.primary },
                        ]}
                      >
                        <LoomText style={{
                          color: selected ? colors.card : colors.foreground,
                          fontFamily: selected ? fonts.semibold : fonts.body,
                          fontSize: 13,
                        }}>{day}</LoomText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <View style={[styles.sheetFooter, { borderTopColor: colors.border }]}>
              {value ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { onChange(''); setIsOpen(false); }}
                  style={styles.clearButton}
                >
                  <LoomText style={{ color: colors.destructive, fontFamily: fonts.semibold, fontSize: 12 }}>Clear date</LoomText>
                </Pressable>
              ) : <View />}
              <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)} style={styles.doneButton}>
                <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 12 }}>Done</LoomText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  precisionRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  precisionButton: { minHeight: 34, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dateButton: { minHeight: 46, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 28, 43, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18, minHeight: 410 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15, borderBottomWidth: 1 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 12 },
  calendarNavButton: { width: 38, height: 36, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { width: '14.2857%', textAlign: 'center', fontSize: 11, fontFamily: fonts.semibold, paddingVertical: 6 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  monthCell: { width: '31.8%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  sheetFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  clearButton: { paddingVertical: 10, paddingHorizontal: 4 },
  doneButton: { paddingVertical: 10, paddingHorizontal: 4 },
});
