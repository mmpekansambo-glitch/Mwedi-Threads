import { useEffect, useMemo, useState } from 'react';
import { useGetProjects } from '@workspace/api-client-react';
import type { ProjectStatus } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, PageHeader, ProjectCard, fonts } from '@/components/loom';
import { Board, WordFilters } from '@/components/paper';
import { SortRow, projectSorts, sortProjects, useSavedSort } from '@/components/Sorting';
import { useColors } from '@/hooks/useColors';

const statusFilters: Array<{ value: ProjectStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'paused', label: 'On pause' },
  { value: 'completed', label: 'Finished' },
];

export default function ProjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [craft, setCraft] = useState<'knitting' | 'crochet' | ''>('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [sort, setSort] = useSavedSort('mwedi:projects-sort', projectSorts);
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status } : {}),
    ...(craft ? { craft } : {}),
    ...(starredOnly ? { starred: true } : {}),
  }), [search, status, craft, starredOnly]);
  const clearFilters = () => { setSearch(''); setStatus(''); setCraft(''); setStarredOnly(false); };
  // The Overview stat cards and chart bars open this tab with a status (or none for All projects).
  // `at` changes on every tap, so tapping the same card twice still resets the filters.
  // The yarn brand card sends `search` instead.
  const link = useLocalSearchParams<{ status?: string; search?: string; at?: string }>();
  useEffect(() => {
    if (!link.at) return;
    clearFilters();
    const linked = statusFilters.find((item) => item.value && item.value === link.status);
    if (linked) setStatus(linked.value);
    if (link.search) setSearch(link.search);
  }, [link.at, link.status, link.search]);
  const query = useGetProjects(params);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 22, paddingBottom: 104 }]}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader title="My projects" action={<Pressable accessibilityRole="button" accessibilityLabel="Add a project" onPress={() => router.push('/projects/new')} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" color={colors.primaryForeground} size={20} /></Pressable>} />
      <WordFilters
        colors={colors}
        items={[...statusFilters.map((item) => ({ value: item.value as string, label: item.label, testID: `button-status-${item.value || 'all'}` })), { value: 'starred', label: 'Starred', testID: 'button-starred-filter' }]}
        selected={(value) => value === 'starred' ? starredOnly : value === '' ? !status && !starredOnly : status === value}
        onSelect={(value) => {
          if (value === 'starred') setStarredOnly(!starredOnly);
          else if (value === '') { setStatus(''); setStarredOnly(false); }
          else setStatus(status === value ? '' : value as ProjectStatus);
        }}
      />
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, pattern or yarn…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          accessibilityLabel="Search projects"
          testID="input-project-search"
        />
        {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      <View style={styles.craftRow}>
        {(['', 'knitting', 'crochet'] as const).map((item) => {
          const active = craft === item;
          return <Pressable key={item || 'craft-all'} onPress={() => setCraft(item)}><LoomText style={{ color: active ? colors.primary : colors.mutedForeground, fontFamily: active ? fonts.semibold : fonts.body, fontSize: 14 }}>{item ? item[0].toUpperCase() + item.slice(1) : 'All crafts'}</LoomText></Pressable>;
        })}
      </View>
      <SortRow options={projectSorts} value={sort} onChange={setSort} testID="project-sort" />
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : query.data?.length ? (
        <>
          <LoomText style={[styles.count, { color: colors.mutedForeground }]}>{query.data.length} {query.data.length === 1 ? 'project' : 'projects'}</LoomText>
          <Board testID="board-projects">{sortProjects(query.data, sort).map((project) => <ProjectCard key={project.id} project={project} />)}</Board>
        </>
      ) : starredOnly && !search && !status && !craft ? (
        <EmptyState title="No starred projects yet" body="Tap the star on any project to keep your favorites here." actionTitle="Show all projects" onAction={clearFilters} />
      ) : search || status || craft || starredOnly ? (
        <EmptyState title="No projects match" body="Try a different search or clear a filter." actionTitle="Clear filters" onAction={clearFilters} />
      ) : (
        <EmptyState title="No projects yet" body="Add your first project to start tracking it." actionTitle="Add a project" onAction={() => router.push('/projects/new')} />
      )}
      <View style={styles.bottomAction}><LoomButton title="Add a project" icon="plus" onPress={() => router.push('/projects/new')} testID="button-add-project" /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 780, width: '100%', alignSelf: 'center', paddingBottom: 24 },
  addButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 2 },
  searchWrap: { minHeight: 46, borderWidth: 1, borderRadius: 2, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body },
  filterRow: { gap: 7, paddingBottom: 6 },
  filterChip: { borderWidth: 1, paddingHorizontal: 12, minHeight: 31, borderRadius: 99, justifyContent: 'center' },
  starredChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  craftRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11, marginBottom: 2 },
  count: { fontSize: 13, marginBottom: 10, fontFamily: fonts.medium },
  bottomAction: { marginTop: 10, marginBottom: 10 },
});
