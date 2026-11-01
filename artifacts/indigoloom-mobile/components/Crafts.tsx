import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetMyCraftsQueryKey, useGetMyCrafts, useUpdateMyCrafts, useUpdateMyCurrency } from '@workspace/api-client-react';
import type { Crafts, Currency } from '@workspace/api-client-react';
import { ITEM_HEIGHT, Wheel } from '@/components/ProjectDateField';
import { currencies } from '@/lib/money';
import { Brand, LoomText, fonts } from '@/components/loom';
import { useColors, useSewingColors } from '@/hooks/useColors';
import { useAppearance } from '@/hooks/useAppearance';
import type { AppearanceChoice } from '@/hooks/useAppearance';

export type Craft = 'yarn' | 'sewing';
export const homeNames: Record<Craft, string> = { yarn: 'Yarn studio', sewing: 'Sewing room' };
const homeRoutes = { yarn: '/(tabs)', sewing: '/(tabs)/sewing' } as const;
const sewingTabs = ['sewing', 'sewing-projects', 'fabric', 'patterns', 'tools'];

// If the craft switches can't be read, the app opens as it did before the
// Sewing room, with yarn on, instead of waiting or locking the maker out.
export function useCrafts() {
  return useGetMyCrafts({ query: {
    queryKey: getGetMyCraftsQueryKey(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnMount: false,
    retryOnMount: false,
    select: (crafts): Crafts | undefined => (typeof crafts?.yarn === 'boolean' ? crafts : undefined),
  } });
}

type HomeState = { home: Craft; setHome: (home: Craft) => void };
const HomeContext = createContext<HomeState>({ home: 'yarn', setHome: () => undefined });

// The tabs of the other home are hidden, and a hidden native tab can't be
// opened, so the home changes first and the navigation follows. Landing on
// a Sewing room tab some other way (a link) moves the home there too.
export function HomeProvider({ initial, children }: { initial: Craft; children: ReactNode }) {
  const [home, setHome] = useState<Craft>(initial);
  const segments = useSegments() as string[];
  const inSewingRoom = segments.some((segment) => sewingTabs.includes(segment));
  useEffect(() => {
    if (segments[0] === '(tabs)') setHome(inSewingRoom ? 'sewing' : 'yarn');
  }, [inSewingRoom, segments[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  return <HomeContext.Provider value={{ home, setHome }}>{children}</HomeContext.Provider>;
}

export function useHome() {
  return useContext(HomeContext);
}

export function goHome(setHome: (home: Craft) => void, craft: Craft) {
  setHome(craft);
  setTimeout(() => router.replace(homeRoutes[craft]), 0);
}

// Each home's own colors: Powder Blue in the Yarn studio, mauve in the Sewing room.
function useHomeColors() {
  const yarnColors = useColors();
  const sewingColors = useSewingColors();
  return useHome().home === 'sewing' ? sewingColors : yarnColors;
}

// Shown at the top of each home's first screen once both crafts are on.
export function HomeSwitcher() {
  const colors = useHomeColors();
  const crafts = useCrafts().data;
  const { home, setHome } = useHome();
  if (!crafts?.yarn || !crafts.sewing) return null;
  return (
    <View style={[styles.switcher, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="tablist">
      {(['yarn', 'sewing'] as const).map((craft) => {
        const selected = home === craft;
        return (
          <Pressable key={craft} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { if (!selected) goHome(setHome, craft); }} style={[styles.switcherOption, selected && { backgroundColor: colors.primary }]} testID={`button-home-${craft}`}>
            <LoomText style={{ color: selected ? colors.primaryForeground : colors.mutedForeground, fontFamily: fonts.semibold, fontSize: 14 }}>{homeNames[craft]}</LoomText>
          </Pressable>
        );
      })}
    </View>
  );
}

const appearanceOptions: { value: AppearanceChoice; label: string }[] = [
  { value: 'system', label: 'Match phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// The avatar menu: Settings with the craft switches and Appearance, then Sign out. The last
// craft that's on can't be turned off, so there is always a home.
export function ProfileMenu() {
  const colors = useHomeColors();
  const { user } = useUser();
  const { signOut } = useClerk();
  const client = useQueryClient();
  const crafts = useCrafts().data;
  const save = useUpdateMyCrafts();
  const { home, setHome } = useHome();
  const appearance = useAppearance();
  const [open, setOpen] = useState(false);
  const saveCurrency = useUpdateMyCurrency();
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const [currencyDraft, setCurrencyDraft] = useState(0);
  const currencyIndex = Math.max(0, currencies.findIndex((option) => option.value === crafts?.currency));
  const chooseCurrency = (currency: Currency) =>
    saveCurrency.mutate({ data: { currency } }, { onSuccess: (saved) => client.setQueryData(getGetMyCraftsQueryKey(), saved) });
  const displayName = user?.firstName || user?.username || 'maker';

  const toggle = (craft: Craft) => {
    if (!crafts) return;
    const next = { yarn: crafts.yarn, sewing: crafts.sewing, [craft]: !crafts[craft] };
    if (!next.yarn && !next.sewing) return;
    save.mutate({ data: next }, {
      onSuccess: (saved) => {
        client.setQueryData(getGetMyCraftsQueryKey(), saved);
        if (!saved[home]) goHome(setHome, saved.yarn ? 'yarn' : 'sewing');
      },
    });
  };

  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel="Account menu" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={[styles.avatar, { backgroundColor: colors.accent }]} testID="button-profile-menu">
        <LoomText style={{ color: colors.accentIcon, fontFamily: fonts.bold, fontSize: 16 }}>{displayName.slice(0, 1).toUpperCase()}</LoomText>
      </Pressable>
      {open ? (
        <View style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.settings, { borderBottomColor: colors.border }]}>
            <LoomText style={[styles.settingsHeading, { color: colors.mutedForeground }]}>SETTINGS</LoomText>
            {crafts ? (<>
              <LoomText style={{ color: colors.foreground, fontFamily: fonts.bold, fontSize: 15, marginBottom: 4 }}>My crafts</LoomText>
              {(['yarn', 'sewing'] as const).map((craft) => {
                const on = crafts[craft];
                const locked = on && !(craft === 'yarn' ? crafts.sewing : crafts.yarn);
                return (
                  <Pressable key={craft} accessibilityRole="switch" accessibilityState={{ checked: on, disabled: locked }} accessibilityHint={locked ? 'Keep at least one craft on' : undefined} disabled={locked || save.isPending} onPress={() => toggle(craft)} style={styles.switchRow} testID={`switch-craft-${craft}`}>
                    <LoomText style={{ color: colors.foreground, fontSize: 15 }}>{craft === 'yarn' ? 'Yarn' : 'Sewing'}</LoomText>
                    <View style={[styles.track, { backgroundColor: on ? colors.primary : colors.border, opacity: locked ? 0.6 : 1 }]}>
                      <View style={[styles.knob, on && { transform: [{ translateX: 16 }] }]} />
                    </View>
                  </Pressable>
                );
              })}
              <Pressable accessibilityRole="button" accessibilityLabel={`Currency, ${currencies[currencyIndex].label}`} onPress={() => { setCurrencyDraft(currencyIndex); setPickingCurrency(true); }} style={[styles.switchRow, { marginTop: 4 }]} testID="button-currency">
                <LoomText style={{ color: colors.foreground, fontFamily: fonts.bold, fontSize: 15 }}>Currency</LoomText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <LoomText style={{ color: colors.mutedForeground, fontSize: 15 }}>{crafts.currency}</LoomText>
                  <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                </View>
              </Pressable>
            </>) : null}
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.bold, fontSize: 15, marginTop: crafts ? 8 : 0, marginBottom: 6 }}>Appearance</LoomText>
            <View style={[styles.appearance, { backgroundColor: colors.secondary }]} accessibilityRole="radiogroup">
              {appearanceOptions.map((option) => {
                const selected = appearance.choice === option.value;
                return (
                  <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => appearance.choose(option.value)} style={[styles.appearanceOption, selected && { backgroundColor: colors.primary }]} testID={`button-appearance-${option.value}`}>
                    <LoomText style={{ color: selected ? colors.primaryForeground : colors.mutedForeground, fontFamily: fonts.semibold, fontSize: 13 }} numberOfLines={1}>{option.label}</LoomText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Modal visible={pickingCurrency} transparent animationType="slide" onRequestClose={() => setPickingCurrency(false)}>
            <View style={styles.backdrop}>
              <Pressable accessibilityLabel="Close currency picker" onPress={() => setPickingCurrency(false)} style={StyleSheet.absoluteFill} />
              <View style={[styles.sheet, { backgroundColor: colors.card }]}>
                <View style={styles.sheetHeading}>
                  <Pressable accessibilityRole="button" onPress={() => setPickingCurrency(false)} style={styles.headingButton}>
                    <LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancel</LoomText>
                  </Pressable>
                  <LoomText serif style={{ color: colors.foreground, fontSize: 20 }}>Currency</LoomText>
                  <Pressable accessibilityRole="button" onPress={() => { chooseCurrency(currencies[currencyDraft].value); setPickingCurrency(false); }} style={styles.headingButton} testID="button-currency-done">
                    <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'right' }}>Done</LoomText>
                  </Pressable>
                </View>
                <View style={[styles.wheels, { backgroundColor: colors.selectedWash }]}>
                  <View pointerEvents="none" style={[styles.wheelBand, { borderColor: colors.accent }]} />
                  <Wheel label="Currency" items={currencies.map((option) => `${option.label} (${option.value})`)} index={currencyDraft} onChange={setCurrencyDraft} flex={1} testID="wheel-currency" />
                </View>
              </View>
            </View>
          </Modal>
          <Pressable accessibilityRole="button" onPress={() => { setOpen(false); void signOut(); }} style={styles.menuItem} testID="button-sign-out">
            <Feather name="log-out" size={16} color={colors.foreground} />
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>Sign out</LoomText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function CraftChoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const save = useUpdateMyCrafts();
  const { setHome } = useHome();
  const options = [
    { key: 'yarn', title: 'Yarn crafts', detail: 'Crochet and knitting', icon: 'droplet', choice: { yarn: true, sewing: false } },
    { key: 'sewing', title: 'Sewing', detail: 'Fabric and garments', icon: 'scissors', choice: { yarn: false, sewing: true } },
    { key: 'both', title: 'Both', detail: 'Switch between them any time', icon: 'layers', choice: { yarn: true, sewing: true } },
  ] as const;
  const choose = (choice: { yarn: boolean; sewing: boolean }) => save.mutate({ data: choice }, {
    onSuccess: (crafts) => {
      client.setQueryData(getGetMyCraftsQueryKey(), crafts);
      goHome(setHome, crafts.yarn ? 'yarn' : 'sewing');
    },
  });
  return (
    <View style={[styles.choiceScreen, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top + 30 }]}>
      <Brand />
      <View style={[styles.choiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LoomText serif style={[styles.choiceTitle, { color: colors.foreground }]}>What do you make?</LoomText>
        {options.map((option) => (
          <Pressable key={option.key} accessibilityRole="button" disabled={save.isPending} onPress={() => choose(option.choice)} style={({ pressed }) => [styles.choiceOption, { backgroundColor: pressed ? colors.card : colors.secondary, borderColor: colors.border }]} testID={`button-craft-choice-${option.key}`}>
            <Feather name={option.icon} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <LoomText style={{ color: colors.foreground, fontFamily: fonts.bold, fontSize: 16 }}>{option.title}</LoomText>
              <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{option.detail}</LoomText>
            </View>
            <Feather name="arrow-right" size={17} color={colors.primary} />
          </Pressable>
        ))}
        <LoomText style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>You can turn crafts on or off later in Settings.</LoomText>
        {save.isError ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14 }}>We couldn’t save that just now. Please try again.</LoomText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, gap: 4, marginBottom: 16 },
  switcherOption: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  menu: { position: 'absolute', top: 48, right: 0, minWidth: 290, borderWidth: 1, borderRadius: 10, padding: 6, zIndex: 5 },
  settings: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, marginBottom: 4, borderBottomWidth: 1 },
  settingsHeading: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, marginBottom: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 },
  appearance: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  appearanceOption: { flexGrow: 1, minHeight: 32, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  track: { width: 38, height: 22, borderRadius: 11, padding: 3 },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 47, 22, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  headingButton: { minWidth: 64, paddingVertical: 10 },
  wheels: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', paddingHorizontal: 6 },
  wheelBand: { position: 'absolute', left: 8, right: 8, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, borderTopWidth: 1.5, borderBottomWidth: 1.5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10 },
  choiceScreen: { flex: 1, paddingHorizontal: 22, alignItems: 'center', gap: 26 },
  choiceCard: { width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: 18, padding: 20, gap: 10 },
  choiceTitle: { fontSize: 28, marginBottom: 6 },
  choiceOption: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 12, padding: 14 },
});
