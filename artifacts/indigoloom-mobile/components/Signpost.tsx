import { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

type Signpost = { id: number; text: string; actionLabel?: string; onAction?: () => void };

let current: Signpost | null = null;
let nextId = 1;
const listeners = new Set<(signpost: Signpost | null) => void>();

function publish(signpost: Signpost | null) {
  current = signpost;
  listeners.forEach((listener) => listener(signpost));
}

// A short, calm note saying what the app just did (and where to find it),
// with an optional action such as Undo. It stays across screens and fades
// after a few seconds.
export function showSignpost(text: string, action?: { label: string; onAction: () => void }) {
  publish({ id: nextId++, text, actionLabel: action?.label, onAction: action?.onAction });
}

export function SignpostHost() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [signpost, setSignpost] = useState<Signpost | null>(current);
  useEffect(() => {
    listeners.add(setSignpost);
    return () => { listeners.delete(setSignpost); };
  }, []);
  useEffect(() => {
    if (!signpost) return;
    const timer = setTimeout(() => { if (current?.id === signpost.id) publish(null); }, 8000);
    return () => clearTimeout(timer);
  }, [signpost]);
  if (!signpost) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 92 }]}>
      <View accessibilityRole="alert" style={[styles.bar, { backgroundColor: colors.primary }]} testID="signpost">
        <LoomText style={[styles.text, { color: colors.primaryForeground }]}>{signpost.text}</LoomText>
        {signpost.actionLabel ? (
          <Pressable accessibilityRole="button" onPress={() => { signpost.onAction?.(); publish(null); }} hitSlop={8} testID="button-signpost-action">
            <LoomText style={[styles.action, { color: colors.primaryForeground }]}>{signpost.actionLabel}</LoomText>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => publish(null)} hitSlop={8}>
          <Feather name="x" size={16} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 560, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 },
  text: { flex: 1, fontSize: 15, lineHeight: 21 },
  action: { fontFamily: fonts.bold, fontSize: 15, textDecorationLine: 'underline' },
});
