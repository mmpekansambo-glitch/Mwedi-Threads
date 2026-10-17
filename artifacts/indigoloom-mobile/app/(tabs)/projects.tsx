import { useMemo, useState } from 'react';
import { useGetProjects } from '@workspace/api-client-react';
import type { ProjectStatus } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, PageHeader, ProjectCard, fonts } from '@/components/loom';
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
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status } : {}),
    ...(craft ? { craft } : {}),
    ...(starredOnly ? { starred: true } : {}),
  }), [search, status, craft, starredOnly]);
  const clearFilters = () => { setSearch(''); setStatus(''); setCraft(''); setStarredOnly(false); };
  const query = useGetProjects(params);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 104 }]}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader title="My projects" action={<Pressable accessibilityRole="button" accessibilityLabel="Add a project" onPress={() => router.push('/projects/new')} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" color={colors.primaryForeground} size={20} /></Pressable>} />
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Find a project…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          accessibilityLabel="Search projects"
          testID="input-project-search"
        />
        {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: starredOnly }} onPress={() => setStarredOnly(!starredOnly)} style={[styles.filterChip, styles.starredChip, { backgroundColor: starredOnly ? colors.accent : colors.card, borderColor: starredOnly ? colors.accent : colors.border }]} testID="button-starred-filter"><Feather name="star" size={12} color={starredOnly ? colors.primary : colors.mutedForeground} /><LoomText style={{ color: starredOnly ? colors.accentForeground : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>Starred</LoomText></Pressable>
        {statusFilters.map((item) => {
          const active = status === item.value;
          return <Pressable key={item.value || 'all'} onPress={() => setStatus(item.value)} style={[styles.filterChip, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.border }]}><LoomText style={{ color: active ? colors.accentForeground : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>{item.label}</LoomText></Pressable>;
        })}
      </ScrollView>
      <View style={styles.craftRow}>
        <Feather name="filter" size={14} color={colors.mutedForeground} />
        {(['', 'knitting', 'crochet'] as const).map((item) => {
          const active = craft === item;
          return <Pressable key={item || 'craft-all'} onPress={() => setCraft(item)}><LoomText style={{ color: active ? colors.primary : colors.mutedForeground, fontFamily: active ? fonts.semibold : fonts.body, fontSize: 14 }}>{item ? item[0].toUpperCase() + item.slice(1) : 'All crafts'}</LoomText></Pressable>;
        })}
      </View>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : query.data?.length ? (
        <>
          <LoomText style={[styles.count, { color: colors.mutedForeground }]}>{query.data.length} {query.data.length === 1 ? 'project' : 'projects'} in your collection</LoomText>
          {query.data.map((project) => <ProjectCard key={project.id} project={project} />)}
        </>
      ) : starredOnly && !search && !status && !craft ? (
        <EmptyState title="No starred projects yet." body="Tap the star on any project to keep your favorites here." actionTitle="Show all projects" onAction={clearFilters} />
      ) : search || status || craft || starredOnly ? (
        <EmptyState title="Nothing in this little corner yet." body="Try a different search or clear a filter to see more projects." actionTitle="Clear filters" onAction={clearFilters} />
      ) : (
        <EmptyState title="Your next project starts here." body="Gather a pattern, choose a yarn, and give your next idea its own little page." actionTitle="Add a project" onAction={() => router.push('/projects/new')} />
      )}
      <View style={styles.bottomAction}><LoomButton title="Add a project" icon="plus" onPress={() => router.push('/projects/new')} testID="button-add-project" /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 780, width: '100%', alignSelf: 'center', paddingBottom: 24 },
  addButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  searchWrap: { minHeight: 46, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body },
  filterRow: { gap: 7, paddingBottom: 6 },
  filterChip: { borderWidth: 1, paddingHorizontal: 12, minHeight: 31, borderRadius: 99, justifyContent: 'center' },
  starredChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  craftRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11, marginBottom: 2 },
  count: { fontSize: 13, marginBottom: 10, fontFamily: fonts.medium },
  bottomAction: { marginTop: 10, marginBottom: 10 },
});
