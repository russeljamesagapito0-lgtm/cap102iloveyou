// screens/RegisterScreen.js
import React, { useState, useCallback } from 'react';
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
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../utils/supabaseClient';
import { useTheme } from '../context/ThemeContext';

const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V'];

const TERMS_CONTENT = `
TERMS OF SERVICE
Last Updated: January 2024
1. ACCEPTANCE OF TERMS
By using RootCare, you agree to be bound by these Terms of Service.
2. DESCRIPTION OF SERVICE
RootCare provides AI-powered disease detection for cassava plants, farming insights, and marketplace connectivity.
3. USER OBLIGATIONS
- You must provide accurate information
- You are responsible for maintaining account security
- You must not misuse the service
4. PRIVACY POLICY
Your data is protected according to our Privacy Policy.
5. INTELLECTUAL PROPERTY
All content and AI models are property of RootCare.
6. LIMITATION OF LIABILITY
RootCare provides information for educational purposes only.
7. TERMINATION
We reserve the right to terminate accounts for violations.
8. CONTACT
For questions, contact us at support@rootcare.com
`;

const PRIVACY_CONTENT = `
PRIVACY POLICY
Last Updated: January 2024
1. INFORMATION WE COLLECT
- Personal information (name, email, phone)
- Farm data and location
- Images uploaded for disease detection
- Usage data and analytics
2. HOW WE USE YOUR DATA
- To provide disease detection services
- To improve our AI models
- To send notifications and updates
- To connect you with marketplace partners
3. DATA SECURITY
We implement industry-standard security measures to protect your data.
4. DATA SHARING
We do not sell your personal data. Data is shared only with:
- Service providers who assist our operations
- Agricultural partners (with your consent)
5. YOUR RIGHTS
- Access your data
- Request data deletion
- Opt-out of marketing communications
6. COOKIES
We use cookies to improve user experience.
7. CHANGES TO POLICY
We will notify you of any material changes.
8. CONTACT
Privacy concerns: privacy@rootcare.com
`;

// ================= CALENDAR MODAL =================
const CalendarModal = ({ visible, onClose, onSelectDate }) => {
  const { themeColors } = useTheme();
  const today = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  const years = [];
  for (let y = today.getFullYear(); y >= 1900; y--) years.push(y);

  const getDaysInMonth = (month, year) => new Date(year, month, 0).getDate();

  const handleMonthSelect = (m) => { setSelectedMonth(m + 1); setSelectedDay(1); setShowMonthDropdown(false); };
  const handleYearSelect = (y) => { setSelectedYear(y); setSelectedDay(1); setShowYearDropdown(false); };

  const handleDone = () => {
    const fm = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const fd = selectedDay < 10 ? `0${selectedDay}` : `${selectedDay}`;
    onSelectDate(fm, fd, `${selectedYear}`);
    onClose();
  };

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const firstDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay();
  const daysArray = [];
  for (let i = 0; i < firstDayOfWeek; i++) daysArray.push(null);
  for (let i = 1; i <= daysInMonth; i++) daysArray.push(i);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.calendarOverlay}>
        <View style={[styles.calendarContainer, { backgroundColor: themeColors.card }]}>
          <View style={styles.calendarHeader}>
            <Text style={[styles.calendarTitle, { color: themeColors.text }]}>Select Date</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.calendarSelectors}>
            <TouchableOpacity
              style={[styles.selectorBox, { backgroundColor: themeColors.surface }]}
              onPress={() => { setShowMonthDropdown(!showMonthDropdown); setShowYearDropdown(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectorText, { color: themeColors.text }]}>{months[selectedMonth - 1]}</Text>
              <Ionicons name="chevron-down" size={16} color={themeColors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.selectorBox, { backgroundColor: themeColors.surface }]}
              onPress={() => { setShowYearDropdown(!showYearDropdown); setShowMonthDropdown(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectorText, { color: themeColors.text }]}>{selectedYear}</Text>
              <Ionicons name="chevron-down" size={16} color={themeColors.primary} />
            </TouchableOpacity>
          </View>

          {showMonthDropdown && (
            <View style={[styles.dropdownList, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <ScrollView style={{ maxHeight: 200 }}>
                {months.map((month, index) => (
                  <TouchableOpacity
                    key={month}
                    style={[styles.dropdownItem, { borderBottomColor: themeColors.border }, selectedMonth === index + 1 && { backgroundColor: themeColors.surface }]}
                    onPress={() => handleMonthSelect(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownItemText, { color: themeColors.text }, selectedMonth === index + 1 && { color: themeColors.primary, fontWeight: '600' }]}>{month}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {showYearDropdown && (
            <View style={[styles.dropdownList, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <ScrollView style={{ maxHeight: 200 }}>
                {years.map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={[styles.dropdownItem, { borderBottomColor: themeColors.border }, selectedYear === year && { backgroundColor: themeColors.surface }]}
                    onPress={() => handleYearSelect(year)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownItemText, { color: themeColors.text }, selectedYear === year && { color: themeColors.primary, fontWeight: '600' }]}>{year}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.calendarWeek}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <Text key={index} style={[styles.calendarWeekText, { color: themeColors.textSecondary }]}>{day}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {daysArray.map((day, index) => {
              if (day === null) return <View key={index} style={styles.calendarDayEmpty} />;
              const isSelected = day === selectedDay;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.calendarDay, isSelected && { backgroundColor: themeColors.primary }]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.calendarDayText, { color: themeColors.text }, isSelected && { color: themeColors['on-primary'], fontWeight: '600' }]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.calendarDoneButton, { backgroundColor: themeColors.primary }]} onPress={handleDone} activeOpacity={0.8}>
            <Text style={[styles.calendarDoneText, { color: themeColors['on-primary'] }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
// ============================================================

const CustomModal = ({ visible, onClose, title, message, type = 'success', onConfirm }) => {
  const { themeColors } = useTheme();
  const getIcon = () => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle', color: '#27AE60' };
      case 'error': return { name: 'alert-circle', color: themeColors.error };
      case 'warning': return { name: 'warning', color: '#F39C12' };
      default: return { name: 'information-circle', color: themeColors.primary };
    }
  };
  const icon = getIcon();

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
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: themeColors.primary }]} onPress={onConfirm || onClose} activeOpacity={0.8}>
                <Text style={[styles.modalButtonText, { color: themeColors['on-primary'] }]}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: themeColors.surface }]} onPress={onClose} activeOpacity={0.8}>
                  <Text style={[styles.modalCancelButtonText, { color: themeColors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: themeColors.primary }]} onPress={onConfirm || onClose} activeOpacity={0.8}>
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

const TermsModal = ({ visible, onClose, onAccept, title, content }) => {
  const { themeColors } = useTheme();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) setHasScrolledToBottom(true);
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.termsModalOverlay}>
        <View style={[styles.termsModalContainer, { backgroundColor: themeColors.card }]}>
          <View style={styles.termsModalHeader}>
            <Text style={[styles.termsModalTitle, { color: themeColors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.termsScrollView} onScroll={handleScroll} scrollEventThrottle={16} showsVerticalScrollIndicator>
            <Text style={[styles.termsContentText, { color: themeColors.textSecondary }]}>{content}</Text>
          </ScrollView>
          <TouchableOpacity
            style={[styles.termsAcceptButton, { backgroundColor: hasScrolledToBottom ? themeColors.primary : themeColors.border }, !hasScrolledToBottom && { opacity: 0.6 }]}
            onPress={() => { if (hasScrolledToBottom) { onAccept(); onClose(); } }}
            activeOpacity={0.7}
            disabled={!hasScrolledToBottom}
          >
            <Text style={[styles.termsAcceptButtonText, { color: themeColors['on-primary'] }]}>
              {hasScrolledToBottom ? 'I Understand & Accept' : 'Please scroll to the bottom to accept'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const RegisterScreen = ({ navigation }) => {
  const { themeColors, isDarkMode } = useTheme();

  const [formData, setFormData] = useState({
    firstName: '', middleName: '', lastName: '', suffix: '', sex: '',
    month: '', day: '', year: '', address: '', province: '', city: '',
    barangay: '', zipCode: '', phone: '', email: '', password: '', confirmPassword: '',
  });
  const [noMiddleName, setNoMiddleName] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  const [isSuffixDropdownOpen, setIsSuffixDropdownOpen] = useState(false);
  const [age, setAge] = useState('');
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('success');
  const [modalOnConfirm, setModalOnConfirm] = useState(null);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [termsModalType, setTermsModalType] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const showModal = (title, message, type = 'success', onConfirm = null) => {
    setModalTitle(title); setModalMessage(message); setModalType(type);
    setModalOnConfirm(() => onConfirm); setModalVisible(true);
  };
  const closeModal = () => setModalVisible(false);

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => {
      if (prev[field]) { const n = { ...prev }; delete n[field]; return n; }
      return prev;
    });
  }, []);

  const calculateAge = useCallback((month, day, year) => {
    if (!month || !day || !year) return '';
    const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age > 0 ? age.toString() : '';
  }, []);

  const handleCalendarSelect = useCallback((month, day, year) => {
    setFormData(prev => {
      const newData = { ...prev, month, day, year };
      setAge(calculateAge(month, day, year));
      return newData;
    });
  }, [calculateAge]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showModal('Permission Denied', 'Sorry, we need camera roll permissions!', 'warning');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const validateForm = useCallback(() => {
    let errors = {};
    const required = ['firstName', 'lastName', 'sex', 'address', 'province', 'city', 'barangay', 'email', 'password', 'confirmPassword'];
    required.forEach(field => { if (!formData[field] || formData[field].length < 2) errors[field] = true; });
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) errors.email = true;
    }
    if (formData.phone && formData.phone.length !== 11) errors.phone = true;
    if (!formData.password || formData.password.length < 6) errors.password = true;
    if (!formData.confirmPassword || formData.confirmPassword !== formData.password) errors.confirmPassword = true;
    if (!isTermsChecked) {
      showModal('Error', 'Please agree to the Terms of Service to continue.', 'error');
      return false;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      showModal('Error', 'Please fill in the required fields correctly.', 'error');
      return false;
    }
    return true;
  }, [formData, isTermsChecked]);

  const handleRegister = useCallback(async () => {
    if (!validateForm()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(), password: formData.password,
      });
      if (authError) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        let message = 'Registration failed.';
        if (authError.message.includes('already registered')) message = 'This email is already registered. Please login instead.';
        else if (authError.message.includes('rate limit')) message = 'Too many attempts. Please wait a few minutes.';
        showModal('Error', message, 'error');
        return;
      }
      if (authData.user) {
        const birthDate = formData.year && formData.month && formData.day
          ? `${formData.year}-${formData.month.padStart(2, '0')}-${formData.day.padStart(2, '0')}`
          : null;
        const profileData = {
          id: authData.user.id, email: formData.email.trim(),
          display_name: `${formData.firstName} ${formData.lastName}`.trim(),
          first_name: formData.firstName,
          middle_name: noMiddleName ? null : formData.middleName,
          last_name: formData.lastName, suffix: formData.suffix || null,
          sex: formData.sex, birth_date: birthDate,
          address: formData.address, province: formData.province,
          city: formData.city, barangay: formData.barangay,
          zip_code: formData.zipCode || null, phone: formData.phone || null,
        };
        const { error: profileError } = await supabase.from('profiles').upsert(profileData);
        if (profileError) console.error('❌ Profile creation error:', profileError.message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showModal('🎉 Registration Successful!', 'Your account has been created successfully. Please login to continue.', 'success', () => navigation.replace('Login'));
    } catch (error) {
      console.error('❌ Registration exception:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showModal('Error', 'An unexpected error occurred. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, formData, noMiddleName, navigation, profileImage]);

  const handleLogin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const openTermsModal = useCallback(() => { setTermsModalType('terms'); setTermsModalVisible(true); }, []);
  const openPrivacyModal = useCallback(() => { setTermsModalType('privacy'); setTermsModalVisible(true); }, []);
  const handleTermsAccept = useCallback(() => setIsTermsChecked(true), []);

  const getInputStyle = useCallback((field) => {
    const value = formData[field];
    const hasError = fieldErrors[field];
    if (value && value.length > 0 && !hasError) return { borderColor: '#27AE60' };
    else if (value && value.length > 0 && hasError) return { borderColor: themeColors.error };
    return {};
  }, [formData, fieldErrors, themeColors]);

  const inputBg = themeColors.card;
  const labelBg = themeColors.card;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleLogin} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={themeColors.primary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: themeColors.primary }]}>Create Your Account</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Join RootCare to start managing your farm smarter.</Text>
          </View>

          <View style={[styles.formContainer, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.primary, borderBottomColor: themeColors.border }]}>Personal Information</Text>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('firstName')]}>
                  <TextInput style={[styles.input, { color: themeColors.text }]} placeholder=" " value={formData.firstName} onChangeText={(t) => updateField('firstName', t)} autoCapitalize="words" placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.firstName && { top: 6, fontSize: 12, color: themeColors.primary }]}>First Name *</Text>
                  {fieldErrors.firstName && <Ionicons name="alert-circle" size={20} color={themeColors.error} style={styles.errorIcon} />}
                  {formData.firstName && !fieldErrors.firstName && <Ionicons name="checkmark-circle" size={20} color="#27AE60" style={styles.checkmarkIcon} />}
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }]}>
                  <TextInput style={[styles.input, { color: themeColors.text }]} placeholder=" " value={formData.middleName} onChangeText={(t) => updateField('middleName', t)} autoCapitalize="words" editable={!noMiddleName} placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.middleName && { top: 6, fontSize: 12, color: themeColors.primary }]}>Middle Name</Text>
                </View>
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setNoMiddleName(!noMiddleName)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, { borderColor: themeColors.outline }, noMiddleName && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}>
                    {noMiddleName && <Ionicons name="checkmark" size={14} color={themeColors['on-primary']} />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: themeColors.textSecondary }]}>No middle name</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('lastName')]}>
                  <TextInput style={[styles.input, { color: themeColors.text }]} placeholder=" " value={formData.lastName} onChangeText={(t) => updateField('lastName', t)} autoCapitalize="words" placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.lastName && { top: 6, fontSize: 12, color: themeColors.primary }]}>Last Name *</Text>
                  {fieldErrors.lastName && <Ionicons name="alert-circle" size={20} color={themeColors.error} style={styles.errorIcon} />}
                  {formData.lastName && !fieldErrors.lastName && <Ionicons name="checkmark-circle" size={20} color="#27AE60" style={styles.checkmarkIcon} />}
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <TouchableOpacity style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border, justifyContent: 'center', paddingHorizontal: 16 }]} onPress={() => setIsSuffixDropdownOpen(!isSuffixDropdownOpen)} activeOpacity={0.7}>
                  <Text style={[styles.input, { color: themeColors.text }]}>{formData.suffix || 'Suffix'}</Text>
                  <Ionicons name={isSuffixDropdownOpen ? 'chevron-up' : 'chevron-down'} size={24} color={themeColors.textSecondary} style={styles.dropdownIcon} />
                </TouchableOpacity>
                {isSuffixDropdownOpen && (
                  <View style={[styles.dropdownList, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                    {SUFFIX_OPTIONS.map((suffix) => (
                      <TouchableOpacity key={suffix || 'none'} style={[styles.dropdownItem, { borderBottomColor: themeColors.border }, formData.suffix === suffix && { backgroundColor: themeColors.surface }]} onPress={() => { updateField('suffix', suffix); setIsSuffixDropdownOpen(false); }} activeOpacity={0.7}>
                        <Text style={[styles.dropdownItemText, { color: themeColors.text }, formData.suffix === suffix && { color: themeColors.primary, fontWeight: '600' }]}>{suffix || 'None'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.sexContainer}>
                <Text style={[styles.sexLabel, { color: themeColors.text }]}>Sex at Birth *</Text>
                <View style={[styles.sexOptions, { backgroundColor: themeColors.surface }]}>
                  <TouchableOpacity style={[styles.sexOption, formData.sex === 'male' && { backgroundColor: themeColors.primary }]} onPress={() => updateField('sex', 'male')} activeOpacity={0.7}>
                    <Text style={[styles.sexOptionText, { color: themeColors.text }, formData.sex === 'male' && { color: themeColors['on-primary'], fontWeight: '600' }]}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sexOption, formData.sex === 'female' && { backgroundColor: themeColors.primary }]} onPress={() => updateField('sex', 'female')} activeOpacity={0.7}>
                    <Text style={[styles.sexOptionText, { color: themeColors.text }, formData.sex === 'female' && { color: themeColors['on-primary'], fontWeight: '600' }]}>Female</Text>
                  </TouchableOpacity>
                </View>
                {fieldErrors.sex && <Text style={[styles.errorText, { color: themeColors.error }]}>Please select your sex</Text>}
              </View>

              <View style={styles.inputWrapper}>
                <TouchableOpacity style={[styles.dateInputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }]} onPress={() => setIsCalendarVisible(true)} activeOpacity={0.7}>
                  <View style={styles.dateIconContainer}>
                    <Ionicons name="calendar-outline" size={20} color={themeColors.textSecondary} />
                  </View>
                  <View style={styles.dateTextContainer}>
                    <Text style={[styles.dateLabel, { color: themeColors.primary }]}>Date of Birth *</Text>
                    <Text style={[styles.dateValue, { color: formData.month ? themeColors.text : themeColors.textSecondary }]}>
                      {formData.month && formData.day && formData.year ? `${formData.month}/${formData.day}/${formData.year}` : 'Select Date'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {age && <Text style={[styles.ageText, { color: themeColors.primary }]}>Age: {age} years old</Text>}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.primary, borderBottomColor: themeColors.border }]}>Contact & Address</Text>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('address')]}>
                  <TextInput style={[styles.input, { color: themeColors.text }]} placeholder=" " value={formData.address} onChangeText={(t) => updateField('address', t)} autoCapitalize="words" placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.address && { top: 6, fontSize: 12, color: themeColors.primary }]}>Complete Address *</Text>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('province')]}>
                  <TextInput style={[styles.input, { color: themeColors.text }]} placeholder=" " value={formData.province} onChangeText={(t) => updateField('province', t)} autoCapitalize="words" placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.province && { top: 6, fontSize: 12, color: themeColors.primary }]}>Province *</Text>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('city')]}>
                  <TextInput style={[styles.input, { color: themeColors.text }]} placeholder=" " value={formData.city} onChangeText={(t) => updateField('city', t)} autoCapitalize="words" placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.city && { top: 6, fontSize: 12, color: themeColors.primary }]}>City/Municipality *</Text>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('barangay')]}>
                  <TextInput style={[styles.input, { color: themeColors.text }]} placeholder=" " value={formData.barangay} onChangeText={(t) => updateField('barangay', t)} autoCapitalize="words" placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.barangay && { top: 6, fontSize: 12, color: themeColors.primary }]}>Barangay *</Text>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }]}>
                  <TextInput style={[styles.input, { color: themeColors.text }]} placeholder=" " value={formData.zipCode} onChangeText={(t) => updateField('zipCode', t)} keyboardType="numeric" placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.zipCode && { top: 6, fontSize: 12, color: themeColors.primary }]}>Zip Code</Text>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('phone')]}>
                  <Ionicons name="call-outline" size={20} color={themeColors.textSecondary} style={styles.inputIcon} />
                  <TextInput style={[styles.input, styles.inputWithIcon, { color: themeColors.text }]} placeholder=" " value={formData.phone} onChangeText={(t) => updateField('phone', t.replace(/[^0-9]/g, '').slice(0, 11))} keyboardType="phone-pad" maxLength={11} placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, styles.floatingLabelWithIcon, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.phone && { top: 6, fontSize: 12, color: themeColors.primary }]}>Phone Number (11 digits)</Text>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('email')]}>
                  <Ionicons name="mail-outline" size={20} color={themeColors.textSecondary} style={styles.inputIcon} />
                  <TextInput style={[styles.input, styles.inputWithIcon, { color: themeColors.text }]} placeholder=" " value={formData.email} onChangeText={(t) => updateField('email', t)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, styles.floatingLabelWithIcon, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.email && { top: 6, fontSize: 12, color: themeColors.primary }]}>Email Address *</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.primary, borderBottomColor: themeColors.border }]}>Account Security</Text>

              <TouchableOpacity style={[styles.photoUpload, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]} activeOpacity={0.7} onPress={pickImage}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImagePreview} />
                ) : (
                  <>
                    <Ionicons name="add-a-photo" size={32} color={themeColors.textSecondary} />
                    <Text style={[styles.photoUploadText, { color: themeColors.text }]}>Upload Profile Photo</Text>
                    <Text style={[styles.photoUploadSubtext, { color: themeColors.textSecondary }]}>PNG, JPG up to 5MB</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('password')]}>
                  <Ionicons name="lock-closed-outline" size={20} color={themeColors.textSecondary} style={styles.inputIcon} />
                  <TextInput style={[styles.input, styles.inputWithIcon, styles.passwordInput, { color: themeColors.text }]} placeholder=" " value={formData.password} onChangeText={(t) => updateField('password', t)} secureTextEntry={!showPassword} placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, styles.floatingLabelWithIcon, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.password && { top: 6, fontSize: 12, color: themeColors.primary }]}>Password * (min 6 chars)</Text>
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: themeColors.border }, getInputStyle('confirmPassword')]}>
                  <Ionicons name="lock-closed-outline" size={20} color={themeColors.textSecondary} style={styles.inputIcon} />
                  <TextInput style={[styles.input, styles.inputWithIcon, styles.passwordInput, { color: themeColors.text }]} placeholder=" " value={formData.confirmPassword} onChangeText={(t) => updateField('confirmPassword', t)} secureTextEntry={!showConfirmPassword} placeholderTextColor={themeColors.textSecondary} />
                  <Text style={[styles.floatingLabel, styles.floatingLabelWithIcon, { color: themeColors.textSecondary, backgroundColor: labelBg }, formData.confirmPassword && { top: 6, fontSize: 12, color: themeColors.primary }]}>Confirm Password *</Text>
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)} activeOpacity={0.7}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.consentSection}>
              <TouchableOpacity style={styles.termsRow} onPress={() => { if (!isTermsChecked) openTermsModal(); else setIsTermsChecked(false); }} activeOpacity={0.7}>
                <View style={[styles.checkbox, { borderColor: themeColors.outline }, isTermsChecked && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}>
                  {isTermsChecked && <Ionicons name="checkmark" size={14} color={themeColors['on-primary']} />}
                </View>
                <Text style={[styles.termsText, { color: themeColors.text }]}>
                  I agree to the <Text style={{ color: themeColors.primary, fontWeight: '600' }} onPress={openTermsModal}>Terms of Service</Text> and <Text style={{ color: themeColors.primary, fontWeight: '600' }} onPress={openPrivacyModal}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.signUpButton, { backgroundColor: themeColors.primary }, isLoading && { opacity: 0.6 }]} onPress={handleRegister} activeOpacity={0.85} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={themeColors['on-primary']} />
                ) : (
                  <>
                    <Text style={[styles.signUpButtonText, { color: themeColors['on-primary'] }]}>Sign Up</Text>
                    <Ionicons name="person-add-outline" size={20} color={themeColors['on-primary']} />
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
              <Text style={[styles.dividerText, { color: themeColors.textSecondary }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
            </View>

            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, { color: themeColors.textSecondary }]}>Already have an account?</Text>
              <TouchableOpacity onPress={handleLogin} activeOpacity={0.7}>
                <Text style={[styles.loginLink, { color: themeColors.primary }]}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomModal visible={modalVisible} onClose={closeModal} title={modalTitle} message={modalMessage} type={modalType} onConfirm={modalOnConfirm} />
      <TermsModal visible={termsModalVisible} onClose={() => setTermsModalVisible(false)} onAccept={handleTermsAccept} title={termsModalType === 'terms' ? 'Terms of Service' : 'Privacy Policy'} content={termsModalType === 'terms' ? TERMS_CONTENT : PRIVACY_CONTENT} />
      <CalendarModal visible={isCalendarVisible} onClose={() => setIsCalendarVisible(false)} onSelectDate={handleCalendarSelect} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 },
  header: { alignItems: 'center', marginBottom: 24, position: 'relative' },
  backButton: { position: 'absolute', left: 0, top: 0, padding: 8, zIndex: 10 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4, marginTop: 4 },
  subtitle: { fontSize: 14, fontWeight: '400', textAlign: 'center' },
  formContainer: { borderRadius: 12, padding: 20, borderWidth: 1 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', borderBottomWidth: 1, paddingBottom: 8, marginBottom: 12 },
  inputWrapper: { marginBottom: 12 },
  inputContainer: { position: 'relative', borderWidth: 1, borderRadius: 8, height: 56 },
  input: { width: '100%', height: '100%', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, fontSize: 16, paddingRight: 56 },
  inputWithIcon: { paddingLeft: 44, paddingRight: 64 },
  passwordInput: { paddingRight: 64 },
  inputIcon: { position: 'absolute', left: 12, top: 18 },
  errorIcon: { position: 'absolute', right: 44, top: 18 },
  checkmarkIcon: { position: 'absolute', right: 44, top: 18 },
  floatingLabel: { position: 'absolute', left: 16, top: 18, fontSize: 16, paddingHorizontal: 4 },
  floatingLabelWithIcon: { left: 44, maxWidth: '70%' },
  errorText: { fontSize: 12, marginTop: 4, marginLeft: 4 },
  eyeIcon: { position: 'absolute', right: 8, top: 16, padding: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingHorizontal: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxLabel: { fontSize: 12 },
  sexContainer: { marginBottom: 12 },
  sexLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  sexOptions: { flexDirection: 'row', borderRadius: 8, padding: 4 },
  sexOption: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  sexOptionText: { fontSize: 14 },
  dateInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, height: 56, paddingHorizontal: 16 },
  dateIconContainer: { marginRight: 12 },
  dateTextContainer: { flex: 1, flexDirection: 'column', justifyContent: 'center' },
  dateLabel: { fontSize: 12, marginBottom: 2 },
  dateValue: { fontSize: 16 },
  ageText: { fontSize: 14, fontWeight: '600', marginTop: 6 },
  photoUpload: { alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 2, borderStyle: 'dashed', borderRadius: 8, marginBottom: 12, height: 120, overflow: 'hidden' },
  profileImagePreview: { width: 100, height: 100, borderRadius: 50 },
  photoUploadText: { fontSize: 14, fontWeight: '500', marginTop: 4 },
  photoUploadSubtext: { fontSize: 12, marginTop: 2 },
  consentSection: { marginTop: 8 },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  termsText: { fontSize: 14, flex: 1 },
  signUpButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, height: 48, gap: 8 },
  signUpButtonText: { fontSize: 14, fontWeight: '600' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  loginContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: '600', marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center' },
  modalIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  modalButtonContainer: { flexDirection: 'row', gap: 12, width: '100%' },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalButtonText: { fontSize: 15, fontWeight: '600' },
  modalCancelButtonText: { fontSize: 15, fontWeight: '600' },
  termsModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  termsModalContainer: { borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, maxHeight: '80%' },
  termsModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  termsModalTitle: { fontSize: 20, fontWeight: '700' },
  termsScrollView: { maxHeight: 400, marginBottom: 16 },
  termsContentText: { fontSize: 14, lineHeight: 24 },
  termsAcceptButton: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  termsAcceptButtonText: { fontSize: 14, fontWeight: '600' },
  dropdownIcon: { position: 'absolute', right: 12, top: 16 },
  dropdownList: { position: 'absolute', top: 60, left: 0, right: 0, borderWidth: 1, borderRadius: 8, zIndex: 100, maxHeight: 200 },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  dropdownItemText: { fontSize: 16 },
  calendarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  calendarContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calendarTitle: { fontSize: 20, fontWeight: '700' },
  calendarSelectors: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  selectorBox: { flex: 1, height: 48, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  selectorText: { fontSize: 16, fontWeight: '600' },
  calendarWeek: { flexDirection: 'row', marginBottom: 8 },
  calendarWeekText: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  calendarDayEmpty: { width: `${100 / 7}%`, aspectRatio: 1 },
  calendarDay: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 4 },
  calendarDayText: { fontSize: 16 },
  calendarDoneButton: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  calendarDoneText: { fontSize: 14, fontWeight: '600' },
});

export default RegisterScreen;