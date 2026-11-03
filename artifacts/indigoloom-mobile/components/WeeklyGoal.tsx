import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { checkInWeeklyGoal, getGetWeeklyGoalQueryKey, setWeeklyGoal, useGetWeeklyGoal } from '@workspace/api-client-react';
import type { GetWeeklyGoalParams, Studio, WeeklyGoal } from '@workspace/api-client-react';
import { LoomText, fonts } from '@/components/loom';
import { ITEM_HEIGHT, Wheel } from '@/components/ProjectDateField';
import colorTokens from '@/constants/colors';
import { useScheme } from '@/hooks/useAppearance';
import { useColors, useSewingColors } from '@/hooks/useColors';

const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const goalItems = Array.from({ length: 7 }, (_, index) => (index === 0 ? '1 day' : `${index + 1} days`));

// The maker's own date and time zone, so the week turns over at their midnight.
function weekParams(studio: Studio): GetWeeklyGoalParams {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  let timeZone: string | undefined;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { timeZone = undefined; }
  return { studio, today, ...(timeZone ? { timeZone } : {}) };
}

// "This week" at the top of each studio's Overview: crafting days against the
// weekly goal. A day fills in from a journal note, the row counter or the
// button here.
export function WeeklyGoalCard({ studio }: { studio: Studio }) {
  const yarnColors = useColors();
  const sewingColors = useSewingColors();
  const base = studio === 'sewing' ? sewingColors : yarnColors;
  // In dark mode the card itself turns bright; the goal picker sheet keeps the normal colors.
  const colors = useScheme() === 'dark' ? { ...base, ...colorTokens.weekBright[studio] } : base;
  const client = useQueryClient();
  const params = weekParams(studio);
  const key = getGetWeeklyGoalQueryKey(params);
  const query = useGetWeeklyGoal(params, { query: { queryKey: key } });
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  // Tabs stay open in the background, so check again each time the
  // Overview comes back into view (a note or counter tap may have counted).
  const { refetch } = query;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  const week = query.data;
  if (!week || !Array.isArray(week.days)) return null;

  const run = async (action: () => Promise<WeeklyGoal>) => {
    setBusy(true);
    setProblem('');
    try {
      client.setQueryData(key, await action());
      setPicking(false);
    } catch {
      setProblem("That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const saveGoal = (goal: number | null) => run(() => setWeeklyGoal({ goal }, params));
  const openPicker = () => { setDraft(Math.max(0, (week.goal ?? 3) - 1)); setPicking(true); };
  const met = week.goal !== null && week.count >= week.goal;
  const todayIndex = (new Date().getDay() + 6) % 7;
  const outline = [styles.outlineButton, { borderColor: colors.accent }];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`card-weekly-goal-${studio}`}>
      <View style={styles.head}>
        <LoomText serif style={{ fontSize: 22, color: colors.foreground }}>This week</LoomText>
        {week.goal !== null ? (
          <Pressable accessibilityRole="button" onPress={openPicker} hitSlop={10} testID="button-change-weekly-goal">
            <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>Change</LoomText>
          </Pressable>
        ) : null}
      </View>
      {week.goal === null ? (
        <>
          <LoomText style={[styles.sub, { color: colors.mutedForeground }]}>{week.count === 1 ? '1 day so far' : `${week.count} days so far`}</LoomText>
          <Pressable accessibilityRole="button" onPress={openPicker} style={({ pressed }) => [outline, pressed && styles.pressed]} testID="button-set-weekly-goal">
            <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 16 }}>Set a weekly goal</LoomText>
          </Pressable>
        </>
      ) : (
        <>
          {met ? <View style={[styles.met, { backgroundColor: colors.selectedWash }]}><LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 13 }} testID="text-weekly-goal-met">Goal met</LoomText></View> : null}
          <View style={styles.countRow} testID="text-weekly-goal-count">
            <LoomText serif style={{ fontSize: 34, lineHeight: 40, color: colors.foreground }}>{week.count}</LoomText>
            <LoomText style={{ fontSize: 17, color: colors.mutedForeground }}>of {week.goal} {week.goal === 1 ? 'day' : 'days'}</LoomText>
          </View>
          <View style={styles.days}>
            {week.days.map((done, index) => (
              <View key={index} style={styles.day} accessible accessibilityLabel={`${dayNames[index]}${done ? ', crafted' : ''}`}>
                <View style={[styles.square, { backgroundColor: done ? colors.primary : colors.muted }, index === todayIndex && { borderWidth: 2, borderColor: colors.accent }]} />
                <LoomText style={{ fontSize: 12, color: colors.mutedForeground }}>{dayLetters[index]}</LoomText>
              </View>
            ))}
          </View>
          {week.weeksInARow >= 2 ? <LoomText style={[styles.sub, { color: colors.mutedForeground }]} testID="text-weeks-in-a-row">{week.weeksInARow} weeks in a row</LoomText> : null}
          {week.todayCounted ? (
            <View style={[styles.today, { backgroundColor: colors.muted }]}>
              <LoomText style={{ color: colors.mutedForeground, fontSize: 16 }} testID="text-today-counted">Today counted</LoomText>
            </View>
          ) : (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(() => checkInWeeklyGoal(params))} style={({ pressed }) => [outline, pressed && styles.pressed]} testID="button-weekly-check-in">
              <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 16 }}>{studio === 'sewing' ? 'I sewed today' : 'I crafted today'}</LoomText>
            </Pressable>
          )}
        </>
      )}
      {problem ? <LoomText style={{ color: colors.destructive, marginTop: 8 }}>{problem}</LoomText> : null}
      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel="Close goal picker" onPress={() => setPicking(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: base.card }]}>
            <View style={styles.sheetHeading}>
              <Pressable accessibilityRole="button" onPress={() => setPicking(false)} style={styles.headingButton}>
                <LoomText style={{ color: base.mutedForeground, fontSize: 16 }}>Cancel</LoomText>
              </Pressable>
              <LoomText serif style={{ color: base.foreground, fontSize: 20 }}>Days per week</LoomText>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveGoal(draft + 1)} style={styles.headingButton} testID="button-save-weekly-goal">
                <LoomText style={{ color: base.primaryText, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'right' }}>Save</LoomText>
              </Pressable>
            </View>
            <View style={[styles.wheels, { backgroundColor: base.selectedWash }]}>
              <View pointerEvents="none" style={[styles.wheelBand, { borderColor: base.accent }]} />
              <Wheel label="Days per week" items={goalItems} index={draft} onChange={setDraft} flex={1} testID="input-weekly-goal-wheel" />
            </View>
            {week.goal !== null ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveGoal(null)} style={styles.turnOff} testID="button-turn-off-weekly-goal">
                <LoomText style={{ color: base.mutedForeground, fontFamily: fonts.semibold, fontSize: 15 }}>Turn off goal</LoomText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sub: { fontSize: 15, marginTop: 6 },
  met: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3, marginTop: 8 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  days: { flexDirection: 'row', gap: 6, marginTop: 10 },
  day: { flex: 1, alignItems: 'center', gap: 4 },
  square: { alignSelf: 'stretch', height: 30, borderRadius: 9 },
  outlineButton: { minHeight: 46, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  pressed: { opacity: 0.75 },
  today: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 47, 22, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  headingButton: { minWidth: 64, paddingVertical: 10 },
  wheels: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', paddingHorizontal: 6 },
  wheelBand: { position: 'absolute', left: 8, right: 8, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, borderTopWidth: 1.5, borderBottomWidth: 1.5 },
  turnOff: { alignItems: 'center', paddingVertical: 14 },
});
