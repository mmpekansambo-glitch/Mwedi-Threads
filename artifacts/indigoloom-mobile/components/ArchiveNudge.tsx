import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  getGetSewingToolsQueryKey, getGetStashFabricsQueryKey, getGetStashYarnsQueryKey, refreshPaths, showRemoved,
  updateSewingTool, updateStashFabric, updateStashYarn,
} from '@workspace/api-client-react';
import type { SewingTool, StashFabric, StashYarn } from '@workspace/api-client-react';
import { LoomButton, LoomText, fonts } from '@/components/loom';
import { showSignpost } from '@/components/Signpost';
import { fabricName } from '@/components/FabricFields';
import { useColors, useSewingColors } from '@/hooks/useColors';

// What the Archive needs to know about each kind of thing that gets used up.
type ArchiveKind<T extends { id: string }> = {
  name: (item: T) => string;
  move: (item: T, archived: boolean) => Promise<unknown>;
  listKey: QueryKey;
  paths: string[];
  where: string;
  linked: string;
  sewing: boolean;
};

export const yarnArchive: ArchiveKind<StashYarn> = {
  name: (yarn) => [yarn.brand, yarn.subBrand, yarn.color].filter(Boolean).join(' '),
  move: (yarn, archived) => updateStashYarn(yarn.id, { archived }),
  listKey: getGetStashYarnsQueryKey(),
  paths: ['/api/yarn-stash/'],
  where: 'under Archive on the Yarn stash tab',
  linked: 'It stays linked to its projects.',
  sewing: false,
};

export const fabricArchive: ArchiveKind<StashFabric> = {
  name: (fabric) => fabricName(fabric),
  move: (fabric, archived) => updateStashFabric(fabric.id, { archived }),
  listKey: getGetStashFabricsQueryKey(),
  paths: ['/api/fabric-stash/', '/api/sewing-overview'],
  where: 'under Archive on the Fabric tab',
  linked: 'It stays linked to its projects.',
  sewing: true,
};

export const toolArchive: ArchiveKind<SewingTool> = {
  name: (tool) => tool.name,
  move: (tool, archived) => updateSewingTool(tool.id, { archived }),
  listKey: getGetSewingToolsQueryKey(),
  paths: ['/api/sewing-tools/'],
  where: 'under Archive on the Tools tab',
  linked: 'It stays on the projects that list it.',
  sewing: true,
};

// Skeins left counts as the number bought when it was left blank.
export function usedUp(yarn: Pick<StashYarn, 'skeinsPurchased' | 'skeinsLeft'>): boolean {
  return (yarn.skeinsLeft ?? yarn.skeinsPurchased) === 0;
}

export function fabricUsedUp(fabric: Pick<StashFabric, 'amount' | 'amountLeft'>): boolean {
  return (fabric.amountLeft ?? fabric.amount) === 0;
}

// Only notions get used up; kit never goes in the Archive.
export function toolUsedUp(tool: Pick<SewingTool, 'section' | 'quantity'>): boolean {
  return tool.section === 'notions' && tool.quantity === 0;
}

// Moves something to the Archive (or back) and signposts where it went,
// with an Undo.
export function useArchive<T extends { id: string }>(kind: ArchiveKind<T>) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: kind.listKey });
    refreshPaths(client, ...kind.paths);
  };
  const restore = async (item: T) => {
    await kind.move(item, false);
    refresh();
    showSignpost(`${kind.name(item)} is back in your stash.`);
  };
  const archive = async (item: T) => {
    await kind.move(item, true);
    showRemoved(client, kind.listKey, item.id);
    refresh();
    showSignpost(`Moved ${kind.name(item)} to your Archive. Find it ${kind.where}.`, {
      label: 'Undo',
      onAction: () => { void restore(item); },
    });
  };
  return { archive, restore };
}

export function useYarnArchive() {
  return useArchive(yarnArchive);
}

function useKindColors(sewing: boolean) {
  const yarn = useColors();
  const sew = useSewingColors();
  return sewing ? sew : yarn;
}

// A gentle offer to archive something that's all used up. Nothing moves
// until the maker says so.
export function UsedUpNudge<T extends { id: string }>({ item, kind, onDone }: { item: T; kind: ArchiveKind<T>; onDone: () => void }) {
  const colors = useKindColors(kind.sewing);
  const { archive } = useArchive(kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const move = async () => {
    setBusy(true);
    try { await archive(item); onDone(); } catch { setError('We could not move it just now. Please try again.'); setBusy(false); }
  };
  return (
    <View accessibilityRole="summary" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }]} testID={`archive-nudge-${item.id}`}>
      <LoomText style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>
        <LoomText style={{ fontFamily: fonts.semibold, fontSize: 15 }}>All used up. </LoomText>Move {kind.name(item)} to your Archive? {kind.linked}
      </LoomText>
      {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14 }}>{error}</LoomText> : null}
      <View style={styles.actions}>
        <LoomButton title="Keep in stash" variant="quiet" disabled={busy} onPress={onDone} style={styles.button} testID="button-keep-in-stash" />
        <LoomButton title="Move to Archive" busy={busy} onPress={() => { void move(); }} style={styles.button} testID="button-move-to-archive" />
      </View>
    </View>
  );
}

export function ArchiveNudge({ yarn, onDone }: { yarn: StashYarn; onDone: () => void }) {
  return <UsedUpNudge item={yarn} kind={yarnArchive} onDone={onDone} />;
}

// Shown on something in the Archive, with a way to bring it back.
export function ArchivedNote<T extends { id: string }>({ item, kind, text, onRestored }: { item: T; kind: ArchiveKind<T>; text: string; onRestored: () => void }) {
  const colors = useKindColors(kind.sewing);
  const { restore } = useArchive(kind);
  const [busy, setBusy] = useState(false);
  return (
    <View accessibilityRole="summary" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }]} testID="archived-note">
      <LoomText style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>
        <LoomText style={{ fontFamily: fonts.semibold, fontSize: 15 }}>In your Archive. </LoomText>{text}
      </LoomText>
      <View style={styles.actions}>
        <LoomButton title="Move back to stash" variant="quiet" busy={busy} onPress={() => { setBusy(true); void restore(item).then(onRestored).catch(() => setBusy(false)); }} style={styles.button} testID="button-unarchive" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 13, gap: 10, marginBottom: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { minHeight: 40, paddingHorizontal: 12 },
});
