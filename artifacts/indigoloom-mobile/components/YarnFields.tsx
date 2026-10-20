import { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, TextInput, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import type { GeneralColor, StashYarn, YarnBlendPart, YarnWeight } from '@workspace/api-client-react';
import { FormFieldLabel, LoomText, fonts } from '@/components/loom';
import { OptionPicker } from '@/components/HookSizePicker';
import { ITEM_HEIGHT, Wheel } from '@/components/ProjectDateField';
import { useColors } from '@/hooks/useColors';

export const yarnWeights: Array<{ value: YarnWeight; label: string }> = [
  { value: 'lace', label: '0 · Lace' },
  { value: 'fingering', label: '1 · Fingering' },
  { value: 'sport', label: '2 · Sport' },
  { value: 'dk', label: '3 · DK' },
  { value: 'worsted', label: '4 · Worsted' },
  { value: 'bulky', label: '5 · Bulky' },
  { value: 'super_bulky', label: '6 · Super bulky' },
  { value: 'jumbo', label: '7 · Jumbo' },
];

export function weightLabel(weight: YarnWeight | null | undefined): string {
  return yarnWeights.find((item) => item.value === weight)?.label ?? '';
}

export const generalColors: Array<{ value: GeneralColor; label: string; swatch: string }> = [
  { value: 'red', label: 'Red', swatch: '#C0392B' },
  { value: 'orange', label: 'Orange', swatch: '#E07B39' },
  { value: 'yellow', label: 'Yellow', swatch: '#E9C46A' },
  { value: 'green', label: 'Green', swatch: '#5B8C51' },
  { value: 'blue', label: 'Blue', swatch: '#3D6FB6' },
  { value: 'purple', label: 'Purple', swatch: '#7D5BA6' },
  { value: 'pink', label: 'Pink', swatch: '#E58FB0' },
  { value: 'brown', label: 'Brown', swatch: '#8B5E3C' },
  { value: 'black', label: 'Black', swatch: '#222222' },
  { value: 'gray', label: 'Gray', swatch: '#9AA0A6' },
  { value: 'white', label: 'White', swatch: '#FFFFFF' },
  { value: 'cream', label: 'Cream', swatch: '#F1E6CF' },
  { value: 'multi', label: 'Multicolor', swatch: '#C0392B' },
];
const multiColors = ['#C0392B', '#E9C46A', '#5B8C51', '#3D6FB6', '#7D5BA6'] as const;

export function ColorDot({ color, size = 14, style, noun = 'yarn' }: { color: GeneralColor | null | undefined; size?: number; style?: ViewStyle; noun?: string }) {
  const match = generalColors.find((item) => item.value === color);
  if (!match) return null;
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${match.label} ${noun}`} style={[styles.dot, shape, style]}>
      {match.value === 'multi'
        ? <LinearGradient colors={multiColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, shape]} />
        : <View style={[StyleSheet.absoluteFill, shape, { backgroundColor: match.swatch }]} />}
    </View>
  );
}

// Stash photos are private, so they load with the signed-in maker's token.
export function StashPhoto({ yarn, style }: { yarn: Pick<StashYarn, 'id' | 'updatedAt'>; style: StyleProp<ImageStyle> }) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value ?? null);
    });
    return () => { active = false; };
  }, [getToken]);
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain || !token) return <View style={style as StyleProp<ViewStyle>} />;
  return (
    <Image
      source={{
        uri: `https://${domain}/api/yarn-stash/${yarn.id}/photo?v=${encodeURIComponent(String(yarn.updatedAt))}`,
        headers: { Authorization: `Bearer ${token}` },
      }}
      style={style}
      contentFit="cover"
      accessibilityLabel="Yarn photo"
    />
  );
}

export function GeneralColorPicker({ value, onChange }: { value: GeneralColor | null; onChange: (value: GeneralColor | null) => void }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <FormFieldLabel>Color family</FormFieldLabel>
      <View style={styles.colorRow} accessibilityRole="radiogroup">
        {generalColors.map((item) => {
          const selected = value === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={item.label}
              onPress={() => onChange(selected ? null : item.value)}
              style={[styles.colorChoice, { borderColor: selected ? colors.primary : 'transparent' }]}
              testID={`button-general-color-${item.value}`}
            >
              <ColorDot color={item.value} size={26} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Picks a yarn weight with the same scroll wheel as the project dates.
export function WeightWheelField({ value, onChange }: { value: YarnWeight | null; onChange: (value: YarnWeight | null) => void }) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(0);
  const openPicker = () => {
    setDraft(Math.max(0, yarnWeights.findIndex((item) => item.value === (value ?? 'worsted'))));
    setIsOpen(true);
  };
  return (
    <View style={styles.field}>
      <FormFieldLabel>Weight</FormFieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Weight: ${weightLabel(value) || 'Choose a weight'}`}
        onPress={openPicker}
        style={[styles.trigger, { backgroundColor: colors.card, borderColor: colors.input }]}
        testID="input-stash-weight"
      >
        <Feather name="layers" size={16} color={colors.primary} />
        <LoomText style={{ flex: 1, color: value ? colors.foreground : colors.mutedForeground, fontSize: 16 }}>{weightLabel(value) || 'Choose a weight'}</LoomText>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>
      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="Close weight picker" onPress={() => setIsOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeading}>
              <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)} style={styles.headingButton}>
                <LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancel</LoomText>
              </Pressable>
              <LoomText serif style={{ color: colors.foreground, fontSize: 20 }}>Weight</LoomText>
              <Pressable accessibilityRole="button" onPress={() => { onChange(yarnWeights[draft].value); setIsOpen(false); }} style={styles.headingButton} testID="input-stash-weight-done">
                <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'right' }}>Done</LoomText>
              </Pressable>
            </View>
            <View style={[styles.wheels, { backgroundColor: colors.selectedWash }]}>
              <View pointerEvents="none" style={[styles.wheelBand, { borderColor: colors.accent }]} />
              <Wheel label="Weight" items={yarnWeights.map((item) => item.label)} index={draft} onChange={setDraft} flex={1} testID="input-stash-weight-wheel" />
            </View>
            {value ? (
              <Pressable accessibilityRole="button" onPress={() => { onChange(null); setIsOpen(false); }} style={styles.clearButton}>
                <LoomText style={{ color: colors.destructive, fontFamily: fonts.semibold, fontSize: 15 }}>Clear weight</LoomText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export type BlendDraft = Array<{ fiber: string; percent: string; typed?: boolean }>;

export function blendForApi(draft: BlendDraft): YarnBlendPart[] | string {
  const parts = draft.filter((part) => part.fiber.trim() || part.percent.trim());
  if (parts.some((part) => !part.fiber.trim())) return 'Choose a fiber for each part of the blend.';
  const blend = parts.map((part) => ({ fiber: part.fiber.trim(), percent: Number(part.percent) }));
  if (blend.some((part) => !Number.isInteger(part.percent) || part.percent < 1 || part.percent > 100)) return 'Enter each fiber as a whole percent from 1 to 100.';
  const total = blend.reduce((sum, part) => sum + part.percent, 0);
  if (blend.length && total !== 100) return `The blend adds up to ${total}%. Make it add up to 100%.`;
  return blend;
}

const anotherFiber = 'Another fiber…';

export function BlendFields({ value, onChange, fibers, error }: { value: BlendDraft; onChange: (value: BlendDraft) => void; fibers: string[]; error: string }) {
  const colors = useColors();
  const update = (index: number, change: Partial<BlendDraft[number]>) => onChange(value.map((part, partIndex) => partIndex === index ? { ...part, ...change } : part));
  const total = value.reduce((sum, part) => sum + (Number(part.percent) || 0), 0);
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  return (
    <View style={styles.field}>
      <FormFieldLabel>Blend</FormFieldLabel>
      {value.map((part, index) => {
        const typed = part.typed || (Boolean(part.fiber) && !fibers.includes(part.fiber));
        return (
          <View key={index} style={styles.blendRow}>
            <View style={{ flex: 1 }}>
              {typed
                ? <TextInput value={part.fiber} onChangeText={(fiber) => update(index, { fiber })} placeholder="Fiber name" placeholderTextColor={colors.mutedForeground} maxLength={40} style={inputStyle} accessibilityLabel={`Fiber ${index + 1}`} testID={`input-blend-fiber-${index}`} />
                : <OptionPicker label={`Fiber ${index + 1}`} placeholder="Choose a fiber" options={[...fibers, anotherFiber]} value={part.fiber || null} onChange={(fiber) => update(index, fiber === anotherFiber ? { fiber: '', typed: true } : { fiber })} testID={`select-blend-fiber-${index}`} />}
            </View>
            <View style={styles.percentWrap}>
              <TextInput value={part.percent} onChangeText={(percent) => update(index, { percent: percent.replace(/[^0-9]/g, '').slice(0, 3) })} keyboardType="number-pad" style={[...inputStyle, styles.percentInput]} accessibilityLabel={`Percent of fiber ${index + 1}`} testID={`input-blend-percent-${index}`} />
              <LoomText style={[styles.percentSign, { color: colors.mutedForeground }]}>%</LoomText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove fiber ${index + 1}`} onPress={() => onChange(value.filter((_, partIndex) => partIndex !== index))} style={[styles.removeButton, { borderColor: colors.input }]}>
              <Feather name="trash-2" size={15} color={colors.mutedForeground} />
            </Pressable>
          </View>
        );
      })}
      <View style={styles.blendFoot}>
        {value.length < 6 ? (
          <Pressable accessibilityRole="button" onPress={() => onChange([...value, { fiber: '', percent: value.length ? String(Math.max(0, 100 - total) || '') : '100' }])} style={styles.addFiber} testID="button-add-fiber">
            <Feather name="plus" size={15} color={colors.primary} />
            <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 }}>Add a fiber</LoomText>
          </Pressable>
        ) : <View />}
        {value.length ? <LoomText style={{ color: total === 100 ? colors.primary : colors.destructive, fontFamily: fonts.semibold, fontSize: 14 }}>Total {total}%</LoomText> : null}
      </View>
      {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14, marginTop: 4 }}>{error}</LoomText> : null}
    </View>
  );
}

// Catalog names that match what was typed, offered as tappable chips, plus
// a "Did you mean …?" chip when the text looks like a typo.
export function CatalogChoices({ options, typed, suggestion, onPick, testID }: {
  options: string[];
  typed: string;
  suggestion: string | null | undefined;
  onPick: (value: string) => void;
  testID: string;
}) {
  const colors = useColors();
  const lower = typed.trim().toLowerCase();
  if (suggestion === typed.trim()) suggestion = null;
  const matches = options.filter((option) => option.toLowerCase() !== lower && (!lower || option.toLowerCase().includes(lower))).slice(0, 5);
  if (!suggestion && !matches.length) return null;
  return (
    <View style={styles.choiceRow}>
      {suggestion ? (
        <Pressable accessibilityRole="button" onPress={() => onPick(suggestion)} style={[styles.choiceChip, { backgroundColor: colors.selectedWash }]} testID={`${testID}-did-you-mean`}>
          <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>Did you mean <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 14 }}>{suggestion}</LoomText>?</LoomText>
        </Pressable>
      ) : null}
      {!suggestion && matches.map((option) => (
        <Pressable key={option} accessibilityRole="button" onPress={() => onPick(option)} style={[styles.choiceChip, { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.card }]}>
          <LoomText style={{ color: colors.foreground, fontSize: 14 }}>{option}</LoomText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  dot: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(31,47,22,0.18)' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  colorChoice: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  trigger: { minHeight: 46, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 47, 22, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  headingButton: { minWidth: 64, paddingVertical: 10 },
  wheels: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', paddingHorizontal: 6 },
  wheelBand: { position: 'absolute', left: 8, right: 8, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, borderTopWidth: 1.5, borderBottomWidth: 1.5 },
  clearButton: { alignSelf: 'center', paddingVertical: 12, marginTop: 6 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
  blendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  percentWrap: { width: 78 },
  percentInput: { paddingRight: 26, textAlign: 'right' },
  percentSign: { position: 'absolute', right: 10, top: 13, fontSize: 15 },
  removeButton: { width: 40, height: 46, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  blendFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addFiber: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6, marginBottom: 14 },
  choiceChip: { borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
});
