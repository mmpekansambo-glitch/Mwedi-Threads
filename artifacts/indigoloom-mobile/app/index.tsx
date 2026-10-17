import { Redirect, router } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand, LoomButton, LoomText, LoadingState, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export default function WelcomeScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  if (!isLoaded) return <LoadingState label="Opening Mwedi Threads…" />;
  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top + 18, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}>
      <View style={styles.top}><Brand /></View>
      <View style={styles.hero}>
        <View style={[styles.ornament, { backgroundColor: colors.card }]}>
          <View style={[styles.ornamentRing, { borderColor: colors.accent }]} />
          <Feather name="feather" size={54} color={colors.primary} />
          <View style={[styles.threadDot, { backgroundColor: colors.accent }]} />
        </View>
        <LoomText style={[styles.eyebrow, { color: colors.mutedForeground }]}>A LITTLE HOME FOR YOUR MAKING</LoomText>
        <LoomText serif style={[styles.title, { color: colors.foreground }]}>Your hands are busy.{'\n'}<LoomText serif style={{ color: colors.primary }}>Let your mind rest.</LoomText></LoomText>
        <LoomText style={[styles.lede, { color: colors.mutedForeground }]}>Keep every cast-on, color choice, and almost-finished sleeve in one lovely place.</LoomText>
      </View>
      <View style={styles.actions}>
        <LoomButton title="Make a free account" icon="arrow-right" onPress={() => router.push('/(auth)/sign-up')} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/sign-in')} style={[styles.signIn, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <LoomText style={[styles.signInText, { color: colors.primary }]}>I already have an account</LoomText>
            <Feather name="arrow-up-right" size={16} color={colors.primary} />
        </Pressable>
      </View>
      <LoomText style={[styles.footnote, { color: colors.mutedForeground }]}>For every kind of maker, one stitch at a time.</LoomText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  top: { alignItems: 'center' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  ornament: { width: 184, height: 184, borderRadius: 92, alignItems: 'center', justifyContent: 'center', marginBottom: 32, overflow: 'hidden' },
  ornamentRing: { position: 'absolute', width: 148, height: 92, borderWidth: 1, borderRadius: 80, transform: [{ rotate: '-35deg' }] },
  threadDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', right: 37, top: 41 },
  eyebrow: { letterSpacing: 1.5, fontSize: 13, fontFamily: fonts.bold, marginBottom: 13 },
  title: { fontSize: 34, lineHeight: 40, textAlign: 'center', letterSpacing: -0.6 },
  lede: { fontSize: 17, lineHeight: 25, textAlign: 'center', maxWidth: 320, marginTop: 16 },
  actions: { gap: 11 },
  signIn: { borderWidth: 1, borderRadius: 999, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signInText: { fontSize: 16, fontFamily: fonts.semibold },
  footnote: { textAlign: 'center', marginTop: 20, fontSize: 14 },
});
