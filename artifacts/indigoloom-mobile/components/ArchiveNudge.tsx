import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getGetStashYarnsQueryKey, refreshPaths, showRemoved, updateStashYarn } from '@workspace/api-client-react';
import type { StashYarn } from '@workspace/api-client-react';
import { LoomButton, LoomText, fonts } from '@/components/loom';
import { showSignpost } from '@/components/Signpost';
import { useColors } from '@/hooks/useColors';

function yarnLabel(yarn: Pick<StashYarn, 'brand' | 'subBrand' | 'color'>): string {
  return [yarn.brand, yarn.subBrand, yarn.color].filter(Boolean).join(' ');
}

// Skeins left counts as the number bought when it was left blank.
export function usedUp(yarn: Pick<StashYarn, 'skeinsPurchased' | 'skeinsLeft'>): boolean {
  return (yarn.skeinsLeft ?? yarn.skeinsPurchased) === 0;
}

// Moves a yarn to the Archive (or back) and signposts where it went, with
// an Undo.
export function useYarnArchive() {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: getGetStashYarnsQueryKey() });
    refreshPaths(client, '/api/yarn-stash/');
  };
  const restore = async (yarn: StashYarn) => {
    await updateStashYarn(yarn.id, { archived: false });
    refresh();
    showSignpost(`${yarnLabel(yarn)} is back in your stash.`);
  };
  const archive = async (yarn: StashYarn) => {
    await updateStashYarn(yarn.id, { archived: true });
    showRemoved(client, getGetStashYarnsQueryKey(), yarn.id);
    refresh();
    showSignpost(`Moved ${yarnLabel(yarn)} to your Archive. Find it under Archive on the Yarn stash tab.`, {
      label: 'Undo',
      onAction: () => { void restore(yarn); },
    });
  };
  return { archive, restore };
}

// A gentle offer to archive a yarn that's all used up. Nothing moves until
// the maker says so.
export function ArchiveNudge({ yarn, onDone }: { yarn: StashYarn; onDone: () => void }) {
  const colors = useColors();
  const { archive } = useYarnArchive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const move = async () => {
    setBusy(true);
    try { await archive(yarn); onDone(); } catch { setError('We could not move it just now. Please try again.'); setBusy(false); }
  };
  return (
    <View accessibilityRole="summary" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }]} testID={`archive-nudge-${yarn.id}`}>
      <LoomText style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>
        <LoomText style={{ fontFamily: fonts.semibold, fontSize: 15 }}>All used up. </LoomText>Move {yarnLabel(yarn)} to your Archive? It stays linked to its projects.
      </LoomText>
      {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14 }}>{error}</LoomText> : null}
      <View style={styles.actions}>
        <LoomButton title="Keep in stash" variant="quiet" disabled={busy} onPress={onDone} style={styles.button} testID="button-keep-in-stash" />
        <LoomButton title="Move to Archive" busy={busy} onPress={() => { void move(); }} style={styles.button} testID="button-move-to-archive" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 13, gap: 10, marginBottom: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { minHeight: 40, paddingHorizontal: 12 },
});
