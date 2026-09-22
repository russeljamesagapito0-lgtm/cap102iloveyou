// screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
  KeyboardAvoidingView, ScrollView, ActivityIndicator, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../utils/supabaseClient';
import { useTheme } from '../context/ThemeContext';

const CustomModal = ({ visible, onClose, title, message, type = 'success', onConfirm, themeColors }) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle', color: '#27AE60' };
      case 'error': return { name: 'alert-circle', color: themeColors.error };
      case 'warning': return { name: 'warning', color: '#F39C12' };
      default: return { name: 'information-circle', color: themeColors.primary };
    }
  };
  const icon = getIcon();

  const handleActionPress = () => {
    onClose();
    if (onConfirm) setTimeout(() => onConfirm(), 300);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: themeColors.card }]}>
          <View style={[styles.modalIconContainer, { backgroundColor: icon.color + '15' }]}>
            <Ionicons name={icon.name} size={48} color={icon.color} />
          </View>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>{title}</Text>
          <Text style={[styles.modalMessage, { color: themeColors.textSecondary }]}>{message}</Text>
          <View style={styles.modalButtonContainer}>
            {type === 'success' ? (
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: themeColors.primary }]} onPress={handleActionPress} activeOpacity={0.8}>
                <Text style={[styles.modalButtonText, { color: themeColors['on-primary'] }]}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: themeColors.surface }]} onPress={onClose} activeOpacity={0.8}>
                  <Text style={[styles.modalCancelButtonText, { color: themeColors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: themeColors.primary }]} onPress={handleActionPress} activeOpacity={0.8}>
                  <Text style={[styles.modalButtonText, { color: themeColors['on-primary'] }]}>OK</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const LoginScreen = ({ navigation }) => {
  const { themeColors, isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('success');
  const [modalOnConfirm, setModalOnConfirm] = useState(null);

  const showModal = (title, message, type = 'success', onConfirm = null) => {
    setModalTitle(title); setModalMessage(message); setModalType(type);
    setModalOnConfirm(() => onConfirm); setModalVisible(true);
  };
  const closeModal = () => setModalVisible(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return showModal('Missing Information', 'Please enter both email and password.', 'warning');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return showModal('Invalid Email', 'Please enter a valid email address.', 'warning');
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      });

      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        let message = 'An error occurred during login.';
        if (error.message.includes('Invalid login credentials')) message = 'Invalid email or password. Please try again.';
        else if (error.message.includes('Email not confirmed')) message = 'Please confirm your email address before logging in.';
        return showModal('Error', message, 'error');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showModal('Welcome Back! 🎉', 'You have successfully logged in to RootCare.', 'success', () => navigation.replace('MainTabs'));
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showModal('Error', 'An unexpected error occurred. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showModal('Guest Mode', "Continue as a guest? You'll have limited access to features.", 'warning', () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('MainTabs');
    });
  };

  const handleForgotPassword = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!email) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return showModal('Email Required', 'Please enter your email address first.', 'warning');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return showModal('Invalid Email', 'Please enter a valid email address.', 'warning');
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showModal('Error', 'Failed to send password reset email. Please try again.', 'error');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showModal('Password Reset Sent', 'Check your email for password reset instructions.', 'success', () => closeModal());
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showModal('Error', 'An unexpected error occurred. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Register');
  };

  const formContent = (
    <>
      <View style={styles.logoSection}>
        <View style={[styles.logoContainer, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={[styles.welcomeText, { color: themeColors.primary }]}>Welcome Back</Text>
        <Text style={[styles.subtitleText, { color: themeColors.textSecondary }]}>Sign in to manage your fields</Text>
      </View>

      <View style={[styles.formContainer, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.inputWrapper}>
          <View style={[styles.inputContainer, { backgroundColor: themeColors.card, borderColor: emailFocused ? themeColors.primary : themeColors.outline }]}>
            <TextInput
              style={[styles.input, { color: themeColors.text }]}
              placeholder=" "
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text pointerEvents="none" style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: themeColors.card }, (emailFocused || email) && { top: 6, fontSize: 12, color: themeColors.primary }]}>
              Email Address
            </Text>
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <View style={[styles.inputContainer, { backgroundColor: themeColors.card, borderColor: passwordFocused ? themeColors.primary : themeColors.outline }]}>
            <TextInput
              style={[styles.input, styles.passwordInput, { color: themeColors.text }]}
              placeholder=" "
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <Text pointerEvents="none" style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: themeColors.card }, (passwordFocused || password) && { top: 6, fontSize: 12, color: themeColors.primary }]}>
              Password
            </Text>
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPassword} activeOpacity={0.7}>
          <Text style={[styles.forgotPasswordText, { color: themeColors.primary }]}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, { backgroundColor: themeColors.primary }, isLoading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={themeColors['on-primary']} />
          ) : (
            <>
              <Text style={[styles.loginButtonText, { color: themeColors['on-primary'] }]}>Login</Text>
              <Ionicons name="arrow-forward" size={20} color={themeColors['on-primary']} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
          <Text style={[styles.dividerText, { color: themeColors.textSecondary }]}>Or</Text>
          <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); showModal('Google Sign In', 'Google authentication will be available soon!', 'info'); }}
          activeOpacity={0.7}
        >
          <View style={styles.googleIcon}><Text style={styles.googleIconText}>G</Text></View>
          <Text style={[styles.googleButtonText, { color: themeColors.text }]}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.guestButton} onPress={handleGuestLogin} activeOpacity={0.7}>
          <Ionicons name="person-outline" size={20} color={themeColors.primary} />
          <Text style={[styles.guestButtonText, { color: themeColors.primary }]}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.registerContainer}>
        <Text style={[styles.registerText, { color: themeColors.textSecondary }]}>Don't have an account? </Text>
        <TouchableOpacity onPress={handleRegister} activeOpacity={0.7}>
          <Text style={[styles.registerLink, { color: themeColors.primary }]}>Register</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {formContent}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {formContent}
        </ScrollView>
      )}

      <CustomModal
        visible={modalVisible}
        onClose={closeModal}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        onConfirm={modalOnConfirm}
        themeColors={themeColors}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoContainer: { width: 100, height: 100, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1 },
  logo: { width: 80, height: 80 },
  welcomeText: { fontSize: 28, fontWeight: '700', fontFamily: 'Montserrat_700Bold', marginBottom: 4 },
  subtitleText: { fontSize: 16, fontFamily: 'OpenSans_400Regular' },
  formContainer: { borderRadius: 12, padding: 20, borderWidth: 1 },
  inputWrapper: { marginBottom: 16 },
  inputContainer: { position: 'relative', borderWidth: 1, borderRadius: 8, height: 56 },
  input: { width: '100%', height: '100%', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, fontSize: 16, fontFamily: 'OpenSans_400Regular' },
  passwordInput: { paddingRight: 48 },
  floatingLabel: { position: 'absolute', left: 16, top: 18, fontSize: 16, fontFamily: 'OpenSans_400Regular', paddingHorizontal: 4 },
  eyeIcon: { position: 'absolute', right: 12, top: 16, padding: 4 },
  forgotPasswordContainer: { alignItems: 'flex-end', marginBottom: 16 },
  forgotPasswordText: { fontSize: 14, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold' },
  loginButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, height: 56, gap: 8, marginBottom: 16 },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { fontSize: 14, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold', letterSpacing: 0.5 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'OpenSans_500Medium' },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 8, height: 56, gap: 12, marginBottom: 12 },
  googleIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' },
  googleIconText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  googleButtonText: { fontSize: 14, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold' },
  guestButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, height: 48, gap: 8 },
  guestButtonText: { fontSize: 14, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold' },
  registerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  registerText: { fontSize: 16, fontFamily: 'OpenSans_400Regular' },
  registerLink: { fontSize: 14, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center' },
  modalIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', fontFamily: 'Montserrat_700Bold', marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 15, fontFamily: 'OpenSans_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  modalButtonContainer: { flexDirection: 'row', gap: 12, width: '100%' },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalButtonText: { fontSize: 15, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold' },
  modalCancelButtonText: { fontSize: 15, fontWeight: '600', fontFamily: 'OpenSans_600SemiBold' },
});

export default LoginScreen;