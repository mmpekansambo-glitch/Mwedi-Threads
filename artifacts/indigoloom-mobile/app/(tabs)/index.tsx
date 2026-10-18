import { useGetDashboard } from '@workspace/api-client-react';
import { useClerk, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DashboardCharts } from '@/components/DashboardCharts';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, PageHeader, ProjectCard, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useClerk();
  const query = useGetDashboard();
  const data = query.data;
  const displayName = user?.firstName || user?.username || 'maker';
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 18, paddingBottom: Platform.OS === 'web' ? 105 : 32 }]}
      refreshControl={undefined}
    >
      <View style={styles.topBar}>
        <View>
          <LoomText style={[styles.kicker, { color: colors.mutedForeground }]}>YOUR WORKROOM</LoomText>
          <LoomText serif style={[styles.greeting, { color: colors.foreground }]}>Good to see you, {displayName}.</LoomText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void signOut()} style={[styles.logout, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="log-out" size={17} color={colors.primary} />
        </Pressable>
      </View>
      <LoomText style={[styles.subheading, { color: colors.mutedForeground }]}>A little look at all the good things taking shape.</LoomText>
      {query.isLoading ? <LoadingState /> : query.isError || !data ? <ErrorState onRetry={() => void query.refetch()} /> : (
        <>
          <View style={styles.stats}>
            <View style={[styles.stat, styles.featured, { backgroundColor: colors.primary }]}>
              <LoomText style={[styles.statLabel, { color: colors.primaryForeground }]}>IN YOUR WORKROOM</LoomText>
              <LoomText serif style={[styles.statValue, { color: colors.primaryForeground }]}>{data.totalProjects}</LoomText>
              <LoomText style={[styles.statCaption, { color: colors.primaryForeground }]}>projects gathered</LoomText>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LoomText style={[styles.statLabel, { color: colors.mutedForeground }]}>TAKING SHAPE</LoomText>
              <LoomText serif style={[styles.statValue, { color: colors.foreground }]}>{data.activeProjects}</LoomText>
              <LoomText style={[styles.statCaption, { color: colors.mutedForeground }]}>in progress</LoomText>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LoomText style={[styles.statLabel, { color: colors.mutedForeground }]}>ON THE SHELF</LoomText>
              <LoomText serif style={[styles.statValue, { color: colors.foreground }]}>{data.completedProjects}</LoomText>
              <LoomText style={[styles.statCaption, { color: colors.mutedForeground }]}>finished pieces</LoomText>
            </View>
          </View>
          <DashboardCharts charts={data.charts} />
          <View style={[styles.sectionHeading, { marginTop: 22 }]}>
            <View>
              <LoomText style={[styles.kicker, { color: colors.mutedForeground }]}>A FEW THINGS IN MOTION</LoomText>
              <LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>Back on your needles</LoomText>
            </View>
            <Link href="/(tabs)/projects" style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 }}>All projects</Link>
          </View>
          {data.recentProjects.length ? data.recentProjects.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project} />) : (
            <EmptyState title="Your next project starts here." body="Gather a pattern, choose a yarn, and give your next idea its own little page." actionTitle="Start a project" onAction={() => router.push('/projects/new')} />
          )}
          <View style={styles.sectionHeading}>
            <View>
              <LoomText style={[styles.kicker, { color: colors.mutedForeground }]}>LITTLE BY LITTLE</LoomText>
              <LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>Recent notes</LoomText>
            </View>
            <Feather name="feather" size={19} color={colors.accent} />
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
              <LoomText style={{ color: colors.mutedForeground, fontSize: 15 }}>Your progress notes will find a home here.</LoomText>
            </View>
          )}
          <LoomText style={[styles.footer, { color: colors.mutedForeground }]}>There’s no rush. The best things are made one stitch at a time.</LoomText>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32, maxWidth: 780, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kicker: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.1, marginBottom: 6 },
  greeting: { fontSize: 30, letterSpacing: -0.4 },
  logout: { borderWidth: 1, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  subheading: { fontSize: 15, marginTop: 6, marginBottom: 21 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 29 },
  stat: { flex: 1, minHeight: 108, justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: 11 },
  featured: { borderColor: 'transparent' },
  statLabel: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.55 },
  statValue: { fontSize: 34, lineHeight: 39 },
  statCaption: { fontSize: 13 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, marginTop: 3 },
  sectionTitle: { fontSize: 26 },
  note: { borderWidth: 1, borderRadius: 13, padding: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  noteProject: { fontFamily: fonts.semibold, fontSize: 15 },
  noteCopy: { fontSize: 14, lineHeight: 20, marginTop: 3 },
  noteDate: { fontSize: 13, marginTop: 5 },
  noteEmpty: { minHeight: 86, borderWidth: 1, borderRadius: 13, padding: 16, justifyContent: 'center', alignItems: 'center' },
  footer: { fontSize: 13, textAlign: 'center', marginTop: 22 },
});
