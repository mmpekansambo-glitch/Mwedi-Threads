import { useGetDashboard } from '@workspace/api-client-react';
import { useUser } from '@clerk/expo';
import { Link, Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DashboardCharts } from '@/components/DashboardCharts';
import { Board, OverviewGreeting, PinnedSwatch, SectionTitle, StitchDivider } from '@/components/paper';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, ProjectCard, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';
import { WeeklyGoalCard } from '@/components/WeeklyGoal';
import { HomeSwitcher, ProfileMenu, useCrafts } from '@/components/Crafts';

// Opens My projects filtered to one status; an empty status shows every project.
function openProjects(status: string) {
  router.push({ pathname: '/(tabs)/projects', params: { status, at: String(Date.now()) } });
}

// Opens My projects searched for one yarn brand.
function searchProjects(search: string) {
  router.push({ pathname: '/(tabs)/projects', params: { search, at: String(Date.now()) } });
}

// "Big Twist & Lion Brand", or "A, B & C" for three or more.
// Two tied brands fit side by side; with more, the card names the first and
// counts the rest in the line below.
function joinBrands(brands: string[]) {
  if (brands.length > 2) return brands[0];
  return brands.length < 2 ? brands[0] ?? '' : `${brands[0]} & ${brands[1]}`;
}

function brandDetail(brands: string[], projects: number) {
  const on = `On ${projects} ${projects === 1 ? 'project' : 'projects'}${brands.length > 1 ? ' each' : ''}`;
  return brands.length > 2 ? `${on}, tied with ${brands.length - 1} more` : on;
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const crafts = useCrafts().data;
  const query = useGetDashboard();
  const data = query.data;
  const displayName = user?.firstName || user?.username || 'maker';
  // A maker with only sewing on starts in the Sewing room.
  if (crafts && !crafts.yarn) return <Redirect href="/(tabs)/sewing" />;
  const onTheHook = data ? [...data.recentProjects].sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress')) : [];
  const pickUp = data?.recentProjects.find((project) => project.status === 'in_progress');
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 22, paddingBottom: 120 }]}
    >
      <OverviewGreeting
        name={displayName}
        colors={colors}
        top={<View style={styles.topBar}><HomeSwitcher /><ProfileMenu /></View>}
        counts={data ? [
          { label: `${data.totalProjects} ${data.totalProjects === 1 ? 'project' : 'projects'}`, onPress: () => openProjects(''), testID: 'button-stat-all' },
          { label: `${data.activeProjects} in progress`, onPress: () => openProjects('in_progress'), testID: 'button-stat-in_progress' },
          { label: `${data.completedProjects} finished`, onPress: () => openProjects('completed'), testID: 'button-stat-completed' },
        ] : []}
      />
      <WeeklyGoalCard studio="yarn" />
      {pickUp ? (
        <PinnedSwatch colors={colors} tilt={-1.5} pin={0} tone={0} style={styles.pickUp} testID="card-pick-up">
          <LoomText style={[styles.small, { color: colors.mutedForeground }]}>Pick up where you left off</LoomText>
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/projects/[id]', params: { id: pickUp.id } })} testID="link-pick-up">
            <LoomText serif style={[styles.pickUpTitle, { color: colors.foreground }]}>{pickUp.title}{pickUp.counter > 0 ? ` · row ${pickUp.counter}` : ` · ${pickUp.completionPercent}%`}</LoomText>
          </Pressable>
        </PinnedSwatch>
      ) : null}
      {query.isLoading ? <LoadingState /> : query.isError || !data ? <ErrorState onRetry={() => void query.refetch()} /> : (
        <>
          <StitchDivider colors={colors} />
          <SectionTitle title="Notes" colors={colors} />
          {data.recentProgress.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.notesScroll} contentContainerStyle={styles.notes}>
              {data.recentProgress.slice(0, 4).map((entry, index) => (
                <PinnedSwatch key={`${entry.projectId}-${entry.createdAt}`} colors={colors} tilt={[-1.5, 1, -0.5, 1.5][index]} pin={index} tone={index} style={styles.note}>
                  <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/projects/[id]', params: { id: entry.projectId } })} testID={`link-progress-note-${index}`}>
                    <LoomText serif style={[styles.noteProject, { color: colors.foreground }]} numberOfLines={1}>{entry.projectTitle}</LoomText>
                    <LoomText numberOfLines={3} style={[styles.noteCopy, { color: colors.foreground }]}>{entry.notes}</LoomText>
                    <LoomText style={[styles.small, { color: colors.mutedForeground, marginTop: 8 }]}>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · now {entry.completionPercent}%</LoomText>
                  </Pressable>
                </PinnedSwatch>
              ))}
            </ScrollView>
          ) : <LoomText style={[styles.emptyLine, { color: colors.mutedForeground }]}>No notes yet. Notes you add on a project show up here.</LoomText>}
          <StitchDivider colors={colors} />
          <SectionTitle title="On the hook" colors={colors} action={<Link href="/(tabs)/projects" style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>All projects</Link>} />
          {onTheHook.length ? <Board>{onTheHook.slice(0, 4).map((project) => <ProjectCard key={project.id} project={project} />)}</Board> : (
            <EmptyState title="No projects yet" body="Add your first project to start tracking it." actionTitle="Add a project" onAction={() => router.push('/projects/new')} />
          )}
          <LoomButton title="New project" icon="plus" onPress={() => router.push('/projects/new')} style={{ marginTop: 14 }} testID="button-new-project" />
          <StitchDivider colors={colors} />
          <View style={styles.stats}>
            {/* A single brand opens My projects searched for it; a tie has no one brand to search. */}
            <Pressable
              accessibilityRole={data.mostUsedYarnBrands.length === 1 ? 'button' : undefined}
              disabled={data.mostUsedYarnBrands.length !== 1}
              onPress={() => searchProjects(data.mostUsedYarnBrands[0])}
              style={({ pressed }) => [styles.stat, { backgroundColor: colors.statBrand }, pressed && styles.statPressed]}
              testID="button-stat-top-brand"
            >
              <LoomText style={[styles.statLabel, { color: colors.mutedForeground }]}>Most-used yarn brand</LoomText>
              <LoomText serif numberOfLines={3} style={[styles.statBrand, { color: colors.foreground }]}>{data.mostUsedYarnBrands.length ? joinBrands(data.mostUsedYarnBrands) : '—'}</LoomText>
              {data.mostUsedYarnBrands.length > 0 && (
                <LoomText style={[styles.statDetail, { color: colors.mutedForeground }]}>
                  {brandDetail(data.mostUsedYarnBrands, data.mostUsedYarnBrandProjects)}
                </LoomText>
              )}
            </Pressable>
            <View style={[styles.stat, { backgroundColor: colors.statAverage }]} testID="card-stat-average-days">
              <LoomText style={[styles.statLabel, { color: colors.mutedForeground }]}>Average days to finish</LoomText>
              <LoomText serif style={[styles.statValue, { color: colors.foreground }]}>{data.averageDaysToFinish ?? '—'}</LoomText>
            </View>
          </View>
          <DashboardCharts charts={data.charts} onPickStatus={openProjects} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 780, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, zIndex: 2 },
  small: { fontSize: 13, fontFamily: fonts.medium },
  pickUp: { marginTop: 18, alignSelf: 'flex-start', maxWidth: '100%' },
  pickUpTitle: { fontSize: 21, marginTop: 4 },
  notesScroll: { marginHorizontal: -20 },
  notes: { gap: 14, paddingHorizontal: 20, paddingVertical: 10 },
  note: { width: 210 },
  noteProject: { fontSize: 19 },
  noteCopy: { fontSize: 15, lineHeight: 21, marginTop: 4 },
  emptyLine: { fontSize: 15 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  stat: { flex: 1, minHeight: 108, justifyContent: 'space-between', borderRadius: 3, padding: 12, overflow: 'hidden' },
  statPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  statLabel: { fontFamily: fonts.semibold, fontSize: 14 },
  statValue: { fontSize: 34, lineHeight: 39 },
  statBrand: { fontSize: 19, lineHeight: 24, marginTop: 6 },
  statDetail: { fontSize: 13, marginTop: 4 },
});
