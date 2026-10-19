import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetSkeinSuggestionsQueryKey, getGetStashYarnQueryKey, getGetStashYarnsQueryKey,
  useAcceptSkeinSuggestion, useDismissSkeinSuggestion, useGetSkeinSuggestions,
} from '@workspace/api-client-react';
import type { GetSkeinSuggestionsParams } from '@workspace/api-client-react';
import { LoomButton, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

function skeins(count: number): string {
  return `${count} ${count === 1 ? 'skein' : 'skeins'}`;
}

// Asks the maker to confirm skeins left after a project is finished.
export function SkeinSuggestions({ projectId }: { projectId?: string }) {
  const colors = useColors();
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
  if (!query.data?.length) return null;
  const busy = accept.isPending || dismiss.isPending;
  return (
    <View style={styles.list}>
      {query.data.map((suggestion) => (
        <View key={suggestion.id} accessibilityRole="summary" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }]} testID={`skein-suggestion-${suggestion.id}`}>
          <LoomText style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>
            <LoomText style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{suggestion.projectTitle}</LoomText> used {skeins(suggestion.skeinsUsed)} of {suggestion.yarnName}. Update skeins left from {suggestion.skeinsLeft} to {suggestion.suggestedLeft}?
          </LoomText>
          <View style={styles.actions}>
            <LoomButton title="Keep as is" variant="quiet" disabled={busy} onPress={() => dismiss.mutate({ suggestionId: suggestion.id }, { onSuccess: () => refresh(suggestion.stashYarnId) })} style={styles.button} testID={`button-keep-skeins-${suggestion.id}`} />
            <LoomButton title={`Update to ${suggestion.suggestedLeft}`} disabled={busy} onPress={() => accept.mutate({ suggestionId: suggestion.id }, { onSuccess: () => refresh(suggestion.stashYarnId) })} style={styles.button} testID={`button-update-skeins-${suggestion.id}`} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginBottom: 14 },
  card: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 13, gap: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { minHeight: 40, paddingHorizontal: 12 },
});
