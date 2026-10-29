import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetSkeinSuggestionsQueryKey, getGetStashYarnQueryKey, getGetStashYarnsQueryKey,
  useAcceptSkeinSuggestion, useDismissSkeinSuggestion, useGetSkeinSuggestions,
} from '@workspace/api-client-react';
import type { GetSkeinSuggestionsParams, StashYarn } from '@workspace/api-client-react';
import { ArchiveNudge, usedUp } from '@/components/archive-nudge';

function skeins(count: number): string {
  return `${count} ${count === 1 ? 'skein' : 'skeins'}`;
}

// Asks the maker to confirm skeins left after a project is finished.
export function SkeinSuggestions({ projectId }: { projectId?: string }) {
  const client = useQueryClient();
  const params: GetSkeinSuggestionsParams = projectId ? { projectId } : {};
  const query = useGetSkeinSuggestions(params, { query: { queryKey: getGetSkeinSuggestionsQueryKey(params) } });
  const accept = useAcceptSkeinSuggestion();
  const dismiss = useDismissSkeinSuggestion();
  const refresh = (stashYarnId: string) => {
    void client.invalidateQueries({ queryKey: getGetSkeinSuggestionsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetStashYarnsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetStashYarnQueryKey(stashYarnId) });
  };
  // A yarn this project used the last of gets a gentle offer to archive it.
  const [finished, setFinished] = useState<StashYarn[]>([]);
  if (!query.data?.length && !finished.length) return null;
  const busy = accept.isPending || dismiss.isPending;
  return <div className="skein-suggestions">
    {finished.map((yarn) => <ArchiveNudge key={yarn.id} yarn={yarn} onDone={() => setFinished((current) => current.filter((item) => item.id !== yarn.id))}/>)}
    {(query.data ?? []).map((suggestion) => <div className="skein-suggestion loom-card" role="status" key={suggestion.id} data-testid={`skein-suggestion-${suggestion.id}`}>
      <p><b>{suggestion.projectTitle}</b> used {skeins(suggestion.skeinsUsed)} of {suggestion.yarnName}. Update skeins left from {suggestion.skeinsLeft} to {suggestion.suggestedLeft}?</p>
      <div className="skein-suggestion-actions">
        <button type="button" className="button button-quiet button-small" disabled={busy} onClick={() => dismiss.mutate({ suggestionId: suggestion.id }, { onSuccess: () => refresh(suggestion.stashYarnId) })} data-testid={`button-keep-skeins-${suggestion.id}`}>Keep as is</button>
        <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => accept.mutate({ suggestionId: suggestion.id }, { onSuccess: (yarn) => { refresh(suggestion.stashYarnId); if (usedUp(yarn) && !yarn.archivedAt) setFinished((current) => [...current, yarn]); } })} data-testid={`button-update-skeins-${suggestion.id}`}>Update to {suggestion.suggestedLeft}</button>
      </div>
    </div>)}
  </div>;
}
