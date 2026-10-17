import { useState } from 'react';
import { useSignIn, useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Link, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AuthFooter, AuthLink, Brand, FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const colors = useColors();
  const { signIn, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busyGoogle, setBusyGoogle] = useState(false);

  const finishSignIn = async () => {
    await signIn.finalize({
      navigate: async ({ session }) => {
        if (session?.currentTask) {
          setMessage('There is one more account step to complete. Please continue from the browser window.');
          return;
        }
        router.replace('/(tabs)');
      },
    });
  };

  const submit = async () => {
    setMessage('');
    const { error } = await signIn.password({ identifier: identifier.trim(), password });
    if (error) {
      setMessage(error.message || 'That username or password did not work. Please try again.');
      return;
    }
    if (signIn.status === 'complete') {
      await finishSignIn();
    } else if (signIn.status === 'needs_client_trust') {
      setMessage('This account needs an additional verification step. Please sign in on the website to finish setup.');
    } else if (signIn.status === 'needs_second_factor') {
        setMessage('This account has an additional sign-in check enabled. Please continue on the Mwedi Threads website.');
    } else {
      setMessage('We could not complete sign-in. Check your details and try once more.');
    }
  };

  const signInWithGoogle = async () => {
    setMessage('');
    setBusyGoogle(true);
    try {
      const redirectUrl =
        Platform.OS === 'web'
          ? AuthSession.makeRedirectUri()
          : AuthSession.makeRedirectUri({ scheme: 'mwedi', path: 'oauth' });
      const result = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });
      if (result.createdSessionId) {
        await result.setActive!({
          session: result.createdSessionId,
          navigate: async ({ session }) => {
            if (session?.currentTask) {
              setMessage('There is one more account step to complete. Please continue from the browser window.');
              return;
            }
            router.replace('/(tabs)');
          },
        });
      } else if (result.signUp?.status === 'missing_requirements') {
        setMessage('Your Google account needs a username to finish creating the Mwedi Threads account. Start with Create account to choose one.');
      } else {
        setMessage('Google sign-in could not be completed. Please try again.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google sign-in is not available right now.');
    } finally {
      setBusyGoogle(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={24} keyboardShouldPersistTaps="handled">
        <Link href="/" style={styles.brandLink}><Brand /></Link>
        <View style={styles.heading}>
          <LoomText style={[styles.overline, { color: colors.mutedForeground }]}>YOUR WORKROOM</LoomText>
          <LoomText serif style={[styles.title, { color: colors.foreground }]}>Welcome back.</LoomText>
          <LoomText style={[styles.subtitle, { color: colors.mutedForeground }]}>Pick up right where you left off.</LoomText>
        </View>
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LoomButton title="Continue with Google" icon="globe" variant="secondary" onPress={() => void signInWithGoogle()} busy={busyGoogle} testID="button-google-signin" />
          <View style={styles.divider}><View style={[styles.line, { backgroundColor: colors.border }]} /><LoomText style={[styles.dividerText, { color: colors.mutedForeground }]}>OR WITH YOUR ACCOUNT</LoomText><View style={[styles.line, { backgroundColor: colors.border }]} /></View>
          <View style={styles.field}>
            <FormFieldLabel>Username or email</FormFieldLabel>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Your username or email"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
              testID="input-signin-identifier"
            />
          </View>
          <View style={styles.field}>
            <FormFieldLabel>Password</FormFieldLabel>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Your password"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
              testID="input-signin-password"
            />
          </View>
          {message ? <LoomText accessibilityRole="alert" style={[styles.message, { color: colors.destructive }]}>{message}</LoomText> : null}
          <LoomButton title="Sign in" icon="arrow-right" onPress={() => void submit()} busy={fetchStatus === 'fetching'} disabled={!identifier.trim() || !password} testID="button-signin" />
          <AuthFooter><LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>New to Mwedi Threads?</LoomText><AuthLink href="/(auth)/sign-up">Create an account</AuthLink></AuthFooter>
        </View>
        <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={15} color={colors.mutedForeground} /><LoomText style={{ color: colors.mutedForeground, fontSize: 15 }}>Back to welcome</LoomText></Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36 },
  brandLink: { alignSelf: 'center', marginBottom: 31 },
  heading: { alignItems: 'center', marginBottom: 22 },
  overline: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.3, marginBottom: 8 },
  title: { fontSize: 32, textAlign: 'center' },
  subtitle: { fontSize: 16, marginTop: 6, textAlign: 'center' },
  formCard: { borderWidth: 1, borderRadius: 20, padding: 21 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 18 },
  line: { height: 1, flex: 1 },
  dividerText: { fontSize: 13, letterSpacing: 1, fontFamily: fonts.bold },
  field: { marginBottom: 15 },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderRadius: 10, fontFamily: fonts.body, fontSize: 16 },
  message: { fontSize: 15, lineHeight: 22, marginBottom: 13 },
  back: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 20 },
});
