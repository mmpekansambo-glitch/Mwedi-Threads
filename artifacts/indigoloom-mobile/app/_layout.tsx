import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import {
  Lora_500Medium,
  Lora_600SemiBold,
  Lora_700Bold,
} from '@expo-google-fonts/lora';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

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
  return (
    <Stack initialRouteName="index" screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="projects/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="projects/[id]" />
    </Stack>
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
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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
