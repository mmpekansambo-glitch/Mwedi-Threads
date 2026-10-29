import { useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  getGetSewingToolsQueryKey, getGetStashFabricsQueryKey, getGetStashYarnsQueryKey, refreshPaths, showRemoved,
  updateSewingTool, updateStashFabric, updateStashYarn,
} from '@workspace/api-client-react';
import type { SewingTool, StashFabric, StashYarn } from '@workspace/api-client-react';
import { showSignpost } from '@/components/signpost';
import { fabricName } from '@/components/fabric-fields';

// What the Archive needs to know about each kind of thing that gets used up.
type ArchiveKind<T extends { id: string }> = {
  name: (item: T) => string;
  move: (item: T, archived: boolean) => Promise<unknown>;
  listKey: QueryKey;
  paths: string[];
  where: string;
  linked: string;
};

export const yarnArchive: ArchiveKind<StashYarn> = {
  name: (yarn) => [yarn.brand, yarn.subBrand, yarn.color].filter(Boolean).join(' '),
  move: (yarn, archived) => updateStashYarn(yarn.id, { archived }),
  listKey: getGetStashYarnsQueryKey(),
  paths: ['/api/yarn-stash/'],
  where: 'under Archive on the Yarn stash page',
  linked: 'It stays linked to its projects.',
};

export const fabricArchive: ArchiveKind<StashFabric> = {
  name: (fabric) => fabricName(fabric),
  move: (fabric, archived) => updateStashFabric(fabric.id, { archived }),
  listKey: getGetStashFabricsQueryKey(),
  paths: ['/api/fabric-stash/', '/api/sewing-overview'],
  where: 'under Archive on the Fabric stash page',
  linked: 'It stays linked to its projects.',
};

export const toolArchive: ArchiveKind<SewingTool> = {
  name: (tool) => tool.name,
  move: (tool, archived) => updateSewingTool(tool.id, { archived }),
  listKey: getGetSewingToolsQueryKey(),
  paths: ['/api/sewing-tools/'],
  where: 'under Archive on the Tools page',
  linked: 'It stays on the projects that list it.',
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

// A gentle offer to archive something that's all used up. Nothing moves
// until the maker says so.
export function UsedUpNudge<T extends { id: string }>({ item, kind, onDone }: { item: T; kind: ArchiveKind<T>; onDone: () => void }) {
  const { archive } = useArchive(kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const move = async () => {
    setBusy(true);
    try { await archive(item); onDone(); } catch { setError('We couldn’t move it just now. Please try again.'); setBusy(false); }
  };
  return <div className="skein-suggestion loom-card" role="status" data-testid={`archive-nudge-${item.id}`}>
    <p><b>All used up.</b> Move {kind.name(item)} to your Archive? {kind.linked}{error && <span className="field-error" role="alert"> {error}</span>}</p>
    <div className="skein-suggestion-actions">
      <button type="button" className="button button-quiet button-small" disabled={busy} onClick={onDone} data-testid="button-keep-in-stash">Keep in stash</button>
      <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => void move()} data-testid="button-move-to-archive">{busy ? 'Moving…' : 'Move to Archive'}</button>
    </div>
  </div>;
}

export function ArchiveNudge({ yarn, onDone }: { yarn: StashYarn; onDone: () => void }) {
  return <UsedUpNudge item={yarn} kind={yarnArchive} onDone={onDone}/>;
}

// Shown on something in the Archive, with a way to bring it back.
export function ArchivedNote<T extends { id: string }>({ item, kind, text, onRestored }: { item: T; kind: ArchiveKind<T>; text: string; onRestored: () => void }) {
  const { restore } = useArchive(kind);
  const [busy, setBusy] = useState(false);
  return <div className="skein-suggestion loom-card" role="status" data-testid="archived-note">
    <p><b>In your Archive.</b> {text}</p>
    <div className="skein-suggestion-actions">
      <button type="button" className="button button-outline button-small" disabled={busy} onClick={() => { setBusy(true); void restore(item).then(onRestored).catch(() => setBusy(false)); }} data-testid="button-unarchive">Move back to stash</button>
    </div>
  </div>;
}
