// screens/ResultScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform, Dimensions, BackHandler, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DISEASE_INFO } from '../constants/diseaseInfo';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../utils/supabaseClient';

const { width, height } = Dimensions.get('window');

const typography = {
  headlineSm: { fontFamily: 'Montserrat', fontSize: 20, fontWeight: '600', lineHeight: 28 },
  bodyMd: { fontFamily: 'Open Sans', fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodyLg: { fontFamily: 'Open Sans', fontSize: 18, fontWeight: '400', lineHeight: 28 },
  labelLg: { fontFamily: 'Open Sans', fontSize: 14, fontWeight: '600', lineHeight: 20, letterSpacing: 0.1 },
  labelSm: { fontFamily: 'Open Sans', fontSize: 12, fontWeight: '500', lineHeight: 16 },
};

const spacing = { xs: 4, sm: 12, md: 16, lg: 24, xl: 32, marginMobile: 20 };
const rounded = { sm: 4, DEFAULT: 8, md: 12, lg: 16, xl: 24, full: 9999 };
const HEADER_HEIGHT = 56;
const MIN_TOUCH = 48;

const findTabNavigator = (navigation) => {
  let nav = navigation.getParent();
  while (nav && nav.getState()?.type !== 'tab') nav = nav.getParent();
  return nav;
};

const ResultScreen = ({ route, navigation }) => {
  const { themeColors, isDarkMode } = useTheme();
  const { imageUri, scanDate, diseaseKey, diseaseLabel, confidence } = route.params || {};
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [savedModalVisible, setSavedModalVisible] = useState(false);

  const pendingActionRef = useRef(null);
  const isMountedRef = useRef(true);
  const isSavedRef = useRef(isSaved);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => { isSavedRef.current = isSaved; }, [isSaved]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setConfirmVisible(false);
      setSavedModalVisible(false);
      pendingActionRef.current = null;
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (confirmVisible || savedModalVisible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => backHandler.remove();
    }
  }, [confirmVisible, savedModalVisible]);

  const diseaseData = DISEASE_INFO[diseaseKey] || { ...DISEASE_INFO.CMD, name: diseaseLabel || DISEASE_INFO.CMD.name };

  const scannedAt = scanDate ? new Date(scanDate) : new Date();
  const formattedDate = scannedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const formattedTime = scannedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  // ---- Persist to Supabase ----
  const saveResult = async () => {
    if (isSaving) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Guest mode — don't persist, just mark as saved locally
      if (!session?.user?.id) {
        setIsSaved(true);
        return;
      }

      // Derive disease type from DISEASE_INFO or fallback
      const diseaseType = diseaseData.type || diseaseData.diseaseType || 'Unknown';
      const diseaseSeverity = diseaseData.severity || null;
      const diseaseAccuracy = typeof confidence === 'number'
        ? confidence
        : (confidence ? parseFloat(confidence) : null);

      const payload = {
        user_id: session.user.id,
        crop_type: diseaseData.crop || 'Cassava',
        image_path: imageUri || null,
        captured_at: scannedAt.toISOString(),
        is_saved: true,
        is_archived: false,
        is_deleted: false,
        // New columns added by SQL above:
        disease_name: diseaseData.name,
        disease_type: diseaseType,
        severity: diseaseSeverity,
        accuracy: diseaseAccuracy,
        description: diseaseData.description || null,
        treatment: diseaseData.treatment || null,
        prevention: diseaseData.prevention || null,
        symptoms: diseaseData.symptoms || null,
      };

      const { error } = await supabase.from('scans').insert(payload);

      if (error) {
        console.warn('Failed to save scan:', error.message);
        Alert.alert('Save failed', error.message);
        return;
      }

      if (isMountedRef.current) setIsSaved(true);
    } catch (err) {
      console.warn('Save error:', err);
      Alert.alert('Save failed', err.message || 'Unknown error');
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  };

  const goHome = () => {
    const tabNav = findTabNavigator(navigation);
    if (tabNav) tabNav.reset({ index: 0, routes: [{ name: 'Home' }] });
    else navigation.navigate('Home');
  };

  const goToScanner = () => {
    const tabNav = findTabNavigator(navigation);
    if (tabNav) tabNav.reset({ index: 0, routes: [{ name: 'Scanner' }] });
    else navigation.navigate('Scanner');
  };

  const showModal = (action) => {
    if (isSavedRef.current) { action(); return; }
    pendingActionRef.current = action;
    setConfirmVisible(true);
  };

  const handleBackPress = () => showModal(goHome);
  const navigateToHome = () => showModal(goHome);
  const navigateToScanAgain = () => showModal(goToScanner);

  const handleSaveAndContinue = async () => {
    await saveResult();
    setConfirmVisible(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setSavedModalVisible(true);
    setTimeout(() => { if (action) action(); }, 1000);
  };

  const handleDiscard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmVisible(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) action();
  };

  const handleCancel = () => { setConfirmVisible(false); pendingActionRef.current = null; };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: themeColors.text }]}>Analysis Results</Text>
        <TouchableOpacity style={styles.headerAction} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={24} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {imageUri && (
          <View style={[styles.imageContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Image source={{ uri: imageUri }} style={styles.image} />
          </View>
        )}

        <View style={[styles.resultCard, { backgroundColor: themeColors.card }]}>
          <View style={styles.diseaseHeader}>
            <Ionicons name="alert-circle" size={26} color="#F59E0B" />
            <Text style={[styles.diseaseName, { color: themeColors.text }]}>{diseaseData.name}</Text>
          </View>
          <View style={styles.scanDateRow}>
            <Ionicons name="calendar-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.scanDateText, { color: themeColors.textSecondary }]}>Scanned {formattedDate} · {formattedTime}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={themeColors.secondary} />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Description</Text>
            </View>
            <Text style={[styles.sectionText, { color: themeColors.textSecondary }]}>{diseaseData.description}</Text>
          </View>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medkit-outline" size={18} color={themeColors.secondary} />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Treatment</Text>
            </View>
            <Text style={[styles.sectionText, { color: themeColors.textSecondary }]}>{diseaseData.treatment}</Text>
          </View>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark-outline" size={18} color={themeColors.secondary} />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Prevention</Text>
            </View>
            <Text style={[styles.sectionText, { color: themeColors.textSecondary }]}>{diseaseData.prevention}</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: themeColors.primary }, (isSaved || isSaving) && { opacity: 0.6 }]}
            onPress={saveResult}
            activeOpacity={0.85}
            disabled={isSaved || isSaving}
          >
            {isSaving ? (
              <Text style={[styles.buttonText, { color: themeColors['on-primary'] }]}>Saving…</Text>
            ) : (
              <>
                <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={themeColors['on-primary']} />
                <Text style={[styles.buttonText, { color: themeColors['on-primary'] }]}>{isSaved ? 'Saved' : 'Save'}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: themeColors.secondary }]} onPress={navigateToScanAgain} activeOpacity={0.85}>
            <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Scan Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border }]} onPress={navigateToHome} activeOpacity={0.85}>
            <Ionicons name="home-outline" size={18} color={themeColors.text} />
            <Text style={[styles.buttonText, { color: themeColors.text }]}>Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={handleCancel} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
            <TouchableOpacity style={[styles.modalCloseButton, { backgroundColor: themeColors.surface }]} onPress={handleCancel} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Save this result?</Text>
              <Text style={[styles.modalBody, { color: themeColors.textSecondary }]}>You haven't saved this analysis yet. Save it to your history before you go, or discard it.</Text>
              <TouchableOpacity style={[styles.button, { backgroundColor: themeColors.primary, marginBottom: spacing.xs, paddingVertical: spacing.sm, width: '100%', minHeight: 44 }]} onPress={handleSaveAndContinue} activeOpacity={0.85}>
                <Ionicons name="bookmark-outline" size={18} color={themeColors['on-primary']} />
                <Text style={[styles.buttonText, { color: themeColors['on-primary'] }]}>Save & Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: themeColors.border, marginBottom: spacing.xs, paddingVertical: spacing.sm, width: '100%', minHeight: 44 }]} onPress={handleDiscard} activeOpacity={0.85}>
                <Text style={[styles.buttonText, { color: themeColors.textSecondary }]}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handleCancel} activeOpacity={0.7}>
                <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={savedModalVisible} transparent animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.savedModalCard, { backgroundColor: themeColors.card }]}>
            <View style={[styles.savedIconCircle, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="checkmark" size={32} color={themeColors['on-primary']} />
            </View>
            <Text style={[styles.savedModalTitle, { color: themeColors.text }]}>Saved!</Text>
            <Text style={[styles.savedModalBody, { color: themeColors.textSecondary }]}>Scan result has been saved to history.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}) },
  header: { width: '100%', minHeight: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  backButton: { padding: 4, minWidth: 40 },
  headerText: { fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center', letterSpacing: 0.3 },
  headerAction: { padding: 4, minWidth: 40, alignItems: 'flex-end' },
  scrollContent: { flexGrow: 1, padding: spacing.md, paddingBottom: 80 },
  imageContainer: { width: '100%', height: 200, borderRadius: rounded.DEFAULT, borderWidth: 2, overflow: 'hidden', marginBottom: spacing.sm },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  resultCard: { borderRadius: rounded.DEFAULT, padding: spacing.md, marginBottom: spacing.sm },
  diseaseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 4, marginBottom: spacing.xs },
  diseaseName: { ...typography.headlineSm, fontSize: 19, textAlign: 'center' },
  scanDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  scanDateText: { ...typography.labelSm },
  divider: { height: 1, marginBottom: spacing.sm },
  section: { marginBottom: spacing.sm + 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginBottom: spacing.xs },
  sectionTitle: { ...typography.labelLg, fontSize: 15 },
  sectionText: { ...typography.bodyMd, fontSize: 13.5, lineHeight: 21, paddingLeft: 26 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  button: { flexDirection: 'row', minHeight: 46, paddingHorizontal: 10, borderRadius: rounded.full, alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2, flex: 1 },
  buttonText: { ...typography.labelSm, fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 22, 14, 0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  modalCard: { width: '100%', maxWidth: 380, maxHeight: height * 0.75, borderRadius: rounded.xl, padding: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm, position: 'relative' },
  modalScrollContent: { flexGrow: 1, paddingBottom: spacing.xs },
  modalCloseButton: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 36, height: 36, borderRadius: rounded.full, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  modalTitle: { ...typography.headlineSm, fontSize: 18, marginBottom: spacing.xs, textAlign: 'center', paddingRight: 24 },
  modalBody: { ...typography.bodyMd, fontSize: 14, textAlign: 'center', marginBottom: spacing.md, lineHeight: 20 },
  modalCancelButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs, width: '100%' },
  modalCancelText: { ...typography.labelLg, fontSize: 14, fontWeight: '500' },
  savedModalCard: { width: '100%', maxWidth: 340, borderRadius: rounded.xl, padding: spacing.lg, alignItems: 'center' },
  savedIconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  savedModalTitle: { ...typography.headlineSm, fontSize: 19, marginBottom: spacing.xs, textAlign: 'center' },
  savedModalBody: { ...typography.bodyMd, fontSize: 14, textAlign: 'center', marginBottom: spacing.md, lineHeight: 20 },
});

export default ResultScreen;