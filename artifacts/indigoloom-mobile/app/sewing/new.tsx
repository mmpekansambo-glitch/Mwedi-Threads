import { getGetSewingProjectQueryKey, useGetSewingProject } from '@workspace/api-client-react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ErrorState, LoadingState, SignedInGate } from '@/components/loom';
import { SewingProjectForm } from '@/components/SewingProjectForm';
import { useSewingColors } from '@/hooks/useColors';

// Starts a sewing project, or edits one when opened with its id.
export default function SewingProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useSewingColors();
  const query = useGetSewingProject(id ?? '', { query: { enabled: Boolean(id), queryKey: getGetSewingProjectQueryKey(id ?? '') } });
  if (!id) return <SignedInGate><SewingProjectForm /></SignedInGate>;
  return (
    <SignedInGate>
      {query.data ? <SewingProjectForm key={query.data.id} project={query.data} /> : (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background }}>
          {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : <LoadingState label="Finding this project…" />}
        </View>
      )}
    </SignedInGate>
  );
}
