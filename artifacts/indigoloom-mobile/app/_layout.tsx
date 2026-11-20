import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SignpostHost } from '@/components/Signpost';
import { OpeningThread } from '@/components/OpeningThread';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
// Headings are EB Garamond; the six craft fonts are for project name tiles.
import { EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond/500Medium';
import { EBGaramond_600SemiBold } from '@expo-google-fonts/eb-garamond/600SemiBold';
import { Gluten_500Medium } from '@expo-google-fonts/gluten/500Medium';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico/400Regular';
import { Silkscreen_400Regular } from '@expo-google-fonts/silkscreen/400Regular';
import { RampartOne_400Regular } from '@expo-google-fonts/rampart-one/400Regular';
import { SpecialElite_400Regular } from '@expo-google-fonts/special-elite/400Regular';
import { PlayfairDisplay_500Medium_Italic } from '@expo-google-fonts/playfair-display/500Medium_Italic';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { loadAppearance, useScheme } from '@/hooks/useAppearance';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!domain) {
  throw new Error('EXPO_PUBLIC_DOMAIN is required to connect Mwedi Threads to its API.');
}
if (!publishableKey) {
  throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required for sign in.');
}

setBaseUrl(`https://${domain}`);

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  const dark = useScheme() === 'dark';
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);
  return (
    <>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <Stack initialRouteName="index" screenOptions={{ headerShown: false, headerBackTitle: 'Back', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="projects/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="projects/[id]" />
      <Stack.Screen name="stash/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="stash/[id]" />
      <Stack.Screen name="fabric/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="fabric/[id]" />
      <Stack.Screen name="sewing/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sewing/[id]" />
      <Stack.Screen name="patterns/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="patterns/[id]" />
      <Stack.Screen name="tools/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="tools/[id]" />
      <Stack.Screen name="yarn-tools/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="yarn-tools/[id]" />
    </Stack>
    <SignpostHost />
    <OpeningThread />
    </>
  );
}

function ClerkApiBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, userId } = useAuth();
  const [ready, setReady] = useState(false);
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    setAuthTokenGetter(async () => (await getToken()) ?? null);
    setReady(true);
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    const nextUserId = userId ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== nextUserId) {
      client.clear();
    }
    previousUserId.current = nextUserId;
  }, [client, isLoaded, userId]);

  return ready ? <>{children}</> : null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    Gluten_500Medium,
    Pacifico_400Regular,
    Silkscreen_400Regular,
    RampartOne_400Regular,
    SpecialElite_400Regular,
    PlayfairDisplay_500Medium_Italic,
  });

  const [appearanceLoaded, setAppearanceLoaded] = useState(false);
  useEffect(() => {
    void loadAppearance().finally(() => setAppearanceLoaded(true));
  }, []);
  const ready = (fontsLoaded || !!fontError) && appearanceLoaded;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
            <ClerkApiBridge>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </ClerkApiBridge>
          </ClerkProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
