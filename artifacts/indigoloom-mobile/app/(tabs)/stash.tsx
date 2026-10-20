import { useMemo, useState } from 'react';
import { useGetStashYarns } from '@workspace/api-client-react';
import type { GeneralColor, StashYarn, YarnWeight } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, PageHeader, fonts } from '@/components/loom';
import { ColorDot, StashPhoto, generalColors, weightLabel, yarnWeights } from '@/components/YarnFields';
import { SkeinSuggestions } from '@/components/SkeinSuggestions';
import { SortRow, sortStash, stashSorts, useSavedSort } from '@/components/Sorting';
import { useColors } from '@/hooks/useColors';

function skeinsLabel(yarn: StashYarn): string {
  if (yarn.skeinsPurchased === null) return '';
  return `${yarn.skeinsLeft ?? yarn.skeinsPurchased} of ${yarn.skeinsPurchased} ${yarn.skeinsPurchased === 1 ? 'skein' : 'skeins'} left`;
}

function StashCard({ yarn }: { yarn: StashYarn }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/stash/[id]', params: { id: yarn.id } })}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
      testID={`stash-card-${yarn.id}`}
    >
      <View>
        {yarn.photoPath ? <StashPhoto yarn={yarn} style={[styles.photo, { backgroundColor: colors.selectedWash }]} /> : (
          <View style={[styles.photo, styles.needsPhoto, { backgroundColor: colors.selectedWash }]}>
            <Feather name="camera" size={20} color={colors.mutedForeground} />
            <LoomText style={{ color: colors.mutedForeground, fontFamily: fonts.semibold, fontSize: 13 }}>Needs a photo</LoomText>
          </View>
        )}
        <ColorDot color={yarn.generalColor} size={20} style={styles.photoDot} />
      </View>
      <View style={styles.cardBody}>
        <LoomText serif numberOfLines={2} style={[styles.cardTitle, { color: colors.foreground }]}>{[yarn.brand, yarn.subBrand].filter(Boolean).join(' ')}</LoomText>
        {yarn.color ? <LoomText numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 14 }}>{yarn.color}</LoomText> : null}
        {yarn.weight ? <LoomText numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13 }}>{weightLabel(yarn.weight)}</LoomText> : null}
        {skeinsLabel(yarn) ? <LoomText style={{ color: colors.primary, fontSize: 13, fontFamily: fonts.semibold }}>{skeinsLabel(yarn)}</LoomText> : null}
      </View>
    </Pressable>
  );
}

export default function StashScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [weight, setWeight] = useState<YarnWeight | ''>('');
  const [generalColor, setGeneralColor] = useState<GeneralColor | ''>('');
  const [sort, setSort] = useSavedSort('mwedi:stash-sort', stashSorts);
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(weight ? { weight } : {}),
    ...(generalColor ? { generalColor } : {}),
  }), [search, weight, generalColor]);
  const filtered = Boolean(search || weight || generalColor);
  const clearFilters = () => { setSearch(''); setWeight(''); setGeneralColor(''); };
  const query = useGetStashYarns(params);
  const chip = (active: boolean) => [styles.filterChip, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.border }];
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 104 }]}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader title="Yarn stash" action={<Pressable accessibilityRole="button" accessibilityLabel="Add yarn" onPress={() => router.push('/stash/new')} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" color={colors.primaryForeground} size={20} /></Pressable>} />
      <SkeinSuggestions />
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by brand, color or fiber…" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} accessibilityLabel="Search your stash" testID="input-stash-search" />
        {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {generalColors.map((item) => {
          const active = generalColor === item.value;
          return <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={`${item.label} yarn`} accessibilityState={{ selected: active }} onPress={() => setGeneralColor(active ? '' : item.value)} style={[styles.colorFilter, { borderColor: active ? colors.primary : 'transparent' }]}><ColorDot color={item.value} size={22} /></Pressable>;
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Pressable onPress={() => setWeight('')} style={chip(!weight)}><LoomText style={{ color: !weight ? colors.accentForeground : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>Every weight</LoomText></Pressable>
        {yarnWeights.map((item) => {
          const active = weight === item.value;
          return <Pressable key={item.value} onPress={() => setWeight(active ? '' : item.value)} style={chip(active)}><LoomText style={{ color: active ? colors.accentForeground : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>{item.label}</LoomText></Pressable>;
        })}
      </ScrollView>
      <SortRow options={stashSorts} value={sort} onChange={setSort} testID="stash-sort" />
      {query.isLoading ? <LoadingState label="Gathering your yarn…" /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : query.data?.length ? (
        <>
          <LoomText style={[styles.count, { color: colors.mutedForeground }]}>{query.data.length} {query.data.length === 1 ? 'yarn' : 'yarns'}</LoomText>
          <View style={styles.grid}>{sortStash(query.data, sort).map((yarn) => <StashCard key={yarn.id} yarn={yarn} />)}</View>
        </>
      ) : filtered ? (
        <EmptyState title="No yarn matches" body="Try a different search or clear a filter." actionTitle="Clear filters" onAction={clearFilters} />
      ) : (
        <EmptyState title="No yarn yet" body="Add your first yarn to start your stash." actionTitle="Add yarn" onAction={() => router.push('/stash/new')} />
      )}
      <View style={styles.bottomAction}><LoomButton title="Add yarn" icon="plus" onPress={() => router.push('/stash/new')} testID="button-add-yarn" /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 780, width: '100%', alignSelf: 'center' },
  addButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  searchWrap: { minHeight: 46, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body },
  filterRow: { gap: 7, paddingBottom: 8, alignItems: 'center' },
  filterChip: { borderWidth: 1, paddingHorizontal: 12, minHeight: 31, borderRadius: 99, justifyContent: 'center' },
  colorFilter: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 13, marginVertical: 10, fontFamily: fonts.medium },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47.5%', flexGrow: 1, maxWidth: 360, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1 },
  needsPhoto: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoDot: { position: 'absolute', right: 8, bottom: 8, borderWidth: 2, borderColor: '#FFFFFF' },
  cardBody: { padding: 11, gap: 3 },
  cardTitle: { fontSize: 17, lineHeight: 21 },
  bottomAction: { marginTop: 16, marginBottom: 10 },
});
