import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useColors, useSewingColors } from '@/hooks/useColors';
import { useScheme } from '@/hooks/useAppearance';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { LoadingState, LoomText } from '@/components/loom';
import { RoomBackdrop, Stitch } from '@/components/paper';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
import { CraftChoiceScreen, HomeProvider, useCrafts, useHome } from '@/components/Crafts';

// Words-only tabs (#120): no icons, a frosted strip across the bottom, and
// the tab you're on underlined with a running stitch in the room's color.
// Each home shows only its own tabs: Overview, My projects, Yarn stash and
// Tools in the Yarn studio; Overview, Projects, Fabric, Patterns and Tools in
// the Sewing room. (This replaces iOS 26's native tab bar, which needs icons.)
function WordTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const yarnColors = useColors();
  const sewingColors = useSewingColors();
  const { home } = useHome();
  const colors = home === 'yarn' ? yarnColors : sewingColors;
  const dark = useScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: isIOS ? 'transparent' : colors.glass }]}>
      {isIOS ? <BlurView intensity={70} tint={dark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]} /> : null}
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const hidden = (options as { href?: unknown }).href === null || (options.tabBarItemStyle as { display?: string } | undefined)?.display === 'none';
        if (hidden) return null;
        const focused = state.index === index;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} onPress={onPress} style={styles.tab} testID={`tab-${route.name}`}>
            <LoomText serif numberOfLines={1} style={[styles.tabLabel, { color: focused ? colors.foreground : colors.mutedForeground }]}>{label}</LoomText>
            {focused ? <Stitch color={colors.primary} dash={5} gap={3} style={styles.tabStitch} /> : <View style={styles.tabStitch} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// Each room's paper hills sit behind every tab; the pages scroll over them.
function ClassicTabLayout() {
  const yarnColors = useColors();
  const sewingColors = useSewingColors();
  const { home } = useHome();
  const yarnHidden = home !== 'yarn';
  const colors = yarnHidden ? sewingColors : yarnColors;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <RoomBackdrop colors={colors} />
    <Tabs
      tabBar={(props) => <WordTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: { position: 'absolute' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          href: yarnHidden ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'My projects',
          href: yarnHidden ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="stash"
        options={{
          title: 'Yarn stash',
          href: yarnHidden ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="yarn-tools"
        options={{
          title: 'Tools',
          href: yarnHidden ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="sewing"
        options={{
          title: 'Overview',
          href: yarnHidden ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="sewing-projects"
        options={{
          title: 'Projects',
          href: yarnHidden ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="fabric"
        options={{
          title: 'Fabric',
          href: yarnHidden ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="patterns"
        options={{
          title: 'Patterns',
          href: yarnHidden ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: 'Tools',
          href: yarnHidden ? undefined : null,
        }}
      />
    </Tabs>
    </View>
  );
}

export default function TabLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingState label="Loading…" />;
  if (!isSignedIn) return <Redirect href="/" />;
  return <CraftTabs />;
}

function CraftTabs() {
  const crafts = useCrafts();
  if (crafts.isLoading) return <LoadingState label="Loading…" />;
  return (
    <HomeProvider initial={crafts.data && !crafts.data.yarn ? 'sewing' : 'yarn'}>
      {crafts.data?.needsChoice ? <CraftChoiceScreen /> : <ClassicTabLayout />}
    </HomeProvider>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, paddingHorizontal: 8, overflow: 'hidden' },
  tab: { flexShrink: 1, alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4, gap: 3 },
  tabLabel: { fontSize: 17 },
  tabStitch: { alignSelf: 'stretch', height: 2 },
});
