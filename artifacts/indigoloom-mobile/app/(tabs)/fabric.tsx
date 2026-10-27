import { useMemo, useState } from 'react';
import { useGetStashFabrics } from '@workspace/api-client-react';
import type { FabricPrint, GeneralColor, StashFabric } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, fonts } from '@/components/loom';
import { ColorDot, generalColors } from '@/components/YarnFields';
import { FabricPhoto, fabricConstructions, fabricName, fabricPrints, fabricSize, labelFor } from '@/components/FabricFields';
import { HomeSwitcher, ProfileMenu } from '@/components/Crafts';
import { useSewingColors } from '@/hooks/useColors';

function FabricCard({ fabric }: { fabric: StashFabric }) {
  const colors = useSewingColors();
  const meta = [labelFor(fabricConstructions, fabric.construction), fabric.brand].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/fabric/[id]', params: { id: fabric.id } })}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
      testID={`fabric-card-${fabric.id}`}
    >
      <View>
        <FabricPhoto fabric={fabric} index={0} style={[styles.photo, { backgroundColor: colors.selectedWash }]} />
        <ColorDot color={fabric.generalColor} noun="fabric" size={20} style={styles.photoDot} />
      </View>
      <View style={styles.cardBody}>
        <LoomText serif numberOfLines={2} style={[styles.cardTitle, { color: colors.foreground }]}>{fabricName(fabric)}</LoomText>
        {meta ? <LoomText numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 14 }}>{meta}</LoomText> : null}
        {fabricSize(fabric) ? <LoomText style={{ color: colors.primaryText, fontSize: 13, fontFamily: fonts.semibold }}>{fabricSize(fabric)}</LoomText> : null}
      </View>
    </Pressable>
  );
}

export default function FabricStashScreen() {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [print, setPrint] = useState<FabricPrint | ''>('');
  const [generalColor, setGeneralColor] = useState<GeneralColor | ''>('');
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(print ? { print } : {}),
    ...(generalColor ? { generalColor } : {}),
  }), [search, print, generalColor]);
  const filtered = Boolean(search || print || generalColor);
  const clearFilters = () => { setSearch(''); setPrint(''); setGeneralColor(''); };
  const query = useGetStashFabrics(params);
  const chip = (active: boolean) => [styles.filterChip, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.border }];
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 18, paddingBottom: 104 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <LoomText serif style={[styles.title, { color: colors.foreground }]}>Fabric stash</LoomText>
        <ProfileMenu />
      </View>
      <HomeSwitcher />
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by type, brand or notes…" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} accessibilityLabel="Search your fabric" testID="input-fabric-search" />
        {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {generalColors.map((item) => {
          const active = generalColor === item.value;
          return <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={`${item.label} fabric`} accessibilityState={{ selected: active }} onPress={() => setGeneralColor(active ? '' : item.value)} style={[styles.colorFilter, { borderColor: active ? colors.primary : 'transparent' }]}><ColorDot color={item.value} noun="fabric" size={22} /></Pressable>;
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Pressable onPress={() => setPrint('')} style={chip(!print)}><LoomText style={{ color: !print ? colors.accentForeground : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>Every print</LoomText></Pressable>
        {fabricPrints.map((item) => {
          const active = print === item.value;
          return <Pressable key={item.value} onPress={() => setPrint(active ? '' : item.value)} style={chip(active)}><LoomText style={{ color: active ? colors.accentForeground : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>{item.label}</LoomText></Pressable>;
        })}
      </ScrollView>
      {query.isLoading ? <LoadingState label="Gathering your fabric…" /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : query.data?.length ? (
        <>
          <LoomText style={[styles.count, { color: colors.mutedForeground }]}>{query.data.length} {query.data.length === 1 ? 'fabric' : 'fabrics'}</LoomText>
          <View style={styles.grid}>{query.data.map((fabric) => <FabricCard key={fabric.id} fabric={fabric} />)}</View>
        </>
      ) : filtered ? (
        <EmptyState title="No fabric matches" body="Try a different search or clear a filter." actionTitle="Clear filters" onAction={clearFilters} />
      ) : (
        <EmptyState title="No fabric yet" body="Add your first fabric to start your stash." actionTitle="Add fabric" onAction={() => router.push('/fabric/new')} />
      )}
      <View style={styles.bottomAction}><LoomButton title="Add fabric" icon="plus" onPress={() => router.push('/fabric/new')} testID="button-add-fabric" /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 780, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18, zIndex: 2 },
  title: { fontSize: 30, letterSpacing: -0.4 },
  searchWrap: { minHeight: 46, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body },
  filterRow: { gap: 7, paddingBottom: 8, alignItems: 'center' },
  filterChip: { borderWidth: 1, paddingHorizontal: 12, minHeight: 31, borderRadius: 99, justifyContent: 'center' },
  colorFilter: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 13, marginVertical: 10, fontFamily: fonts.medium },
  grid: { gap: 14 },
  card: { width: '100%', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  photoDot: { position: 'absolute', right: 10, bottom: 10, borderWidth: 2, borderColor: '#FFFFFF' },
  cardBody: { padding: 13, gap: 3 },
  cardTitle: { fontSize: 19, lineHeight: 23 },
  bottomAction: { marginTop: 16, marginBottom: 10 },
});
