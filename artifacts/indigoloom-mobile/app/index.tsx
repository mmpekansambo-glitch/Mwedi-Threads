import { Redirect, router } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoomButton, LoomText, LoadingState } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export default function WelcomeScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  if (!isLoaded) return <LoadingState label="Opening Mwedi Threads…" />;
  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top + 18, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}>
      <View style={styles.hero}>
        <Image source={require('../assets/images/icon.png')} style={styles.logo} accessibilityLabel="Mwedi Threads" />
        <LoomText serif style={[styles.title, { color: colors.foreground }]}>Your hands are busy.{'\n'}<LoomText serif style={{ color: colors.primary }}>Let your mind rest.</LoomText></LoomText>
        <LoomText style={[styles.line, { color: colors.mutedForeground }]}>Keep every cast-on, color choice and almost-finished sleeve in one place. No streaks to keep and no pressure to finish, just a record of the things you make and the small steps that got you there.</LoomText>
      </View>
      <View style={styles.actions}>
        <LoomButton title="Sign up" onPress={() => router.push('/(auth)/sign-up')} />
        <LoomButton title="Sign in" variant="secondary" onPress={() => router.push('/(auth)/sign-in')} />
      </View>
      <LoomText style={[styles.footnote, { color: colors.mutedForeground }]}>Made for makers, wherever the yarn takes you.</LoomText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  logo: { width: 200, height: 200 },
  title: { fontSize: 34, lineHeight: 40, textAlign: 'center', letterSpacing: -0.6, marginTop: 8 },
  line: { fontSize: 17, lineHeight: 25, textAlign: 'center', maxWidth: 320, marginTop: 14 },
  actions: { gap: 11 },
  footnote: { textAlign: 'center', marginTop: 20, fontSize: 14 },
});
