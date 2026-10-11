// screens/ForgotPasswordScreen.js
// Flow: 1) enter email -> 2) enter 6-digit code from email -> 3) set new password
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
  KeyboardAvoidingView, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { supabase } from '../utils/supabaseClient';
import { useTheme } from '../context/ThemeContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6; // same rule as RegisterScreen
const RESEND_COOLDOWN_S = 60;

const STEP_EMAIL = 'email';
const STEP_CODE = 'code';
const STEP_PASSWORD = 'password';

const ForgotPasswordScreen = ({ navigation, route }) => {
  const { themeColors } = useTheme();

  const [step, setStep] = useState(STEP_EMAIL);
  const [email, setEmail] = useState(route?.params?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Tracks whether the code was verified (which creates a session) but the
  // password was never changed, so we can sign that session out on exit.
  const verifiedRef = useRef(false);
  const completedRef = useRef(false);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // If the user leaves after verifying the code but before saving a new
  // password, drop the temporary session so they aren't silently logged in.
  useEffect(() => {
    return () => {
      if (verifiedRef.current && !completedRef.current) {
        supabase.auth.signOut().catch(() => {});
      }
    };
  }, []);

  const buzz = (type) => Haptics.notificationAsync(type).catch?.(() => {});

  const sendCode = useCallback(async () => {
    setError('');
    const trimmed = email.trim();
    if (!trimmed) {
      buzz(Haptics.NotificationFeedbackType.Warning);
      return setError('Please enter your email address.');
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      buzz(Haptics.NotificationFeedbackType.Warning);
      return setError('Please enter a valid email address.');
    }

    setIsLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed);
      if (err) {
        buzz(Haptics.NotificationFeedbackType.Error);
        const msg = (err.message || '').toLowerCase();
        if (err.status === 429 || msg.includes('rate limit') || msg.includes('seconds')) {
          setError('Please wait a minute before requesting another code.');
        } else {
          setError('Could not send the code. Please try again.');
        }
        return;
      }
      buzz(Haptics.NotificationFeedbackType.Success);
      setCode('');
      setCooldown(RESEND_COOLDOWN_S);
      setStep(STEP_CODE);
      Toast.show({ type: 'success', text1: 'Code sent', text2: 'Check your email (and spam folder).' });
    } catch (e) {
      buzz(Haptics.NotificationFeedbackType.Error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const verifyCode = async () => {
    setError('');
    const token = code.trim();
    if (token.length < 6) {
      buzz(Haptics.NotificationFeedbackType.Warning);
      return setError('Please enter the 6-digit code from your email.');
    }

    setIsLoading(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'recovery',
      });
      if (err) {
        buzz(Haptics.NotificationFeedbackType.Error);
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('expired') || msg.includes('invalid')) {
          setError('That code is invalid or has expired. Request a new one.');
        } else {
          setError('Could not verify the code. Please try again.');
        }
        return;
      }
      verifiedRef.current = true;
      buzz(Haptics.NotificationFeedbackType.Success);
      setStep(STEP_PASSWORD);
    } catch (e) {
      buzz(Haptics.NotificationFeedbackType.Error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const savePassword = async () => {
    setError('');
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      buzz(Haptics.NotificationFeedbackType.Warning);
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (confirmPassword !== password) {
      buzz(Haptics.NotificationFeedbackType.Warning);
      return setError('Passwords do not match.');
    }

    setIsLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        buzz(Haptics.NotificationFeedbackType.Error);
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('different from the old password') || msg.includes('same')) {
          setError('Your new password must be different from the old one.');
        } else {
          setError('Could not update your password. Please try again.');
        }
        return;
      }

      completedRef.current = true;
      await supabase.auth.signOut().catch(() => {});
      buzz(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Password updated', text2: 'Please log in with your new password.' });
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      buzz(Haptics.NotificationFeedbackType.Error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    setError('');
    if (step === STEP_CODE) setStep(STEP_EMAIL);
    else navigation.goBack();
  };

  const field = (borderColor) => [
    styles.inputContainer,
    { backgroundColor: themeColors.card, borderColor },
  ];

  const titles = {
    [STEP_EMAIL]: { title: 'Forgot Password?', sub: "Enter your email and we'll send you a 6-digit code." },
    [STEP_CODE]: { title: 'Enter Code', sub: `We sent a code to ${email.trim()}.` },
    [STEP_PASSWORD]: { title: 'New Password', sub: 'Choose a new password for your account.' },
  };

  const primaryAction = { [STEP_EMAIL]: sendCode, [STEP_CODE]: verifyCode, [STEP_PASSWORD]: savePassword }[step];
  const primaryLabel = { [STEP_EMAIL]: 'Send Code', [STEP_CODE]: 'Verify Code', [STEP_PASSWORD]: 'Update Password' }[step];

  const body = (
    <>
      <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7} disabled={isLoading}>
        <Ionicons name="arrow-back" size={24} color={themeColors.text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: themeColors.primary + '15' }]}>
          <Ionicons
            name={step === STEP_PASSWORD ? 'lock-closed-outline' : step === STEP_CODE ? 'keypad-outline' : 'mail-outline'}
            size={36}
            color={themeColors.primary}
          />
        </View>
        <Text style={[styles.title, { color: themeColors.primary }]}>{titles[step].title}</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{titles[step].sub}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        {step === STEP_EMAIL && (
          <View style={field(themeColors.outline)}>
            <TextInput
              style={[styles.input, { color: themeColors.text }]}
              placeholder="Email address"
              placeholderTextColor={themeColors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={sendCode}
            />
          </View>
        )}

        {step === STEP_CODE && (
          <>
            <View style={field(themeColors.outline)}>
              <TextInput
                style={[styles.input, styles.codeInput, { color: themeColors.text }]}
                placeholder="------"
                placeholderTextColor={themeColors.textSecondary}
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={8}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="done"
                onSubmitEditing={verifyCode}
              />
            </View>
            <TouchableOpacity
              style={styles.resendRow}
              onPress={sendCode}
              disabled={cooldown > 0 || isLoading}
              activeOpacity={0.7}
            >
              <Text style={[styles.resendText, { color: cooldown > 0 ? themeColors.textSecondary : themeColors.primary }]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === STEP_PASSWORD && (
          <>
            <View style={[field(themeColors.outline), styles.gap]}>
              <TextInput
                style={[styles.input, styles.passwordInput, { color: themeColors.text }]}
                placeholder={`New password (min ${MIN_PASSWORD_LENGTH} chars)`}
                placeholderTextColor={themeColors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={field(themeColors.outline)}>
              <TextInput
                style={[styles.input, styles.passwordInput, { color: themeColors.text }]}
                placeholder="Confirm new password"
                placeholderTextColor={themeColors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={savePassword}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirm(!showConfirm)} activeOpacity={0.7}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={22} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {!!error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={themeColors.error} />
            <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: themeColors.primary }, isLoading && { opacity: 0.6 }]}
          onPress={primaryAction}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={themeColors['on-primary']} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: themeColors['on-primary'] }]}>{primaryLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  header: { alignItems: 'center', marginBottom: 28 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', fontFamily: 'Montserrat_700Bold', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: 'OpenSans_400Regular', textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  card: { borderRadius: 12, padding: 20, borderWidth: 1 },
  inputContainer: { position: 'relative', borderWidth: 1, borderRadius: 8, height: 56 },
  gap: { marginBottom: 16 },
  input: { width: '100%', height: '100%', paddingHorizontal: 16, fontSize: 16, fontFamily: 'OpenSans_400Regular' },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '600' },
  passwordInput: { paddingRight: 48 },
  eyeIcon: { position: 'absolute', right: 12, top: 16, padding: 4 },
  resendRow: { alignItems: 'center', marginTop: 14 },
  resendText: { fontSize: 14, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'OpenSans_400Regular' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, height: 52, marginTop: 20 },
  primaryButtonText: { fontSize: 14, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold', letterSpacing: 0.5 },
});

export default ForgotPasswordScreen;
