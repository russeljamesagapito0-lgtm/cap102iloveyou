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

const RESEND_COOLDOWN_S = 60;
const CODE_LENGTH = 6;

const VerifyEmailScreen = ({ navigation, route }) => {
  const { themeColors } = useTheme();
  const email = (route?.params?.email || '').trim();
  const pendingProfile = route?.params?.profile || null; 
  const autoResend = !!route?.params?.autoResend;        

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(autoResend ? 0 : RESEND_COOLDOWN_S);
  const didAutoResend = useRef(false);

  const buzz = (type) => Haptics.notificationAsync(type).catch?.(() => {});

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = useCallback(async (silent = false) => {
    setError('');
    setIsLoading(true);
    try {
      const { error: err } = await supabase.auth.resend({ type: 'signup', email });
      if (err) {
        const msg = (err.message || '').toLowerCase();
        if (err.status === 429 || msg.includes('rate limit') || msg.includes('seconds')) {
          setError('Please wait a minute before requesting another code.');
          setCooldown(RESEND_COOLDOWN_S);
        } else {
          setError('Could not send the code. Please try again.');
        }
        buzz(Haptics.NotificationFeedbackType.Error);
        return;
      }
      setCode('');
      setCooldown(RESEND_COOLDOWN_S);
      if (!silent) {
        Toast.show({ type: 'success', text1: 'Code sent', text2: 'Check your email (and spam folder).' });
      }
    } catch (e) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (autoResend && email && !didAutoResend.current) {
      didAutoResend.current = true;
      resend(true);
    }
  }, [autoResend, email, resend]);

  const verify = async () => {
    setError('');
    const token = code.trim();
    if (token.length < CODE_LENGTH) {
      buzz(Haptics.NotificationFeedbackType.Warning);
      return setError(`Please enter the ${CODE_LENGTH}-digit code from your email.`);
    }

    setIsLoading(true);
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
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

      const user = data?.user;
      const profile = pendingProfile || user?.user_metadata?.profile;
      if (user && profile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ ...profile, id: user.id, email });
        if (profileError) console.error('Profile creation error:', profileError.message);
      }

      buzz(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Email verified', text2: 'Welcome to RootCare!' });
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (e) {
      buzz(Haptics.NotificationFeedbackType.Error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7} disabled={isLoading}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: themeColors.primary + '15' }]}>
              <Ionicons name="mail-open-outline" size={36} color={themeColors.primary} />
            </View>
            <Text style={[styles.title, { color: themeColors.primary }]}>Verify Your Email</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              We sent a {CODE_LENGTH}-digit code to {email}. Enter it below to activate your account.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.inputContainer, { backgroundColor: themeColors.card, borderColor: themeColors.outline }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text }]}
                placeholder="------"
                placeholderTextColor={themeColors.textSecondary}
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={8}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="done"
                onSubmitEditing={verify}
              />
            </View>

            <TouchableOpacity style={styles.resendRow} onPress={() => resend(false)} disabled={cooldown > 0 || isLoading} activeOpacity={0.7}>
              <Text style={[styles.resendText, { color: cooldown > 0 ? themeColors.textSecondary : themeColors.primary }]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>

            {!!error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={themeColors.error} />
                <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: themeColors.primary }, isLoading && { opacity: 0.6 }]}
              onPress={verify}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={themeColors['on-primary']} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: themeColors['on-primary'] }]}>Verify Email</Text>
              )}
            </TouchableOpacity>
          </View>
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
  inputContainer: { borderWidth: 1, borderRadius: 8, height: 56 },
  input: { width: '100%', height: '100%', paddingHorizontal: 16, fontSize: 24, letterSpacing: 8, fontWeight: '600', textAlign: 'center', fontFamily: 'OpenSans_400Regular' },
  resendRow: { alignItems: 'center', marginTop: 14 },
  resendText: { fontSize: 14, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'OpenSans_400Regular' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, height: 52, marginTop: 20 },
  primaryButtonText: { fontSize: 14, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold', letterSpacing: 0.5 },
});

export default VerifyEmailScreen;