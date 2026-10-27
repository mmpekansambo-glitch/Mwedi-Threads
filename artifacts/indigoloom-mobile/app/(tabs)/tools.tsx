import { useMemo, useState } from 'react';
import { getGetSewingToolsQueryKey, useGetSewingTools } from '@workspace/api-client-react';
import type { SewingTool, SewingToolSection } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState, LoomButton, LoomText, fonts } from '@/components/loom';
import { HomeSwitcher, ProfileMenu } from '@/components/Crafts';
import { ToolThumb, toolDetails, toolSections } from '@/components/SewingTools';
import { useSewingColors } from '@/hooks/useColors';

function ToolRow({ tool }: { tool: SewingTool }) {
  const colors = useSewingColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/tools/[id]', params: { id: tool.id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
      testID={`tool-row-${tool.id}`}
    >
      <ToolThumb tool={tool} size={52} />
      <View style={styles.rowBody}>
        <LoomText numberOfLines={1} style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16 }}>{tool.name}</LoomText>
        <LoomText numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13 }}>{toolDetails(tool)}</LoomText>
      </View>
      {tool.quantity !== null ? (
        <View style={[styles.quantity, { backgroundColor: colors.selectedWash }]}>
          <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 }}>× {tool.quantity}</LoomText>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function ToolsScreen() {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<SewingToolSection | ''>('');
  const params = useMemo(() => (search.trim() ? { search: search.trim() } : {}), [search]);
  const query = useGetSewingTools(params, { query: { queryKey: getGetSewingToolsQueryKey(params) } });
  const shown = toolSections.filter((item) => !section || item.value === section);
  const chip = (active: boolean) => [styles.filterChip, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.border }];
  const addTool = (value?: SewingToolSection) => router.push({ pathname: '/tools/new', params: value ? { section: value } : {} });
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 18, paddingBottom: 104 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <LoomText serif style={[styles.title, { color: colors.foreground }]}>Tools</LoomText>
        <ProfileMenu />
      </View>
      <HomeSwitcher />
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by name, size, color or brand…" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} accessibilityLabel="Search your tools" testID="input-tool-search" />
        {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      <View style={styles.filterRow}>
        {[{ value: '' as const, label: 'All' }, ...toolSections].map((item) => {
          const active = section === item.value;
          return <Pressable key={item.label} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setSection(item.value)} style={chip(active)} testID={`button-tools-filter-${item.value || 'all'}`}><LoomText style={{ color: active ? colors.accentForeground : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>{item.label}</LoomText></Pressable>;
        })}
      </View>
      {query.isLoading ? <LoadingState label="Gathering your tools…" /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : search && !query.data?.length ? (
        <EmptyState title="No tools match" body="Try a different search." actionTitle="Clear search" onAction={() => setSearch('')} />
      ) : shown.map((item) => {
        const tools = (query.data ?? []).filter((tool) => tool.section === item.value);
        if (search && !tools.length) return null;
        return (
          <View key={item.value} style={styles.section} testID={`section-tools-${item.value}`}>
            <View style={styles.sectionHead}>
              <LoomText serif style={{ color: colors.foreground, fontSize: 22 }}>{item.label}</LoomText>
              <LoomText style={{ color: colors.mutedForeground, fontFamily: fonts.semibold, fontSize: 14 }}>{tools.length}</LoomText>
            </View>
            {tools.length ? <View style={styles.list}>{tools.map((tool) => <ToolRow key={tool.id} tool={tool} />)}</View> : (
              <Pressable accessibilityRole="button" onPress={() => addTool(item.value)} style={[styles.empty, { borderColor: colors.border }]} testID={`button-add-first-${item.value}`}>
                <LoomText style={{ color: colors.mutedForeground, fontSize: 15 }}>No {item.label.toLowerCase()} yet. <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 }}>Add {item.value === 'kit' ? 'kit' : 'a notion'}</LoomText></LoomText>
              </Pressable>
            )}
          </View>
        );
      })}
      <View style={styles.bottomAction}><LoomButton title="Add tool" icon="plus" onPress={() => addTool(section || undefined)} testID="button-add-tool" /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 780, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18, zIndex: 2 },
  title: { fontSize: 30, letterSpacing: -0.4 },
  searchWrap: { minHeight: 46, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body },
  filterRow: { flexDirection: 'row', gap: 7, paddingBottom: 4 },
  filterChip: { borderWidth: 1, paddingHorizontal: 14, minHeight: 33, borderRadius: 99, justifyContent: 'center' },
  section: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  list: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 9, paddingRight: 14 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  quantity: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 15 },
  bottomAction: { marginTop: 20, marginBottom: 10 },
});
