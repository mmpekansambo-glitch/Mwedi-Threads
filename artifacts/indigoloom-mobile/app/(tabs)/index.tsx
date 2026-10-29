import { useGetDashboard } from '@workspace/api-client-react';
import { useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { Link, Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DashboardCharts } from '@/components/DashboardCharts';
import { StatDoodle } from '@/components/StatDoodle';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, PageHeader, ProjectCard, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';
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
// Two tied brands fit side by side; more than that shows the first and a count.
function joinBrands(brands: string[]) {
  if (brands.length > 2) return `${brands[0]} + ${brands.length - 1} more`;
  return brands.length < 2 ? brands[0] ?? '' : `${brands[0]} & ${brands[1]}`;
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
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 18, paddingBottom: Platform.OS === 'web' ? 105 : 32 }]}
      refreshControl={undefined}
    >
      <View style={styles.topBar}>
        <LoomText serif style={[styles.greeting, { color: colors.foreground }]}>Hi, {displayName}</LoomText>
        <ProfileMenu />
      </View>
      <HomeSwitcher />
      {query.isLoading ? <LoadingState /> : query.isError || !data ? <ErrorState onRetry={() => void query.refetch()} /> : (
        <>
          <View style={[styles.stats, { marginBottom: 8 }]}>
            {([
              ['All projects', data.totalProjects, 'yarn', colors.statAll, colors.statAllInk, ''],
              ['In progress', data.activeProjects, 'hook', colors.statActive, colors.statActiveInk, 'in_progress'],
              ['Finished', data.completedProjects, 'square', colors.statFinished, colors.statFinishedInk, 'completed'],
            ] as const).map(([label, value, doodle, tint, ink, status]) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${value}`}
                onPress={() => openProjects(status)}
                style={({ pressed }) => [styles.stat, { backgroundColor: tint, borderColor: tint }, pressed && styles.statPressed]}
                testID={`button-stat-${status || 'all'}`}
              >
                <LoomText style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</LoomText>
                <LoomText serif style={[styles.statValue, { color: colors.foreground }]}>{value}</LoomText>
                <View style={styles.statDoodle}><StatDoodle kind={doodle} color={ink} size={40} /></View>
              </Pressable>
            ))}
          </View>
          <View style={styles.stats}>
            {/* A single brand opens My projects searched for it; a tie has no one brand to search. */}
            <Pressable
              accessibilityRole={data.mostUsedYarnBrands.length === 1 ? 'button' : undefined}
              disabled={data.mostUsedYarnBrands.length !== 1}
              onPress={() => searchProjects(data.mostUsedYarnBrands[0])}
              style={({ pressed }) => [styles.stat, { backgroundColor: colors.statActive, borderColor: colors.statActive }, pressed && styles.statPressed]}
              testID="button-stat-top-brand"
            >
              <LoomText style={[styles.statLabel, { color: colors.mutedForeground }]}>Most-used yarn brand</LoomText>
              <LoomText serif numberOfLines={3} style={[styles.statBrand, { color: colors.foreground }]}>{data.mostUsedYarnBrands.length ? joinBrands(data.mostUsedYarnBrands) : '—'}</LoomText>
              {data.mostUsedYarnBrands.length > 0 && (
                <LoomText style={[styles.statDetail, { color: colors.mutedForeground }]}>
                  On {data.mostUsedYarnBrandProjects} {data.mostUsedYarnBrandProjects === 1 ? 'project' : 'projects'}{data.mostUsedYarnBrands.length > 1 ? ' each' : ''}
                </LoomText>
              )}
            </Pressable>
            <View style={[styles.stat, { backgroundColor: colors.statAll, borderColor: colors.statAll }]} testID="card-stat-average-days">
              <LoomText style={[styles.statLabel, { color: colors.mutedForeground }]}>Average days to finish</LoomText>
              <LoomText serif style={[styles.statValue, { color: colors.foreground }]}>{data.averageDaysToFinish ?? '—'}</LoomText>
            </View>
          </View>
          <DashboardCharts charts={data.charts} onPickStatus={openProjects} />
          <View style={[styles.sectionHeading, { marginTop: 22 }]}>
            <LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>Recent projects</LoomText>
            <Link href="/(tabs)/projects" style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 }}>All projects</Link>
          </View>
          {data.recentProjects.length ? data.recentProjects.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project} />) : (
            <EmptyState title="No projects yet" body="Add your first project to start tracking it." actionTitle="Add a project" onAction={() => router.push('/projects/new')} />
          )}
          <View style={styles.sectionHeading}>
            <LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>Recent notes</LoomText>
          </View>
          {data.recentProgress.length ? data.recentProgress.slice(0, 5).map((entry) => (
            <Pressable key={`${entry.projectId}-${entry.createdAt}`} onPress={() => router.push({ pathname: '/projects/[id]', params: { id: entry.projectId } })} style={[styles.note, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.noteDot, { backgroundColor: colors.accent }]} />
              <View style={{ flex: 1 }}>
                <LoomText style={[styles.noteProject, { color: colors.foreground }]}>{entry.projectTitle}</LoomText>
                <LoomText numberOfLines={2} style={[styles.noteCopy, { color: colors.mutedForeground }]}>{entry.notes}</LoomText>
                <LoomText style={[styles.noteDate, { color: colors.mutedForeground }]}>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · now {entry.completionPercent}%</LoomText>
              </View>
              <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          )) : (
            <View style={[styles.noteEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LoomText style={{ color: colors.mutedForeground, fontSize: 15 }}>No progress notes yet.</LoomText>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32, maxWidth: 780, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 21, zIndex: 2 },
  greeting: { fontSize: 30, letterSpacing: -0.4 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 29 },
  stat: { flex: 1, minHeight: 108, justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: 11, overflow: 'hidden' },
  statPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  statDoodle: { position: 'absolute', right: 6, bottom: 6 },
  statLabel: { fontFamily: fonts.semibold, fontSize: 14 },
  statValue: { fontSize: 34, lineHeight: 39 },
  statBrand: { fontSize: 19, lineHeight: 24, marginTop: 6 },
  statDetail: { fontSize: 13, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, marginTop: 3 },
  sectionTitle: { fontSize: 26 },
  note: { borderWidth: 1, borderRadius: 13, padding: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  noteProject: { fontFamily: fonts.semibold, fontSize: 15 },
  noteCopy: { fontSize: 14, lineHeight: 20, marginTop: 3 },
  noteDate: { fontSize: 13, marginTop: 5 },
  noteEmpty: { minHeight: 86, borderWidth: 1, borderRadius: 13, padding: 16, justifyContent: 'center', alignItems: 'center' },
});
