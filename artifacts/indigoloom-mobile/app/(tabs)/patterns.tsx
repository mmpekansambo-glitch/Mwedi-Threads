import { useMemo, useState } from 'react';
import { getGetSewingPatternsQueryKey, useGetSewingPatterns } from '@workspace/api-client-react';
import type { SewingPattern } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, fonts } from '@/components/loom';
import { HomeSwitcher, ProfileMenu } from '@/components/Crafts';
import { PatternThumb, patternDetails, timesMadeLabel } from '@/components/SewingPatterns';
import { useSewingColors } from '@/hooks/useColors';

function PatternRow({ pattern }: { pattern: SewingPattern }) {
  const colors = useSewingColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/patterns/[id]', params: { id: pattern.id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
      testID={`pattern-row-${pattern.id}`}
    >
      <PatternThumb pattern={pattern} size={52} />
      <View style={styles.rowBody}>
        <LoomText numberOfLines={1} style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16 }}>{pattern.name}</LoomText>
        {patternDetails(pattern) ? <LoomText numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13 }}>{patternDetails(pattern)}</LoomText> : null}
        {pattern.timesMade > 0 ? <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 13 }}>{timesMadeLabel(pattern.timesMade)}</LoomText> : null}
      </View>
    </Pressable>
  );
}

export default function PatternsScreen() {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const params = useMemo(() => (search.trim() ? { search: search.trim() } : {}), [search]);
  const query = useGetSewingPatterns(params, { query: { queryKey: getGetSewingPatternsQueryKey(params) } });
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 18, paddingBottom: 104 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <LoomText serif style={[styles.title, { color: colors.foreground }]}>Patterns</LoomText>
        <ProfileMenu />
      </View>
      <HomeSwitcher />
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by name, designer or size…" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} accessibilityLabel="Search your patterns" testID="input-pattern-search" />
        {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      {query.isLoading ? <LoadingState label="Gathering your patterns…" /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : search && !query.data?.length ? (
        <EmptyState title="No patterns match" body="Try a different search." actionTitle="Clear search" onAction={() => setSearch('')} />
      ) : query.data?.length ? (
        <View style={styles.list}>{query.data.map((pattern) => <PatternRow key={pattern.id} pattern={pattern} />)}</View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => router.push('/patterns/new')} style={[styles.empty, { borderColor: colors.border }]} testID="button-add-first-pattern">
          <LoomText style={{ color: colors.mutedForeground, fontSize: 15 }}>No patterns yet. <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>Add a pattern</LoomText></LoomText>
        </Pressable>
      )}
      <View style={styles.bottomAction}><LoomButton title="Add pattern" icon="plus" onPress={() => router.push('/patterns/new')} testID="button-add-pattern" /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 780, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18, zIndex: 2 },
  title: { fontSize: 30, letterSpacing: -0.4 },
  searchWrap: { minHeight: 46, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 16 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body },
  list: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 9, paddingRight: 14 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 15 },
  bottomAction: { marginTop: 20, marginBottom: 10 },
});
