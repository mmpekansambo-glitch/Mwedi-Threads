import { getGetSewingPatternQueryKey, useGetSewingPattern } from '@workspace/api-client-react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ErrorState, LoadingState, SignedInGate } from '@/components/loom';
import { SewingPatternForm } from '@/components/SewingPatterns';
import { useSewingColors } from '@/hooks/useColors';

export default function PatternScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useSewingColors();
  const query = useGetSewingPattern(id, { query: { queryKey: getGetSewingPatternQueryKey(id) } });
  return (
    <SignedInGate>
      {query.data ? <SewingPatternForm key={query.data.id} pattern={query.data} /> : (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background }}>
          {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : <LoadingState label="Finding this pattern…" />}
        </View>
      )}
    </SignedInGate>
  );
}
