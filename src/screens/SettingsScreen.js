// screens/SettingsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { decode as base64Decode } from 'base64-arraybuffer';
import { supabase } from '../utils/supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { pushNotification } from '../utils/notifications';

const SettingsScreen = ({ navigation }) => {
  const { isDarkMode, toggleDarkMode, themeColors } = useTheme();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [weatherAlerts, setWeatherAlerts] = useState(true);
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  // Profile
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Feedback modal
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedback, setFeedback] = useState({ type: 'success', title: '', body: '' });

  const showSuccess = (title, body) => {
    setFeedback({ type: 'success', title, body });
    setFeedbackVisible(true);
  };

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ---------- LOAD PROFILE ----------
  const loadProfile = useCallback(async () => {
    try {
      setLoadingProfile(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setLoadingProfile(false);
        return;
      }

      setEmail(session.user.email || '');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.warn('Profile load failed:', error.message);
      } else if (data) {
        setFirstName(data.first_name || '');
        setMiddleName(data.middle_name || '');
        setSurname(data.last_name || '');
        setProfileImage(data.avatar_url || null);
        setPushNotifications(data.push_notifications ?? true);
        setWeatherAlerts(data.weather_alerts ?? true);
      }
    } catch (err) {
      console.warn('Profile load error:', err.message);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ---------- AVATAR UPLOAD ----------
  const uploadAvatar = async (uri, userId) => {
    try {
      setUploadingAvatar(true);

      const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const path = `${userId}/avatar.${ext}`;

      // Expo SDK 54 API
      const file = new File(uri);
      const base64 = await file.base64();

      const arrayBuffer = base64Decode(base64);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, {
          upsert: true,
          contentType: mime,
        });

      if (uploadError) {
        console.warn('Avatar upload failed:', uploadError.message);
        Alert.alert('Upload failed', uploadError.message);
        return null;
      }

      const { data: publicUrl } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      return `${publicUrl.publicUrl}?t=${Date.now()}`;
    } catch (err) {
      console.warn('Upload error:', err.message);
      Alert.alert('Upload error', err.message || 'Could not upload image.');
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const localUri = result.assets[0].uri;
    setProfileImage(localUri);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const publicUrl = await uploadAvatar(localUri, session.user.id);
    if (!publicUrl) {
      setProfileImage(null);
      return;
    }

    setProfileImage(publicUrl);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 🔔 Log the update
    await pushNotification({
      type: 'avatar_updated',
      title: 'Profile photo updated',
      body: 'Your new profile picture has been saved.',
    });
  };

  // ---------- SAVE PROFILE ----------
  const saveProfile = async () => {
    if (savingProfile) return;

    if (!firstName.trim()) {
      Alert.alert('Missing name', 'First name is required.');
      return;
    }

    setSavingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        Alert.alert('Not signed in', 'Please sign in again.');
        return;
      }

      const payload = {
        id: session.user.id,
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: surname.trim(),
        display_name: `${firstName.trim()} ${surname.trim()}`.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload);

      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Save failed', error.message);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 🔔 Log the update
      await pushNotification({
        type: 'profile_updated',
        title: 'Profile updated',
        body: `Your name was changed to ${payload.display_name}.`,
      });

      setActiveModal(null);
      showSuccess('Profile Updated', 'Your changes have been saved.');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save failed', err.message || 'Unknown error.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ---------- CHANGE PASSWORD ----------
  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }

    setSavingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        Alert.alert('Not signed in');
        return;
      }

      if (currentPassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: currentPassword,
        });
        if (signInError) {
          Alert.alert('Wrong password', 'Current password is incorrect.');
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveModal(null);
      showSuccess('Password Updated', 'Use your new password next time you sign in.');

      // 🔔 Log the update
      await pushNotification({
        type: 'password_changed',
        title: 'Password changed',
        body: 'Your account password was updated successfully.',
      });
    } catch (err) {
      Alert.alert('Update failed', err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  // ---------- NOTIFICATION TOGGLES ----------
  const persistToggle = async (key, value) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
    if (error) console.warn('Toggle persist failed:', error.message);
  };

  const handlePushToggle = (value) => {
    setPushNotifications(value);
    persistToggle('push_notifications', value);
  };

  const handleWeatherToggle = (value) => {
    setWeatherAlerts(value);
    persistToggle('weather_alerts', value);
  };

  // ---------- LOGOUT ----------
  const handleExit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExitConfirmVisible(true);
  };

  const cancelExit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExitConfirmVisible(false);
  };

  const confirmExit = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setExitConfirmVisible(false);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Supabase logout error:', error);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    }
  };

  // ---------- FEEDBACK MODAL ----------
  const renderFeedbackModal = () => (
    <Modal visible={feedbackVisible} transparent animationType="fade" onRequestClose={() => setFeedbackVisible(false)}>
      <View style={styles.modalOverlayConfirm}>
        <View style={[styles.confirmModalCard, { backgroundColor: themeColors.surface }]}>
          <View style={[styles.exitIconCircle, { backgroundColor: themeColors.primary }]}>
            <Ionicons name="checkmark" size={32} color={themeColors['on-primary']} />
          </View>
          <Text style={[styles.confirmModalTitle, { color: themeColors.text }]}>
            {feedback.title}
          </Text>
          <Text style={[styles.confirmModalBody, { color: themeColors.textSecondary }]}>
            {feedback.body}
          </Text>
          <TouchableOpacity
            style={[styles.exitConfirmButton, { backgroundColor: themeColors.primary }]}
            onPress={() => setFeedbackVisible(false)}
            activeOpacity={0.85}
          >
            <Text style={[styles.exitConfirmButtonText, { color: themeColors['on-primary'] }]}>
              OK
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ---------- MAIN MODAL ----------
  const renderModal = () => {
    if (!activeModal) return null;

    const modalTitles = {
      profile: 'Edit Profile',
      password: 'Change Password',
      security: 'Security & Privacy',
      help: 'Help Center',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
    };

    return (
      <Modal
        visible={!!activeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, { backgroundColor: themeColors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalBackButton}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: themeColors.text }]}>
                {modalTitles[activeModal]}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {activeModal === 'profile' && (
                <>
                  <View style={styles.profileImageContainer}>
                    <TouchableOpacity onPress={pickImage} disabled={uploadingAvatar}>
                      {profileImage ? (
                        <Image source={{ uri: profileImage }} style={styles.profileAvatarLarge} />
                      ) : (
                        <View style={[styles.profileAvatarLarge, { backgroundColor: themeColors.primary }]}>
                          <Text style={styles.profileInitialLarge}>
                            {(firstName || 'R').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {uploadingAvatar && (
                        <View style={[styles.profileAvatarLarge, styles.avatarOverlay]}>
                          <ActivityIndicator color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editPhotoButton, { backgroundColor: themeColors.primary }]}
                      onPress={pickImage}
                      disabled={uploadingAvatar}
                    >
                      <Ionicons name="camera" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.modalSectionTitle, { color: themeColors.textSecondary }]}>First Name</Text>
                  <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <Ionicons name="person-outline" size={20} color={themeColors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: themeColors.text }]}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="First Name"
                      placeholderTextColor={themeColors.textSecondary}
                    />
                  </View>

                  <Text style={[styles.modalSectionTitle, { color: themeColors.textSecondary }]}>Middle Name</Text>
                  <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <Ionicons name="person-outline" size={20} color={themeColors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: themeColors.text }]}
                      value={middleName}
                      onChangeText={setMiddleName}
                      placeholder="Middle Name"
                      placeholderTextColor={themeColors.textSecondary}
                    />
                  </View>

                  <Text style={[styles.modalSectionTitle, { color: themeColors.textSecondary }]}>Surname</Text>
                  <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <Ionicons name="person-outline" size={20} color={themeColors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: themeColors.text }]}
                      value={surname}
                      onChangeText={setSurname}
                      placeholder="Surname"
                      placeholderTextColor={themeColors.textSecondary}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.modalSaveButton, { backgroundColor: themeColors.primary }, savingProfile && { opacity: 0.7 }]}
                    onPress={saveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalSaveButtonText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {activeModal === 'password' && (
                <>
                  <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
                    Enter your current password and set a new, secure password.
                  </Text>

                  <Text style={[styles.modalSectionTitle, { color: themeColors.textSecondary }]}>Current Password</Text>
                  <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={themeColors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: themeColors.text }]}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor={themeColors.textSecondary}
                      secureTextEntry
                    />
                  </View>

                  <Text style={[styles.modalSectionTitle, { color: themeColors.textSecondary }]}>New Password</Text>
                  <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={themeColors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: themeColors.text }]}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor={themeColors.textSecondary}
                      secureTextEntry
                    />
                  </View>

                  <Text style={[styles.modalSectionTitle, { color: themeColors.textSecondary }]}>Confirm New Password</Text>
                  <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={themeColors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: themeColors.text }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={themeColors.textSecondary}
                      secureTextEntry
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.modalSaveButton, { backgroundColor: themeColors.primary }, savingPassword && { opacity: 0.7 }]}
                    onPress={changePassword}
                    disabled={savingPassword}
                  >
                    {savingPassword ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalSaveButtonText}>Update Password</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {activeModal === 'security' && (
                <>
                  <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
                    Manage how your data is secured and how you interact with RootCare.
                  </Text>

                  <View style={[styles.settingRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <View style={styles.settingRowLeft}>
                      <Ionicons name="finger-print-outline" size={22} color={themeColors.textSecondary} />
                      <Text style={[styles.settingRowLabel, { color: themeColors.text }]}>Biometric Login</Text>
                    </View>
                    <Switch
                      value={false}
                      onValueChange={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                      trackColor={{ false: '#D1D1D6', true: themeColors.primary }}
                      thumbColor={'#FFFFFF'}
                    />
                  </View>

                  <View style={[styles.settingRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <View style={styles.settingRowLeft}>
                      <Ionicons name="eye-off-outline" size={22} color={themeColors.textSecondary} />
                      <Text style={[styles.settingRowLabel, { color: themeColors.text }]}>Two-Factor Authentication</Text>
                    </View>
                    <Switch
                      value={false}
                      onValueChange={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                      trackColor={{ false: '#D1D1D6', true: themeColors.primary }}
                      thumbColor={'#FFFFFF'}
                    />
                  </View>

                  <View style={[styles.settingRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <View style={styles.settingRowLeft}>
                      <Ionicons name="trash-outline" size={22} color={themeColors.error} />
                      <Text style={[styles.settingRowLabel, { color: themeColors.error }]}>Delete Account</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        Alert.alert(
                          'Delete Account',
                          'This action is permanent and will erase all your scans, notes, and profile data. Continue?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete Forever',
                              style: 'destructive',
                              onPress: async () => {
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.user?.id) return;
                                await supabase.from('scans').delete().eq('user_id', session.user.id);
                                await supabase.from('profiles').delete().eq('id', session.user.id);
                                await supabase.auth.signOut();
                                navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {activeModal === 'help' && (
                <View>
                  <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
                    We are here to assist you! Browse our frequently asked questions or contact support.
                  </Text>

                  <View style={[styles.settingRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <View style={styles.settingRowLeft}>
                      <Ionicons name="help-circle-outline" size={22} color={themeColors.textSecondary} />
                      <Text style={[styles.settingRowLabel, { color: themeColors.text }]}>How do I scan a plant?</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                  </View>

                  <View style={[styles.settingRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                    <View style={styles.settingRowLeft}>
                      <Ionicons name="help-circle-outline" size={22} color={themeColors.textSecondary} />
                      <Text style={[styles.settingRowLabel, { color: themeColors.text }]}>Why is my result inaccurate?</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                  </View>

                  <TouchableOpacity
                    style={[styles.modalSaveButton, { backgroundColor: themeColors.primary }]}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Contact Support', 'Email us at support@rootcare.farm');
                    }}
                  >
                    <Text style={styles.modalSaveButtonText}>Contact Support</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeModal === 'terms' && (
                <View>
                  <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>Last Updated: January 2024</Text>
                  <Text style={[styles.legalText, { color: themeColors.text }]}>
                    1. ACCEPTANCE OF TERMS {'\n\n'}
                    By using RootCare, you agree to be bound by these Terms of Service. {'\n\n'}
                    2. DESCRIPTION OF SERVICE {'\n\n'}
                    RootCare provides AI-powered disease detection for cassava plants and farming insights. {'\n\n'}
                    3. USER OBLIGATIONS {'\n\n'}
                    - You must provide accurate information {'\n'}
                    - You are responsible for maintaining account security {'\n'}
                    - You must not misuse the service {'\n\n'}
                    4. PRIVACY POLICY {'\n\n'}
                    Your data is protected according to our Privacy Policy.
                  </Text>
                </View>
              )}

              {activeModal === 'privacy' && (
                <View>
                  <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>Last Updated: January 2024</Text>
                  <Text style={[styles.legalText, { color: themeColors.text }]}>
                    1. INFORMATION WE COLLECT {'\n\n'}
                    - Personal information (name, email, phone) {'\n'}
                    - Farm data and location {'\n'}
                    - Images uploaded for disease detection {'\n\n'}
                    2. HOW WE USE YOUR DATA {'\n\n'}
                    - To provide disease detection services {'\n'}
                    - To improve our AI models {'\n\n'}
                    3. DATA SECURITY {'\n\n'}
                    We implement industry-standard security measures to protect your data.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <View style={[styles.header, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: themeColors.text }]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
      >
        <TouchableOpacity
          style={[styles.profileSection, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          onPress={() => setActiveModal('profile')}
          activeOpacity={0.7}
        >
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, { backgroundColor: themeColors.primary }]}>
              <Text style={styles.profileInitial}>
                {loadingProfile ? '…' : (firstName || 'R').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: themeColors.text }]} numberOfLines={1}>
              {loadingProfile ? 'Loading…' : `${firstName} ${surname}`.trim() || 'RootCare User'}
            </Text>
            <Text style={[styles.profileEmail, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {email || '—'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
        </TouchableOpacity>

        <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>Account</Text>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setActiveModal('profile')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={20} color={themeColors.secondary} />
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setActiveModal('password')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={themeColors.secondary} />
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setActiveModal('security')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={themeColors.secondary} />
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Security & Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>Appearance</Text>

          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.switchLabel, { color: themeColors.text }]}>Dark Mode</Text>
              <Text style={[styles.switchSubtext, { color: themeColors.textSecondary }]}>
                {isDarkMode ? 'On' : 'Off'}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: '#D1D1D6', true: themeColors.primary }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>Notifications</Text>

          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.switchLabel, { color: themeColors.text }]}>Push Notifications</Text>
              <Text style={[styles.switchSubtext, { color: themeColors.textSecondary }]}>Get real-time alerts</Text>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={handlePushToggle}
              trackColor={{ false: '#D1D1D6', true: themeColors.primary }}
              thumbColor={'#FFFFFF'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.switchLabel, { color: themeColors.text }]}>Weather Alerts</Text>
              <Text style={[styles.switchSubtext, { color: themeColors.textSecondary }]}>Weather warnings for your area</Text>
            </View>
            <Switch
              value={weatherAlerts}
              onValueChange={handleWeatherToggle}
              trackColor={{ false: '#D1D1D6', true: themeColors.primary }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>Support & Info</Text>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setActiveModal('help')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-buoy-outline" size={20} color={themeColors.secondary} />
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Help Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setActiveModal('terms')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={20} color={themeColors.secondary} />
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setActiveModal('privacy')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={20} color={themeColors.secondary} />
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.exitButton, { borderColor: themeColors.error }]}
          onPress={handleExit}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color={themeColors.error} />
          <Text style={[styles.exitText, { color: themeColors.error }]}>Log Out</Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: themeColors.textSecondary }]}>
          RootCare Version 2.4.1 (Stable)
        </Text>
      </ScrollView>

      <Modal
        visible={exitConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelExit}
      >
        <View style={styles.modalOverlayConfirm}>
          <View style={[styles.confirmModalCard, { backgroundColor: themeColors.surface }]}>
            <View style={[styles.exitIconCircle, { backgroundColor: themeColors['error-container'] }]}>
              <Ionicons name="log-out-outline" size={30} color={themeColors.error} />
            </View>

            <Text style={[styles.confirmModalTitle, { color: themeColors.text }]}>Logout App</Text>
            <Text style={[styles.confirmModalBody, { color: themeColors.textSecondary }]}>
              Are you sure you want to logout of RootCare?
            </Text>

            <TouchableOpacity
              style={[styles.exitConfirmButton, { backgroundColor: themeColors.error }]}
              onPress={confirmExit}
              activeOpacity={0.85}
            >
              <Text style={[styles.exitConfirmButtonText, { color: themeColors['on-error'] }]}>
                Logout RootCare
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={cancelExit}
              activeOpacity={0.7}
            >
              <Text style={[styles.confirmCancelText, { color: themeColors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {renderModal()}
      {renderFeedbackModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}) },
  header: { width: '100%', minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  backButton: { padding: 4, minWidth: 40 },
  headerText: { fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center', letterSpacing: 0.3 },
  headerSpacer: { minWidth: 40 },
  scrollContent: { padding: 16 },
  profileSection: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16, shadowColor: 'rgba(93, 64, 55, 0.08)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 2, borderColor: 'rgba(0,0,0,0.1)' },
  profileInitial: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  section: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, shadowColor: 'rgba(93, 64, 55, 0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12, letterSpacing: 0.5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuItemText: { fontSize: 15, fontWeight: '500' },
  divider: { height: 1, marginVertical: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  switchLabel: { fontSize: 15, fontWeight: '500' },
  switchSubtext: { fontSize: 12, marginTop: 1 },
  exitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 12, borderWidth: 2, marginTop: 4, marginBottom: 8 },
  exitText: { fontSize: 15, fontWeight: '600' },
  versionText: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  avatarOverlay: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalOverlayConfirm: { flex: 1, backgroundColor: 'rgba(44, 22, 14, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 22, 14, 0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  confirmModalCard: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 32, alignItems: 'center', shadowColor: 'rgba(93, 64, 55, 0.15)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 12 },
  exitIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  confirmModalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  confirmModalBody: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  exitConfirmButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999, width: '100%', minHeight: 48, paddingHorizontal: 12 },
  exitConfirmButtonText: { fontSize: 14, fontWeight: '600' },
  confirmCancelButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, marginTop: 4, width: '100%' },
  confirmCancelText: { fontSize: 14, fontWeight: '500' },
  modalContainer: { width: '100%', height: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  modalBackButton: { padding: 4, width: 40 },
  modalHeaderTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  modalScrollView: { flex: 1 },
  modalScrollContent: { padding: 20, paddingBottom: 40 },
  profileImageContainer: { alignItems: 'center', marginBottom: 24 },
  profileAvatarLarge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  profileInitialLarge: { fontSize: 36, fontWeight: '700', color: '#FFFFFF' },
  editPhotoButton: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  modalSectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 52, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  modalSaveButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  modalSaveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalDescription: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingRowLabel: { fontSize: 14, fontWeight: '500' },
  legalText: { fontSize: 14, lineHeight: 24 },
});

export default SettingsScreen;