import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetStashYarnsQueryKey, refreshPaths, showRemoved, updateStashYarn } from '@workspace/api-client-react';
import type { StashYarn } from '@workspace/api-client-react';
import { showSignpost } from '@/components/signpost';

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
    showSignpost(`Moved ${yarnLabel(yarn)} to your Archive. Find it under Archive on the Yarn stash page.`, {
      label: 'Undo',
      onAction: () => { void restore(yarn); },
    });
  };
  return { archive, restore };
}

// A gentle offer to archive a yarn that's all used up. Nothing moves until
// the maker says so.
export function ArchiveNudge({ yarn, onDone }: { yarn: StashYarn; onDone: () => void }) {
  const { archive } = useYarnArchive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const move = async () => {
    setBusy(true);
    try { await archive(yarn); onDone(); } catch { setError('We couldn’t move it just now. Please try again.'); setBusy(false); }
  };
  return <div className="skein-suggestion loom-card" role="status" data-testid={`archive-nudge-${yarn.id}`}>
    <p><b>All used up.</b> Move {yarnLabel(yarn)} to your Archive? It stays linked to its projects.{error && <span className="field-error" role="alert"> {error}</span>}</p>
    <div className="skein-suggestion-actions">
      <button type="button" className="button button-quiet button-small" disabled={busy} onClick={onDone} data-testid="button-keep-in-stash">Keep in stash</button>
      <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => void move()} data-testid="button-move-to-archive">{busy ? 'Moving…' : 'Move to Archive'}</button>
    </div>
  </div>;
}
