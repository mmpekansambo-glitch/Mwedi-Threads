import { useGetSewingOverview } from '@workspace/api-client-react';
import { useUser } from '@clerk/expo';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Board, OverviewGreeting, PinnedSwatch, SectionTitle, StitchDivider } from '@/components/paper';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, fonts } from '@/components/loom';
import { WeeklyGoalCard } from '@/components/WeeklyGoal';
import { HomeSwitcher, ProfileMenu } from '@/components/Crafts';
import { SewingProjectCard, fabricAmount, sewingStages } from '@/components/SewingFields';
import { fabricTypes, labelFor } from '@/components/FabricFields';
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
          { label: `${data.inProgress} in progress`, onPress: () => openProjects('in_progress'), testID: 'button-sewing-stat-in-progress' },
          { label: `${data.finished} finished`, onPress: () => openProjects('completed'), testID: 'button-sewing-stat-finished' },
          { label: `${data.fabricPieces} ${data.fabricPieces === 1 ? 'fabric' : 'fabrics'}`, onPress: () => router.navigate('/(tabs)/fabric'), testID: 'button-sewing-stat-fabric' },
        ] : []}
      />
      <WeeklyGoalCard studio="sewing" />
      {pickUp ? (
        <PinnedSwatch colors={colors} tilt={-1.5} pin={3} tone={3} style={styles.pickUp} testID="card-pick-up">
          <LoomText style={[styles.small, { color: colors.mutedForeground }]}>Pick up where you left off</LoomText>
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/sewing/[id]', params: { id: pickUp.id } })} testID="link-pick-up">
            <LoomText serif style={[styles.pickUpTitle, { color: colors.foreground }]}>{pickUp.title} · {sewingStages.find((item) => item.value === pickUp.stage)?.label.toLowerCase()}</LoomText>
          </Pressable>
        </PinnedSwatch>
      ) : null}
      {query.isLoading ? <LoadingState label="Gathering your sewing…" /> : query.isError || !data ? <ErrorState onRetry={() => void query.refetch()} /> : (
        <>
          <StitchDivider colors={colors} />
          <SectionTitle title="On the table" colors={colors} action={<Link href="/(tabs)/sewing-projects" style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>All projects</Link>} />
          {data.recentProjects.length ? <Board>{[...data.recentProjects].sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress')).slice(0, 4).map((project) => <SewingProjectCard key={project.id} project={project} />)}</Board> : (
            <EmptyState title="No sewing projects yet" body="Start a project to track it from prep to finish." actionTitle="Start a project" onAction={() => router.push('/sewing/new')} />
          )}
          {data.recentProjects.length ? <LoomButton title="New project" icon="plus" onPress={() => router.push('/sewing/new')} style={{ marginTop: 14 }} testID="button-new-sewing-project" /> : null}
          <StitchDivider colors={colors} />
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
          {data.fabricTypes.length ? (
            <View style={[styles.stageBoard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 0 }]}>
              <LoomText serif style={[styles.sectionTitle, { color: colors.foreground, fontSize: 21, marginBottom: 6 }]}>Fabric by type</LoomText>
              {data.fabricTypes.map((entry) => (
                <Pressable
                  key={entry.fabricType}
                  accessibilityRole="button"
                  accessibilityLabel={`${labelFor(fabricTypes, entry.fabricType)}: ${entry.count} ${entry.count === 1 ? 'piece' : 'pieces'}`}
                  onPress={() => router.navigate({ pathname: '/(tabs)/fabric', params: { type: entry.fabricType, at: String(Date.now()) } })}
                  style={({ pressed }) => [styles.typeBar, pressed && { opacity: 0.7 }]}
                  testID={`button-fabric-type-${entry.fabricType}`}
                >
                  <LoomText numberOfLines={1} style={[styles.typeName, { color: colors.foreground }]}>{labelFor(fabricTypes, entry.fabricType)}</LoomText>
                  <View style={[styles.typeTrack, { backgroundColor: colors.selectedWash }]}>
                    <View style={[styles.typeFill, { backgroundColor: colors.primary, width: `${(entry.count / data.fabricTypes[0].count) * 100}%` }]} />
                  </View>
                  <LoomText style={[styles.typeCount, { color: colors.foreground }]}>{entry.count}</LoomText>
                </Pressable>
              ))}
            </View>
          ) : null}
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
  length: { fontSize: 14, fontFamily: fonts.medium, marginBottom: 18 },
  stageBoard: { borderWidth: 0, borderRadius: 3, padding: 14, marginBottom: 22, marginTop: 8 },
  stageRow: { flexDirection: 'row', gap: 6 },
  stage: { flex: 1, borderWidth: 0, borderRadius: 2, paddingVertical: 9, alignItems: 'center' },
  typeBar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  typeName: { width: 92, fontSize: 14, fontFamily: fonts.semibold },
  typeTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  typeFill: { height: '100%', minWidth: 6, borderRadius: 5 },
  typeCount: { width: 24, textAlign: 'right', fontSize: 15, fontFamily: fonts.semibold },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { fontSize: 26 },
});
