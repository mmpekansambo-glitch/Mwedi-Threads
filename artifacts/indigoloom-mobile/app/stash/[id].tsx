import { useGetStashYarn } from '@workspace/api-client-react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ErrorState, LoadingState, SignedInGate } from '@/components/loom';
import { StashYarnForm } from '@/components/StashYarnForm';
import { useColors } from '@/hooks/useColors';

export default function StashYarnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const query = useGetStashYarn(id);
  return (
    <SignedInGate>
      {query.data ? <StashYarnForm key={query.data.id} yarn={query.data} /> : (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background }}>
          {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : <LoadingState label="Finding this yarn…" />}
        </View>
      )}
    </SignedInGate>
  );
}
