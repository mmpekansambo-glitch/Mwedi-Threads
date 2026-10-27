import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getGetProjectQueryKey, setProjectCounter } from '@workspace/api-client-react';
import type { ProjectDetail } from '@workspace/api-client-react';
import { LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

const SAVE_DELAY_MS = 400;

// A plain counter saved with the project. It never changes progress.
export function ProjectCounter({ projectId, initial }: { projectId: string; initial: number }) {
  const colors = useColors();
  const client = useQueryClient();
  const [count, setCount] = useState(initial);
  const [history, setHistory] = useState<number[]>([]);
  const [saveError, setSaveError] = useState(false);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = () => {
    clearTimeout(timer.current);
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    setProjectCounter(projectId, { count: value })
      .then(() => {
        setSaveError(false);
        client.setQueryData<ProjectDetail>(getGetProjectQueryKey(projectId), (old) => (old ? { ...old, counter: value } : old));
      })
      .catch(() => setSaveError(true));
  };

  const show = (value: number) => {
    setCount(value);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };

  const change = (next: number) => {
    const value = Math.max(0, next);
    if (value === count) return;
    void Haptics.selectionAsync();
    setHistory((past) => [...past.slice(-49), count]);
    show(value);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (previous === undefined) return;
    void Haptics.selectionAsync();
    setHistory((past) => past.slice(0, -1));
    show(previous);
  };

  // Save whatever is waiting when the screen closes.
  useEffect(() => save, []);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="card-project-counter">
      <LoomText serif style={[styles.title, { color: colors.foreground }]}>Counter</LoomText>
      <LoomText serif accessibilityLiveRegion="polite" style={[styles.count, { color: colors.foreground }]} testID="text-counter">{count}</LoomText>
      <View style={styles.buttons}>
        <Pressable accessibilityRole="button" accessibilityLabel="Take one off" disabled={count === 0} onPress={() => change(count - 1)} style={({ pressed }) => [styles.minus, { backgroundColor: colors.quietButton }, count === 0 && styles.disabled, pressed && styles.pressed]} testID="button-counter-minus">
          <Feather name="minus" size={24} color={colors.foreground} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Add one" onPress={() => change(count + 1)} style={({ pressed }) => [styles.plus, { backgroundColor: colors.primary }, pressed && styles.pressed]} testID="button-counter-plus">
          <Feather name="plus" size={44} color={colors.primaryForeground} />
        </Pressable>
        <View style={styles.minus} />
      </View>
      <View style={styles.links}>
        <Pressable accessibilityRole="button" disabled={history.length === 0} onPress={undo} style={[styles.link, history.length === 0 && styles.disabled]} testID="button-counter-undo">
          <Feather name="corner-up-left" size={15} color={colors.mutedForeground} />
          <LoomText style={[styles.linkText, { color: colors.mutedForeground }]}>Undo</LoomText>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={count === 0} onPress={() => change(0)} style={[styles.link, count === 0 && styles.disabled]} testID="button-counter-reset">
          <Feather name="rotate-ccw" size={15} color={colors.mutedForeground} />
          <LoomText style={[styles.linkText, { color: colors.mutedForeground }]}>Reset</LoomText>
        </Pressable>
      </View>
      {saveError ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14, marginTop: 8, textAlign: 'center' }}>We couldn’t save the count. It will try again on your next tap.</LoomText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 17, marginBottom: 13 },
  title: { fontSize: 20 },
  count: { fontSize: 96, lineHeight: 110, textAlign: 'center', fontFamily: fonts.displayBold, marginVertical: 4 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  minus: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 4 },
  linkText: { fontFamily: fonts.semibold, fontSize: 15 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.95 }] },
});
