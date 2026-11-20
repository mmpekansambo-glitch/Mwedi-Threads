import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';
import { useScheme } from '@/hooks/useAppearance';

// Building blocks for the phone's new look and layouts (#120), matching the
// web (#118, #119): paper hills behind each room, project names in a craft
// font, pinned swatches, running-stitch lines and a floating bar.

type Palette = ReturnType<typeof useColors>;

export function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Evening';
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export function nameHash(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash;
}

// A slight tilt that stays the same for the same name.
const tilts = [-2, 1.5, -1, 2, -1.5, 0.75];
export function tiltFor(name: string): number {
  return tilts[(nameHash(name) >> 5) % tilts.length];
}

export type NameTileCraft = 'crochet' | 'knitting' | 'sewing';

// Each craft has two fonts; a project always gets the same one, from its name.
const craftFonts: Record<NameTileCraft, [NameFont, NameFont]> = {
  crochet: [
    { family: 'Gluten_500Medium', scale: 1, lineHeight: 1.1 },
    { family: 'Pacifico_400Regular', scale: 0.83, lineHeight: 1.45 },
  ],
  knitting: [
    { family: 'Silkscreen_400Regular', scale: 0.9, lineHeight: 1.1, upper: true },
    { family: 'RampartOne_400Regular', scale: 0.9, lineHeight: 1.2 },
  ],
  sewing: [
    { family: 'SpecialElite_400Regular', scale: 0.95, lineHeight: 1.15 },
    { family: 'PlayfairDisplay_500Medium_Italic', scale: 1, lineHeight: 1.15 },
  ],
};

type NameFont = { family: string; scale: number; lineHeight: number; upper?: boolean };

export function nameTileFont(name: string, craft: NameTileCraft): string {
  return craftFonts[craft][nameHash(name) % 2].family;
}

function sizeScale(name: string): number {
  const longestWord = Math.max(...name.split(/\s+/).map((word) => word.length), 4);
  return Math.min(1, 9 / longestWord, 22 / Math.max(name.length, 10));
}

export function toneFor(colors: Palette, tone: number) {
  const index = ((tone % 4) + 4) % 4;
  return {
    background: [colors.tone0, colors.tone1, colors.tone2, colors.tone3][index],
    ink: [colors.toneInk0, colors.toneInk1, colors.toneInk2, colors.toneInk3][index],
  };
}

// When a project has no photo, its tile shows the name in a craft font.
export function NameTile({ name, craft, size, style }: { name: string; craft: NameTileCraft; size: number; style?: ViewStyle }) {
  const colors = useColors();
  const hash = nameHash(name);
  const font = craftFonts[craft][hash % 2];
  const tone = toneFor(colors, hash >> 3);
  const fontSize = Math.max(11, Math.round(sizeScale(name) * Math.min(size * (size < 140 ? 0.19 : 0.15), 46) * font.scale));
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.nameTile, { backgroundColor: tone.background, height: size }, style]}>
      <LoomText
        style={{ fontFamily: font.family, color: tone.ink, fontSize, lineHeight: Math.round(fontSize * font.lineHeight), textAlign: 'center', textTransform: font.upper ? 'uppercase' : 'none' }}
        numberOfLines={4}
      >
        {name}
      </LoomText>
    </View>
  );
}

// Soft paper hills fixed behind a room's pages, moss or violet.
export function RoomBackdrop({ colors }: { colors: Palette }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none">
        <Path fill={colors.hill1} d="M0 470 C70 440 140 480 220 455 S330 420 390 445 L390 844 L0 844 Z" />
        <Path fill={colors.hill2} d="M0 600 C80 570 160 615 250 590 S350 560 390 580 L390 844 L0 844 Z" />
        <Path fill={colors.hill3} d="M0 730 C90 712 170 748 260 725 S350 700 390 715 L390 844 L0 844 Z" />
      </Svg>
    </View>
  );
}

// A room's page: its color with the hills behind whatever scrolls on top.
export function RoomScreen({ colors, children }: { colors: Palette; children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RoomBackdrop colors={colors} />
      {children}
    </View>
  );
}

// A running stitch: short dashes in a row. React Native's dashed borders
// don't draw on one side only on iOS, so these are little bars instead.
export function Stitch({ color, width = 2, dash = 7, gap = 5, style }: { color: string; width?: number; dash?: number; gap?: number; style?: ViewStyle }) {
  return (
    <View pointerEvents="none" style={[{ height: width, overflow: 'hidden' }, style]}>
      <View style={{ position: 'absolute', left: 0, top: 0, flexDirection: 'row', gap }}>
        {Array.from({ length: 80 }, (_, index) => <View key={index} style={{ width: dash, height: width, backgroundColor: color, borderRadius: width }} />)}
      </View>
    </View>
  );
}

export function StitchDivider({ colors }: { colors: Palette }) {
  return <Stitch color={colors.stitch} style={{ marginVertical: 26 }} />;
}

// A swatch of paper pinned to the page at a slight tilt.
export function PinnedSwatch({ children, tilt = 0, pin = 0, tone = 0, colors, style, testID }: { children: ReactNode; tilt?: number; pin?: number; tone?: number; colors: Palette; style?: ViewStyle; testID?: string }) {
  const pins = [colors.pin0, colors.pin1, colors.pin2, colors.pin3];
  const { background } = toneFor(colors, tone);
  return (
    <View style={[styles.swatch, { backgroundColor: background, transform: [{ rotate: `${tilt}deg` }] }, style]} testID={testID}>
      <View style={[styles.pin, { backgroundColor: pins[pin % pins.length] }]} />
      {children}
    </View>
  );
}

// Words in a row (All, each status, Starred): the one you're on underlined
// with a running stitch in the room's color.
export function WordFilters<T extends string>({ items, selected, onSelect, colors }: { items: Array<{ value: T; label: string; testID?: string }>; selected: (value: T) => boolean; onSelect: (value: T) => void; colors: Palette }) {
  return (
    <View style={styles.words} accessibilityRole="tablist">
      {items.map((item) => {
        const on = selected(item.value);
        return (
          <Pressable key={item.value || 'all'} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onSelect(item.value)} style={styles.word} testID={item.testID}>
            <LoomText serif style={{ fontSize: 18, color: on ? colors.foreground : colors.mutedForeground }}>{item.label}</LoomText>
            {on ? <Stitch color={colors.primary} dash={5} gap={3} /> : <View style={{ height: 2 }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// The bar that floats at the bottom of a project page with its quick actions.
export function FloatingBar({ label, children, colors }: { label: ReactNode; children: ReactNode; colors: Palette }) {
  const insets = useSafeAreaInsets();
  const dark = useScheme() === 'dark';
  return (
    <View style={[styles.floatWrap, { bottom: Math.max(insets.bottom, 12) + 4 }]} testID="floating-bar">
      <View style={[styles.floatBar, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.glass, shadowColor: '#141917' }]}>
        {Platform.OS === 'ios' ? <BlurView intensity={60} tint={dark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]} /> : null}
        <LoomText serif numberOfLines={1} style={[styles.floatLabel, { color: colors.foreground }]}>{label}</LoomText>
        <View style={styles.floatActions}>{children}</View>
      </View>
    </View>
  );
}

export function BarAction({ title, onPress, colors, testID, strong = false }: { title: string; onPress: () => void; colors: Palette; testID?: string; strong?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={testID} style={({ pressed }) => [styles.barAction, strong && { backgroundColor: colors.primary }, pressed && { opacity: 0.75 }]}>
      <LoomText style={{ fontFamily: fonts.semibold, fontSize: 15, color: strong ? colors.primaryForeground : colors.primaryText }}>{title}</LoomText>
    </Pressable>
  );
}

// The top of each Overview: the room switcher and account menu, then
// "Evening, Ngwe." with the room's counts as links underneath.
export function OverviewGreeting({ name, counts, colors, top }: { name: string; counts: Array<{ label: string; onPress: () => void; testID: string }>; colors: Palette; top: ReactNode }) {
  return (
    <View style={styles.greetingWrap}>
      {top}
      <LoomText serif style={[styles.greeting, { color: colors.foreground }]} accessibilityRole="header">{greetingFor()}, {name}.</LoomText>
      <View style={styles.counts}>
        {counts.map((count, index) => (
          <View key={count.testID} style={styles.countItem}>
            {index > 0 ? <LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>·</LoomText> : null}
            <Pressable accessibilityRole="link" onPress={count.onPress} testID={count.testID} hitSlop={6}>
              <LoomText style={{ color: colors.primaryText, fontFamily: fonts.medium, fontSize: 16, textDecorationLine: 'underline', textDecorationColor: colors.accSoft }}>{count.label}</LoomText>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

export function SectionTitle({ title, colors, action }: { title: string; colors: Palette; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <LoomText serif accessibilityRole="header" style={{ fontSize: 26, color: colors.foreground }}>{title}</LoomText>
      {action}
    </View>
  );
}

// A board of projects: two tiles a row, each pinned at its own slight tilt.
export function Board({ children, testID }: { children: ReactNode; testID?: string }) {
  return <View style={styles.board} testID={testID}>{children}</View>;
}

export function useTileWidth() {
  const { width } = useWindowDimensions();
  return Math.floor((Math.min(width, 780) - 40 - 16) / 2);
}

// One project on a board: its fabric photo, or its name in a craft font,
// with the status (and how far along) underneath.
export function BoardTile({ title, craft, status, detail, art, star, onPress, colors, testID }: { title: string; craft: NameTileCraft; status: string; detail?: string; art?: ReactNode; star?: ReactNode; onPress: () => void; colors: Palette; testID?: string }) {
  const width = useTileWidth();
  return (
    <View style={[styles.tileWrap, { width, transform: [{ rotate: `${tiltFor(title)}deg` }] }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${status}${detail ? `, ${detail}` : ''}`} onPress={onPress} testID={testID} style={({ pressed }) => [styles.tile, { backgroundColor: colors.paper }, pressed && { opacity: 0.85 }]}>
        {art ? <View style={{ width: width - 12, height: width - 12, overflow: 'hidden' }}>{art}</View> : <NameTile name={title} craft={craft} size={width - 12} />}
        <View style={styles.tileMeta}>
          <LoomText style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.primaryText }} numberOfLines={1}>{status}</LoomText>
          {detail ? <LoomText style={{ fontSize: 13, color: colors.mutedForeground }}>{detail}</LoomText> : null}
        </View>
      </Pressable>
      {star ? <View style={styles.tileStar}>{star}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  greetingWrap: { marginBottom: 18, zIndex: 2 },
  greeting: { fontSize: 40, lineHeight: 46, letterSpacing: -0.5, marginTop: 14 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2, marginTop: 6 },
  countItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  board: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18, paddingTop: 4, marginBottom: 8 },
  tileWrap: { position: 'relative' },
  tile: { padding: 6, paddingBottom: 0, borderRadius: 2, shadowColor: '#141917', shadowOpacity: 0.09, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  tileMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 8 },
  tileStar: { position: 'absolute', top: 12, right: 12 },
  nameTile: { width: '100%', alignItems: 'center', justifyContent: 'center', padding: 12, overflow: 'hidden' },
  swatch: { padding: 14, paddingTop: 18, borderRadius: 2, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, shadowColor: '#141917', elevation: 2 },
  pin: { position: 'absolute', top: -5, alignSelf: 'center', width: 11, height: 11, borderRadius: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  words: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginBottom: 14 },
  word: { paddingVertical: 4, gap: 2, overflow: 'hidden' },
  floatWrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center' },
  floatBar: { width: '100%', maxWidth: 520, minHeight: 54, borderRadius: 3, paddingLeft: 16, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  floatLabel: { flex: 1, fontSize: 18 },
  floatActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  barAction: { minHeight: 42, paddingHorizontal: 12, borderRadius: 2, justifyContent: 'center' },
});
