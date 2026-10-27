import { useGetSewingOverview } from '@workspace/api-client-react';
import { useUser } from '@clerk/expo';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatDoodle } from '@/components/StatDoodle';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, fonts } from '@/components/loom';
import { HomeSwitcher, ProfileMenu } from '@/components/Crafts';
import { SewingProjectCard, fabricAmount, sewingStages } from '@/components/SewingFields';
import { useSewingColors } from '@/hooks/useColors';

// Opens Projects filtered to one status.
function openProjects(status: string) {
  router.push({ pathname: '/(tabs)/sewing-projects', params: { status, at: String(Date.now()) } });
}

export default function SewingOverviewScreen() {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const query = useGetSewingOverview();
  const data = query.data;
  const displayName = user?.firstName || user?.username || 'maker';
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 18, paddingBottom: 104 }]}
    >
      <View style={styles.topBar}>
        <LoomText serif style={[styles.greeting, { color: colors.foreground }]}>Hi, {displayName}</LoomText>
        <ProfileMenu />
      </View>
      <HomeSwitcher />
      {query.isLoading ? <LoadingState label="Gathering your sewing…" /> : query.isError || !data ? <ErrorState onRetry={() => void query.refetch()} /> : (
        <>
          <View style={styles.stats}>
            {([
              ['In progress', data.inProgress, 'spool', '#DCE6F4', '#5A7684', () => openProjects('in_progress'), 'in-progress'],
              ['Finished', data.finished, 'scissors', colors.selectedWash, colors.primaryText, () => openProjects('completed'), 'finished'],
              ['Fabric', data.fabricPieces, 'swatch', '#EEF2FA', '#92AFD7', () => router.navigate('/(tabs)/fabric'), 'fabric'],
            ] as const).map(([label, value, doodle, tint, ink, onPress, id]) => (
              <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={({ pressed }) => [styles.stat, { backgroundColor: tint, borderColor: tint }, pressed && styles.statPressed]} testID={`button-sewing-stat-${id}`}>
                <LoomText style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</LoomText>
                <LoomText serif style={[styles.statValue, { color: colors.foreground }]}>{value}</LoomText>
                <View style={styles.statDoodle}><StatDoodle kind={doodle} color={ink} size={40} /></View>
              </Pressable>
            ))}
          </View>
          {data.fabricPieces > 0 ? <LoomText style={[styles.length, { color: colors.mutedForeground }]} testID="text-fabric-length">{fabricAmount(data.fabricLength, data.fabricUnit)} of fabric in your stash</LoomText> : null}
          <View style={[styles.stageBoard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LoomText serif style={[styles.sectionTitle, { color: colors.foreground, fontSize: 21, marginBottom: 10 }]}>Projects by stage</LoomText>
            <View style={styles.stageRow}>
              {data.stages.map((entry) => (
                <View key={entry.stage} style={[styles.stage, { backgroundColor: colors.selectedWash, borderColor: colors.border }]} testID={`stage-count-${entry.stage}`}>
                  <LoomText serif style={{ fontSize: 24, color: entry.count ? colors.primaryText : colors.mutedForeground }}>{entry.count}</LoomText>
                  <LoomText style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.mutedForeground }}>{sewingStages.find((item) => item.value === entry.stage)?.label}</LoomText>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.sectionHeading}>
            <LoomText serif style={[styles.sectionTitle, { color: colors.foreground }]}>Recent projects</LoomText>
            <Link href="/(tabs)/sewing-projects" style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>All projects</Link>
          </View>
          {data.recentProjects.length ? data.recentProjects.slice(0, 3).map((project) => <SewingProjectCard key={project.id} project={project} />) : (
            <EmptyState title="No sewing projects yet" body="Start a project to track it from prep to finish." actionTitle="Start a project" onAction={() => router.push('/sewing/new')} />
          )}
          {data.recentProjects.length ? <LoomButton title="New project" icon="plus" onPress={() => router.push('/sewing/new')} style={{ marginTop: 6 }} testID="button-new-sewing-project" /> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 780, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 21, zIndex: 2 },
  greeting: { fontSize: 30, letterSpacing: -0.4 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stat: { flex: 1, minHeight: 108, justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: 11, overflow: 'hidden' },
  statPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  statDoodle: { position: 'absolute', right: 6, bottom: 6 },
  statLabel: { fontFamily: fonts.semibold, fontSize: 14 },
  statValue: { fontSize: 34, lineHeight: 39 },
  length: { fontSize: 14, fontFamily: fonts.medium, marginBottom: 18 },
  stageBoard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 22, marginTop: 8 },
  stageRow: { flexDirection: 'row', gap: 6 },
  stage: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { fontSize: 26 },
});
