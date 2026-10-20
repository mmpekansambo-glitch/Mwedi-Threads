import { useGetStashFabric } from '@workspace/api-client-react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ErrorState, LoadingState, SignedInGate } from '@/components/loom';
import { FabricForm } from '@/components/FabricForm';
import { useSewingColors } from '@/hooks/useColors';

export default function FabricScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useSewingColors();
  const query = useGetStashFabric(id);
  return (
    <SignedInGate>
      {query.data ? <FabricForm key={query.data.id} fabric={query.data} /> : (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background }}>
          {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : <LoadingState label="Finding this fabric…" />}
        </View>
      )}
    </SignedInGate>
  );
}
