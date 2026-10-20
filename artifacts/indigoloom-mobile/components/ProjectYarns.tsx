import { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  getGetStashYarnsQueryKey, getGetYarnCatalogQueryKey, useGetStashYarns, useGetYarnCatalog,
} from '@workspace/api-client-react';
import type { ProjectYarn, ProjectYarnInput, StashYarn } from '@workspace/api-client-react';
import { FormFieldLabel, LoomText, fonts } from '@/components/loom';
import { OptionPicker } from '@/components/HookSizePicker';
import { CatalogChoices, ColorDot } from '@/components/YarnFields';
import { useColors } from '@/hooks/useColors';

export type YarnDraft = {
  key: string;
  stashYarnId: string | null;
  brand: string; subBrand: string; color: string;
  heldTogether: boolean;
  skeinsUsed: string;
};

let nextKey = 0;
const newKey = () => `yarn-${nextKey++}`;
const newYarn = '__new__';

export function emptyYarnDraft(change: Partial<YarnDraft> = {}): YarnDraft {
  return { key: newKey(), stashYarnId: null, brand: '', subBrand: '', color: '', heldTogether: false, skeinsUsed: '', ...change };
}

export function yarnDraftsFromProject(yarns: ProjectYarn[]): YarnDraft[] {
  return yarns.map((yarn) => emptyYarnDraft({
    stashYarnId: yarn.stashYarnId, brand: yarn.brand ?? '', subBrand: yarn.subBrand ?? '', color: yarn.color ?? '',
    heldTogether: yarn.heldTogether, skeinsUsed: yarn.skeinsUsed === null ? '' : String(yarn.skeinsUsed),
  }));
}

export function yarnsForApi(drafts: YarnDraft[]): ProjectYarnInput[] | string {
  const yarns: ProjectYarnInput[] = [];
  for (const draft of drafts) {
    const brand = draft.brand.trim(); const subBrand = draft.subBrand.trim(); const color = draft.color.trim();
    if (!draft.stashYarnId && !brand && !subBrand && !color) continue;
    if (!draft.stashYarnId && !brand) return 'Add a brand for each yarn so it goes in your stash.';
    let skeinsUsed: number | null = null;
    if (draft.skeinsUsed.trim()) {
      skeinsUsed = Number(draft.skeinsUsed.replace(',', '.'));
      if (!Number.isFinite(skeinsUsed) || skeinsUsed < 0 || skeinsUsed > 999 || !Number.isInteger(skeinsUsed * 2)) {
        return 'Enter skeins used in whole or half skeins, like 2 or 1.5.';
      }
    }
    yarns.push({
      stashYarnId: draft.stashYarnId, brand: brand || null, subBrand: subBrand || null, color: color || null,
      heldTogether: yarns.length > 0 && draft.heldTogether, skeinsUsed,
    });
  }
  return yarns;
}

export function describeProjectYarn(yarn: Pick<ProjectYarn, 'brand' | 'subBrand' | 'color'>): string {
  return [[yarn.brand, yarn.subBrand].filter(Boolean).join(' '), yarn.color].filter(Boolean).join(' · ');
}

function useSettledValue(value: string, delay = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function stashLabel(yarn: StashYarn): string {
  return [[yarn.brand, yarn.subBrand].filter(Boolean).join(' '), yarn.color].filter(Boolean).join(' · ');
}

function YarnRow({ draft, index, stash, onChange, onRemove }: {
  draft: YarnDraft; index: number; stash: StashYarn[];
  onChange: (change: Partial<YarnDraft>) => void; onRemove: () => void;
}) {
  const colors = useColors();
  const id = `project-yarn-${index}`;
  const linked = stash.find((yarn) => yarn.id === draft.stashYarnId);
  const catalogParams = {
    brand: useSettledValue(draft.brand.trim()),
    subBrand: useSettledValue(draft.subBrand.trim()),
    color: useSettledValue(draft.color.trim()),
  };
  const catalog = useGetYarnCatalog(catalogParams, {
    query: { queryKey: getGetYarnCatalogQueryKey(catalogParams), enabled: !draft.stashYarnId && Boolean(catalogParams.brand), placeholderData: (previous) => previous },
  });
  const catalogData = draft.stashYarnId ? undefined : catalog.data;
  // Typing over a stash yarn's names makes it a new yarn for the stash.
  const type = (change: Partial<YarnDraft>) => onChange({ ...change, stashYarnId: null });
  const pick = (stashYarnId: string) => {
    const yarn = stash.find((item) => item.id === stashYarnId);
    if (!yarn) return onChange({ stashYarnId: null });
    onChange({ stashYarnId: yarn.id, brand: yarn.brand, subBrand: yarn.subBrand ?? '', color: yarn.color ?? '' });
  };
  const fieldStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];

  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]} testID={id}>
      <View style={styles.rowHead}>
        <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>Yarn {index + 1}</LoomText>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove yarn ${index + 1}`} onPress={onRemove} hitSlop={8} testID={`${id}-remove`}>
          <Feather name="trash-2" size={17} color={colors.mutedForeground} />
        </Pressable>
      </View>
      {index > 0 ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draft.heldTogether }} onPress={() => onChange({ heldTogether: !draft.heldTogether })} style={styles.held} testID={`${id}-held`}>
          <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: draft.heldTogether ? colors.primary : colors.card }]}>
            {draft.heldTogether ? <Feather name="check" size={13} color={colors.card} /> : null}
          </View>
          <LoomText style={{ color: colors.foreground, fontSize: 15 }}>Held together with yarn {index}</LoomText>
        </Pressable>
      ) : null}
      {stash.length ? (
        <>
          <FormFieldLabel>From your stash</FormFieldLabel>
          <View style={styles.stashPick}>
            {linked ? <ColorDot color={linked.generalColor} size={16} /> : null}
            <View style={{ flex: 1 }}>
              <OptionPicker
                label="From your stash"
                placeholder="A new yarn"
                options={[newYarn, ...stash.map((yarn) => yarn.id)]}
                optionLabel={(option) => option === newYarn ? 'A new yarn' : stashLabel(stash.find((yarn) => yarn.id === option)!)}
                value={draft.stashYarnId}
                onChange={(option) => pick(option === newYarn ? '' : option)}
                testID={`${id}-stash`}
              />
            </View>
          </View>
        </>
      ) : null}
      <FormFieldLabel>Brand</FormFieldLabel>
      <TextInput value={draft.brand} onChangeText={(brand) => type({ brand })} placeholder="e.g. Cascade" placeholderTextColor={colors.mutedForeground} maxLength={80} autoCorrect={false} style={fieldStyle} testID={`${id}-brand`} />
      <CatalogChoices options={catalogData?.brands ?? []} typed={draft.brand} suggestion={catalogData?.suggestions.brand} onPick={(brand) => type({ brand })} testID={`${id}-brand-choices`} />
      <FormFieldLabel>Sub brand</FormFieldLabel>
      <TextInput value={draft.subBrand} onChangeText={(subBrand) => type({ subBrand })} placeholder="e.g. 220 Superwash" placeholderTextColor={colors.mutedForeground} maxLength={80} autoCorrect={false} style={fieldStyle} testID={`${id}-sub-brand`} />
      <CatalogChoices options={catalogData?.subBrands.map((line) => line.name) ?? []} typed={draft.subBrand} suggestion={catalogData?.suggestions.subBrand} onPick={(subBrand) => type({ subBrand })} testID={`${id}-sub-brand-choices`} />
      <FormFieldLabel>Color</FormFieldLabel>
      <TextInput value={draft.color} onChangeText={(color) => type({ color })} placeholder="e.g. Oatmeal" placeholderTextColor={colors.mutedForeground} maxLength={80} autoCorrect={false} style={fieldStyle} testID={`${id}-color`} />
      <CatalogChoices options={catalogData?.colors.map((item) => item.name) ?? []} typed={draft.color} suggestion={catalogData?.suggestions.color} onPick={(color) => type({ color })} testID={`${id}-color-choices`} />
      <FormFieldLabel>Skeins used</FormFieldLabel>
      <TextInput value={draft.skeinsUsed} onChangeText={(skeinsUsed) => onChange({ skeinsUsed })} placeholder="e.g. 2" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" style={[...fieldStyle, styles.skeins]} testID={`${id}-skeins`} />
    </View>
  );
}

export function ProjectYarnsField({ value, onChange, error }: { value: YarnDraft[]; onChange: (value: YarnDraft[]) => void; error?: string }) {
  const colors = useColors();
  const stashQuery = useGetStashYarns({}, { query: { queryKey: getGetStashYarnsQueryKey({}) } });
  const stash = stashQuery.data ?? [];
  const rows = value.length ? value : [emptyYarnDraft({ key: 'first' })];
  const update = (index: number, change: Partial<YarnDraft>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...change } : row));
  const last = rows[rows.length - 1];
  return (
    <View>
      {rows.map((draft, index) => (
        <YarnRow key={draft.key} draft={draft} index={index} stash={stash} onChange={(change) => update(index, change)} onRemove={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} />
      ))}
      {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14, marginBottom: 10 }}>{error}</LoomText> : null}
      {rows.length < 12 ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => onChange([...rows, emptyYarnDraft()])} style={styles.action} testID="button-add-yarn">
            <Feather name="plus" size={16} color={colors.primary} />
            <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 }}>Add another yarn</LoomText>
          </Pressable>
          {last.brand.trim() || last.subBrand.trim() ? (
            <Pressable accessibilityRole="button" onPress={() => onChange([...rows, emptyYarnDraft({ brand: last.brand, subBrand: last.subBrand })])} style={styles.action} testID="button-add-yarn-color">
              <Feather name="plus" size={16} color={colors.primary} />
              <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 }}>Add another color of this yarn</LoomText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  held: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stashPick: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
  skeins: { width: 120, marginBottom: 0 },
  actions: { gap: 4, marginBottom: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
});
