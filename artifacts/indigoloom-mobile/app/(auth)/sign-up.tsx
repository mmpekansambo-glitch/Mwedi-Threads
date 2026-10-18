import { useState } from 'react';
import { useSignUp, useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Link, router } from 'expo-router';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AuthFooter, AuthLink, Brand, FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const colors = useColors();
  const { signUp, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [username, setUsername] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [message, setMessage] = useState('');
  const [busyGoogle, setBusyGoogle] = useState(false);

  const finishSignUp = async () => {
    await signUp.finalize({
      navigate: async ({ session }) => {
        if (session?.currentTask) {
          setMessage('There is one more account step to complete. Please continue from the browser window.');
          return;
        }
        router.replace('/(tabs)');
      },
    });
  };

  const createAccount = async () => {
    setMessage('');
    const { error } = await signUp.password({
      username: username.trim(),
      emailAddress: emailAddress.trim(),
      password,
    });
    if (error) {
      setMessage(error.message || 'We could not create that account. Check your details and try again.');
      return;
    }
    if (signUp.status === 'complete') {
      await finishSignUp();
      return;
    }
    if (signUp.status === 'missing_requirements') {
      if (signUp.missingFields.includes('username')) {
        const { error: updateError } = await signUp.update({ username: username.trim() });
        if (updateError) {
          setMessage(updateError.message || 'That username could not be saved.');
          return;
        }
      }
      if (signUp.unverifiedFields.includes('email_address')) {
        const { error: codeError } = await signUp.verifications.sendEmailCode();
        if (codeError) {
          setMessage(codeError.message || 'We could not send a verification code.');
          return;
        }
        setStep('verify');
      } else {
        await finishSignUp();
      }
    }
  };

  const verifyEmail = async () => {
    setMessage('');
    const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (error) {
      setMessage(error.message || 'That code did not match. Check it and try again.');
      return;
    }
    if (signUp.status === 'complete') {
      await finishSignUp();
    } else {
      setMessage('Your email is verified. One more account detail is required before you can continue.');
    }
  };

  const signUpWithGoogle = async () => {
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
        setMessage('Google sign-up needs one more account detail. Start with the form below to choose a username.');
      } else {
        setMessage('Google sign-up could not be completed. Please try again.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google sign-up is not available right now.');
    } finally {
      setBusyGoogle(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={28} keyboardShouldPersistTaps="handled">
        <Link href="/" style={styles.brandLink}><Brand /></Link>
        <View style={styles.heading}>
          <LoomText style={[styles.overline, { color: colors.mutedForeground }]}>{step === 'verify' ? 'ONE QUICK CHECK' : 'MAKE YOURSELF AT HOME'}</LoomText>
          <LoomText serif style={[styles.title, { color: colors.foreground }]}>{step === 'verify' ? 'Check your email.' : 'Make room to make.'}</LoomText>
          <LoomText style={[styles.subtitle, { color: colors.mutedForeground }]}>{step === 'verify' ? `Enter the code we sent to ${emailAddress}.` : 'A small, quiet home for every project.'}</LoomText>
        </View>
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {step === 'details' ? (
            <>
              <LoomButton title="Create account with Google" icon="globe" variant="secondary" onPress={() => void signUpWithGoogle()} busy={busyGoogle} testID="button-google-signup" />
              <View style={styles.divider}><View style={[styles.line, { backgroundColor: colors.border }]} /><LoomText style={[styles.dividerText, { color: colors.mutedForeground }]}>OR WITH A PASSWORD</LoomText><View style={[styles.line, { backgroundColor: colors.border }]} /></View>
              <View style={styles.field}>
                <FormFieldLabel>Username</FormFieldLabel>
                <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="Choose a username" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]} testID="input-signup-username" />
              </View>
              <View style={styles.field}>
                <FormFieldLabel>Email address</FormFieldLabel>
                <TextInput value={emailAddress} onChangeText={setEmailAddress} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]} testID="input-signup-email" />
              </View>
              <View style={styles.field}>
                <FormFieldLabel>Password</FormFieldLabel>
                <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Create a password" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]} testID="input-signup-password" />
              </View>
              <LoomText style={[styles.hint, { color: colors.mutedForeground }]}>Your username is how you’ll sign in and be recognized in your workroom.</LoomText>
              {message ? <LoomText accessibilityRole="alert" style={[styles.message, { color: colors.destructive }]}>{message}</LoomText> : null}
              <LoomButton title="Create my account" icon="arrow-right" onPress={() => void createAccount()} busy={fetchStatus === 'fetching'} disabled={!username.trim() || !emailAddress.trim() || password.length < 8} testID="button-signup" />
            </>
          ) : (
            <>
              <View style={styles.field}>
                <FormFieldLabel>Email verification code</FormFieldLabel>
                <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" autoCapitalize="none" placeholder="Enter the code" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]} testID="input-signup-code" />
              </View>
              {message ? <LoomText accessibilityRole="alert" style={[styles.message, { color: colors.destructive }]}>{message}</LoomText> : null}
              <LoomButton title="Verify and continue" icon="check" onPress={() => void verifyEmail()} busy={fetchStatus === 'fetching'} disabled={!code.trim()} testID="button-verify-email" />
              <LoomButton title="Send a new code" variant="quiet" onPress={() => void signUp.verifications.sendEmailCode()} />
            </>
          )}
          <AuthFooter><LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>Already have an account?</LoomText><AuthLink href="/(auth)/sign-in">Sign in</AuthLink></AuthFooter>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 26, paddingBottom: 38 },
  brandLink: { alignSelf: 'center', marginBottom: 25 },
  heading: { alignItems: 'center', marginBottom: 19 },
  overline: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.3, marginBottom: 8 },
  title: { fontSize: 30, textAlign: 'center' },
  subtitle: { fontSize: 16, marginTop: 6, textAlign: 'center' },
  formCard: { borderWidth: 1, borderRadius: 20, padding: 21 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 17 },
  line: { height: 1, flex: 1 },
  dividerText: { fontSize: 13, letterSpacing: 1, fontFamily: fonts.bold },
  field: { marginBottom: 14 },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderRadius: 10, fontFamily: fonts.body, fontSize: 16 },
  hint: { fontSize: 14, lineHeight: 20, marginTop: -4, marginBottom: 14 },
  message: { fontSize: 15, lineHeight: 22, marginBottom: 13 },
});
