// src/screens/CompleteProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../utils/supabaseClient';

const MIN_NAME_LEN = 2;

const CompleteProfileScreen = ({ navigation }) => {
  const { themeColors, isDarkMode } = useTheme();

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [noMiddleName, setNoMiddleName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstNameFocused, setFirstNameFocused] = useState(false);
  const [middleNameFocused, setMiddleNameFocused] = useState(false);
  const [lastNameFocused, setLastNameFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, middle_name, last_name')
        .eq('id', session.user.id)
        .maybeSingle();
      if (data) {
        setFirstName(data.first_name || '');
        setMiddleName(data.middle_name || '');
        setLastName(data.last_name || '');
      }
    })();
  }, []);

  const validate = () => {
    const f = firstName.trim();
    const l = lastName.trim();
    if (f.length < MIN_NAME_LEN) return 'Please enter your first name.';
    if (l.length < MIN_NAME_LEN) return 'Please enter your last name.';
    return null;
  };

  const handleSave = async () => {
    if (saving) return;
    setErrorMessage('');

    const err = validate();
    if (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setErrorMessage(err);
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('You are not signed in.');

      const f = firstName.trim();
      const m = noMiddleName ? '' : middleName.trim();
      const l = lastName.trim();
      const display = `${f} ${l}`.trim();

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          first_name: f,
          middle_name: m || null,
          last_name: l,
          display_name: display,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(e?.message || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={[styles.iconCircle, { backgroundColor: themeColors.primary + '18' }]}>
              <Ionicons name="person-circle-outline" size={56} color={themeColors.primary} />
            </View>
            <Text style={[styles.title, { color: themeColors.text }]}>
              Complete your profile
            </Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              Please tell us your full name so we can personalize your RootCare experience.
            </Text>
          </View>

          <View style={[styles.form, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.inputWrapper}>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: firstNameFocused ? themeColors.primary : themeColors.outline,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: themeColors.text }]}
                  placeholder=" "
                  value={firstName}
                  onChangeText={setFirstName}
                  onFocus={() => setFirstNameFocused(true)}
                  onBlur={() => setFirstNameFocused(false)}
                  autoCapitalize="words"
                  editable={!saving}
                />
                <Text
                  pointerEvents="none"
                  style={[
                    styles.floatingLabel,
                    { color: themeColors.textSecondary, backgroundColor: themeColors.card },
                    (firstNameFocused || firstName) && { top: 6, fontSize: 12, color: themeColors.primary },
                  ]}
                >
                  First Name
                </Text>
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: middleNameFocused ? themeColors.primary : themeColors.outline,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: themeColors.text }]}
                  placeholder=" "
                  value={middleName}
                  onChangeText={setMiddleName}
                  onFocus={() => setMiddleNameFocused(true)}
                  onBlur={() => setMiddleNameFocused(false)}
                  autoCapitalize="words"
                  editable={!saving && !noMiddleName}
                />
                <Text
                  pointerEvents="none"
                  style={[
                    styles.floatingLabel,
                    { color: themeColors.textSecondary, backgroundColor: themeColors.card },
                    (middleNameFocused || middleName) && { top: 6, fontSize: 12, color: themeColors.primary },
                  ]}
                >
                  Middle Name
                </Text>
              </View>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => {
                  setNoMiddleName((v) => !v);
                  if (!noMiddleName) setMiddleName('');
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: themeColors.outline },
                    noMiddleName && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
                  ]}
                >
                  {noMiddleName && (
                    <Ionicons name="checkmark" size={14} color={themeColors['on-primary']} />
                  )}
                </View>
                <Text style={[styles.checkboxLabel, { color: themeColors.textSecondary }]}>
                  I don't have a middle name
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: lastNameFocused ? themeColors.primary : themeColors.outline,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: themeColors.text }]}
                  placeholder=" "
                  value={lastName}
                  onChangeText={setLastName}
                  onFocus={() => setLastNameFocused(true)}
                  onBlur={() => setLastNameFocused(false)}
                  autoCapitalize="words"
                  editable={!saving}
                />
                <Text
                  pointerEvents="none"
                  style={[
                    styles.floatingLabel,
                    { color: themeColors.textSecondary, backgroundColor: themeColors.card },
                    (lastNameFocused || lastName) && { top: 6, fontSize: 12, color: themeColors.primary },
                  ]}
                >
                  Last Name
                </Text>
              </View>
            </View>

            {!!errorMessage && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: themeColors.error + '15', borderColor: themeColors.error + '40' },
                ]}
              >
                <Ionicons name="alert-circle" size={18} color={themeColors.error} />
                <Text style={[styles.errorText, { color: themeColors.error }]}>{errorMessage}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: themeColors.primary },
                saving && { opacity: 0.7 },
              ]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={themeColors['on-primary']} />
              ) : (
                <>
                  <Text style={[styles.buttonText, { color: themeColors['on-primary'] }]}>
                    Save and continue
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={themeColors['on-primary']} />
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.footnote, { color: themeColors.textSecondary }]}>
              You can change this later in Settings.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 },

  hero: { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },

  form: { borderRadius: 12, padding: 20, borderWidth: 1 },
  inputWrapper: { marginBottom: 16 },
  inputContainer: { position: 'relative', borderWidth: 1, borderRadius: 8, height: 56 },
  input: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    fontSize: 16,
  },
  floatingLabel: { position: 'absolute', left: 16, top: 18, fontSize: 16, paddingHorizontal: 4 },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxLabel: { fontSize: 12 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500' },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },

  footnote: { fontSize: 12, textAlign: 'center', marginTop: 16 },
});

export default CompleteProfileScreen;