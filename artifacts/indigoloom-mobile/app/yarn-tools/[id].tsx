import { getGetYarnToolQueryKey, useGetYarnTool } from '@workspace/api-client-react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ErrorState, LoadingState, SignedInGate } from '@/components/loom';
import { YarnToolForm } from '@/components/YarnTools';
import { useColors } from '@/hooks/useColors';

export default function YarnToolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const query = useGetYarnTool(id, { query: { queryKey: getGetYarnToolQueryKey(id) } });
  return (
    <SignedInGate>
      {query.data ? <YarnToolForm key={query.data.id} tool={query.data} /> : (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background }}>
          {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : <LoadingState label="Finding this tool…" />}
        </View>
      )}
    </SignedInGate>
  );
}
