import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetMyCraftsQueryKey, useGetMyCrafts, useUpdateMyCrafts } from '@workspace/api-client-react';
import type { Crafts } from '@workspace/api-client-react';
import { Brand, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export type Craft = 'yarn' | 'sewing';
export const homeNames: Record<Craft, string> = { yarn: 'Yarn studio', sewing: 'Sewing room' };
const homeRoutes = { yarn: '/(tabs)', sewing: '/(tabs)/sewing' } as const;
const sewingTabs = ['sewing', 'sewing-projects', 'fabric'];

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

// Shown at the top of each home's first screen once both crafts are on.
export function HomeSwitcher() {
  const colors = useColors();
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

// The avatar menu: Settings with the craft switches, then Sign out. The last
// craft that's on can't be turned off, so there is always a home.
export function ProfileMenu() {
  const colors = useColors();
  const { user } = useUser();
  const { signOut } = useClerk();
  const client = useQueryClient();
  const crafts = useCrafts().data;
  const save = useUpdateMyCrafts();
  const { home, setHome } = useHome();
  const [open, setOpen] = useState(false);
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
        <LoomText style={{ color: colors.primary, fontFamily: fonts.bold, fontSize: 16 }}>{displayName.slice(0, 1).toUpperCase()}</LoomText>
      </Pressable>
      {open ? (
        <View style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {crafts ? (
            <View style={[styles.settings, { borderBottomColor: colors.border }]}>
              <LoomText style={[styles.settingsHeading, { color: colors.mutedForeground }]}>SETTINGS</LoomText>
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
            </View>
          ) : null}
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
  menu: { position: 'absolute', top: 48, right: 0, minWidth: 200, borderWidth: 1, borderRadius: 10, padding: 6, zIndex: 5 },
  settings: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, marginBottom: 4, borderBottomWidth: 1 },
  settingsHeading: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, marginBottom: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 },
  track: { width: 38, height: 22, borderRadius: 11, padding: 3 },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10 },
  choiceScreen: { flex: 1, paddingHorizontal: 22, alignItems: 'center', gap: 26 },
  choiceCard: { width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: 18, padding: 20, gap: 10 },
  choiceTitle: { fontSize: 28, marginBottom: 6 },
  choiceOption: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 12, padding: 14 },
});
