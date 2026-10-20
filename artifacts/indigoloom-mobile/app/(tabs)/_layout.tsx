import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors, useSewingColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { LoadingState } from '@/components/loom';
import { CraftChoiceScreen, HomeProvider, useCrafts, useHome } from '@/components/Crafts';

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
// Each home shows only its own tabs: Overview, My projects and Yarn stash in
// the Yarn studio, Fabric stash in the Sewing room.
function NativeTabLayout() {
  const { home } = useHome();
  const yarnHidden = home !== 'yarn';
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index" hidden={yarnHidden}>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
        />
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="projects" hidden={yarnHidden}>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
        <NativeTabs.Trigger.Label>My projects</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stash" hidden={yarnHidden}>
        <NativeTabs.Trigger.Icon sf={{ default: 'paintpalette', selected: 'paintpalette.fill' }} />
        <NativeTabs.Trigger.Label>Yarn stash</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fabric" hidden={!yarnHidden}>
        <NativeTabs.Trigger.Icon sf={{ default: 'scissors', selected: 'scissors' }} />
        <NativeTabs.Trigger.Label>Fabric stash</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const yarnColors = useColors();
  const sewingColors = useSewingColors();
  const { home } = useHome();
  const yarnHidden = home !== 'yarn';
  const colors = yarnHidden ? sewingColors : yarnColors;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          href: yarnHidden ? null : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'My projects',
          href: yarnHidden ? null : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="square.grid.2x2" tintColor={color} size={23} />
            ) : (
              <Feather name="grid" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="stash"
        options={{
          title: 'Yarn stash',
          href: yarnHidden ? null : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="paintpalette" tintColor={color} size={23} />
            ) : (
              <Feather name="droplet" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="fabric"
        options={{
          title: 'Fabric stash',
          href: yarnHidden ? undefined : null,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="scissors" tintColor={color} size={23} />
            ) : (
              <Feather name="scissors" size={21} color={color} />
            ),
        }}
      />
    </Tabs>
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
      {crafts.data?.needsChoice ? <CraftChoiceScreen /> : isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />}
    </HomeProvider>
  );
}
