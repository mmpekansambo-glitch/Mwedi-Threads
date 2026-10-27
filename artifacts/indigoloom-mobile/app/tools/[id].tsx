import { getGetSewingToolQueryKey, useGetSewingTool } from '@workspace/api-client-react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ErrorState, LoadingState, SignedInGate } from '@/components/loom';
import { SewingToolForm } from '@/components/SewingTools';
import { useSewingColors } from '@/hooks/useColors';

export default function ToolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useSewingColors();
  const query = useGetSewingTool(id, { query: { queryKey: getGetSewingToolQueryKey(id) } });
  return (
    <SignedInGate>
      {query.data ? <SewingToolForm key={query.data.id} tool={query.data} /> : (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background }}>
          {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : <LoadingState label="Finding this tool…" />}
        </View>
      )}
    </SignedInGate>
  );
}
