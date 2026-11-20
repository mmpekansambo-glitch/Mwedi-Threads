import { useEffect, useMemo, useState } from 'react';
import { useGetSewingProjects } from '@workspace/api-client-react';
import type { ProjectStatus } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, PageHeader, fonts } from '@/components/loom';
import { SewingProjectCard } from '@/components/SewingFields';
import { Board, WordFilters } from '@/components/paper';
import { useSewingColors } from '@/hooks/useColors';

const statusFilters: Array<{ value: ProjectStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'paused', label: 'On pause' },
  { value: 'completed', label: 'Finished' },
];

export default function SewingProjectsScreen() {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status } : {}),
  }), [search, status]);
  const clearFilters = () => { setSearch(''); setStatus(''); };
  // The Overview stat cards open this tab with a status; `at` changes on every tap.
  const link = useLocalSearchParams<{ status?: string; at?: string }>();
  useEffect(() => {
    if (!link.at) return;
    clearFilters();
    const linked = statusFilters.find((item) => item.value && item.value === link.status);
    if (linked) setStatus(linked.value);
  }, [link.at, link.status]);
  const query = useGetSewingProjects(params);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 22, paddingBottom: 104 }]}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader title="Projects" action={<Pressable accessibilityRole="button" accessibilityLabel="Start a project" onPress={() => router.push('/sewing/new')} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" color={colors.primaryForeground} size={20} /></Pressable>} />
      <WordFilters
        colors={colors}
        items={statusFilters.map((item) => ({ value: item.value as string, label: item.label, testID: `button-status-${item.value || 'all'}` }))}
        selected={(value) => status === value}
        onSelect={(value) => setStatus(value === '' || status === value ? '' : value as ProjectStatus)}
      />
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by name, pattern or size…" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} accessibilityLabel="Search sewing projects" testID="input-sewing-search" />
        {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      {query.isLoading ? <LoadingState label="Gathering your projects…" /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : query.data?.length ? (
        <>
          <LoomText style={[styles.count, { color: colors.mutedForeground }]}>{query.data.length} {query.data.length === 1 ? 'project' : 'projects'}</LoomText>
          <Board testID="board-sewing-projects">{query.data.map((project) => <SewingProjectCard key={project.id} project={project} />)}</Board>
        </>
      ) : search || status ? (
        <EmptyState title="No projects match" body="Try a different search or clear a filter." actionTitle="Clear filters" onAction={clearFilters} />
      ) : (
        <EmptyState title="No sewing projects yet" body="Start a project to track it from prep to finish." actionTitle="Start a project" onAction={() => router.push('/sewing/new')} />
      )}
      <View style={styles.bottomAction}><LoomButton title="New project" icon="plus" onPress={() => router.push('/sewing/new')} testID="button-add-sewing-project" /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 780, width: '100%', alignSelf: 'center' },
  addButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 2 },
  searchWrap: { minHeight: 46, borderWidth: 1, borderRadius: 2, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body },
  filterRow: { gap: 7, paddingBottom: 12 },
  filterChip: { borderWidth: 1, paddingHorizontal: 12, minHeight: 31, borderRadius: 99, justifyContent: 'center' },
  count: { fontSize: 13, marginBottom: 10, fontFamily: fonts.medium },
  bottomAction: { marginTop: 10, marginBottom: 10 },
});
