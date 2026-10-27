import { useEffect, useMemo, useState } from 'react';
import { useGetSewingProjects } from '@workspace/api-client-react';
import type { ProjectStatus } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, PageHeader, fonts } from '@/components/loom';
import { SewingProjectCard } from '@/components/SewingFields';
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
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 18, paddingBottom: 104 }]}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader title="Projects" action={<Pressable accessibilityRole="button" accessibilityLabel="Start a project" onPress={() => router.push('/sewing/new')} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" color={colors.primaryForeground} size={20} /></Pressable>} />
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by name, pattern or size…" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} accessibilityLabel="Search sewing projects" testID="input-sewing-search" />
        {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {statusFilters.map((item) => {
          const active = status === item.value;
          return <Pressable key={item.value || 'all'} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setStatus(item.value)} style={[styles.filterChip, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.border }]}><LoomText style={{ color: active ? colors.accentForeground : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>{item.label}</LoomText></Pressable>;
        })}
      </ScrollView>
      {query.isLoading ? <LoadingState label="Gathering your projects…" /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : query.data?.length ? (
        <>
          <LoomText style={[styles.count, { color: colors.mutedForeground }]}>{query.data.length} {query.data.length === 1 ? 'project' : 'projects'}</LoomText>
          {query.data.map((project) => <SewingProjectCard key={project.id} project={project} />)}
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
  addButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  searchWrap: { minHeight: 46, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body },
  filterRow: { gap: 7, paddingBottom: 12 },
  filterChip: { borderWidth: 1, paddingHorizontal: 12, minHeight: 31, borderRadius: 99, justifyContent: 'center' },
  count: { fontSize: 13, marginBottom: 10, fontFamily: fonts.medium },
  bottomAction: { marginTop: 10, marginBottom: 10 },
});
