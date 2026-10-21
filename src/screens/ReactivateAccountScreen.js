import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../utils/supabaseClient';

const GRACE_DAYS = 30;

const formatDate = (date) =>
  date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const daysBetween = (a, b) =>
  Math.max(0, Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));

const ReactivateAccountScreen = ({ navigation, route }) => {
  const { themeColors, isDarkMode } = useTheme();
  const params = route?.params || {};
  const [deactivatedAt] = useState(
    params.deactivatedAt ? new Date(params.deactivatedAt) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const [scheduledDeletionAt] = useState(
    params.scheduledDeletionAt ? new Date(params.scheduledDeletionAt) : new Date(Date.now() + 23 * 24 * 60 * 60 * 1000)
  );

  const [reactivating, setReactivating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const daysLeft = daysBetween(new Date(), scheduledDeletionAt);
  const totalDays = daysBetween(deactivatedAt, scheduledDeletionAt);
  const handleReactivate = async () => {
    if (reactivating) return;
    setReactivating(true);
    setErrorMessage('');

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await new Promise((resolve) => setTimeout(resolve, 800));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(err?.message || 'Could not reactivate. Please try again.');
    } finally {
      setReactivating(false);
    }
  };
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await supabase.auth.signOut();
      } catch (_) {
        // ignore — we're navigating away anyway
      }
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <View
            style={[
              styles.heroCircle,
              { backgroundColor: themeColors.primary + '18' },
            ]}
          >
            <Ionicons name="pause-circle-outline" size={72} color={themeColors.primary} />
          </View>
        </View>
        <Text style={[styles.title, { color: themeColors.text }]}>
          Account Deactivated
        </Text>
        <Text style={[styles.body, { color: themeColors.textSecondary }]}>
          Your RootCare account is currently deactivated. Your scans, notes, and profile
          information have been preserved and nothing has been deleted.
        </Text>
        <View
          style={[
            styles.countdownCard,
            { backgroundColor: themeColors.surface, borderColor: themeColors.border },
          ]}
        >
          <View style={styles.countdownRow}>
            <View style={[styles.countdownIconWrap, { backgroundColor: themeColors.primary + '20' }]}>
              <Ionicons name="time-outline" size={22} color={themeColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.countdownLabel, { color: themeColors.textSecondary }]}>
                Time remaining to reactivate
              </Text>
              <Text style={[styles.countdownValue, { color: themeColors.text }]}>
                {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
              </Text>
            </View>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: themeColors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: themeColors.primary,
                  width: `${Math.min(100, Math.max(4, (daysLeft / totalDays) * 100))}%`,
                },
              ]}
            />
          </View>

          <Text style={[styles.countdownMeta, { color: themeColors.textSecondary }]}>
            Deactivated on {formatDate(deactivatedAt)}
          </Text>
          <Text style={[styles.countdownMeta, { color: themeColors.error, fontWeight: '600' }]}>
            Permanently deleted on {formatDate(scheduledDeletionAt)}
          </Text>
        </View>

        {/* What happens next */}
        <View style={styles.infoSection}>
          <Text style={[styles.infoTitle, { color: themeColors.text }]}>
            What happens if you reactivate?
          </Text>

          <View style={styles.infoBullet}>
            <Ionicons name="checkmark-circle" size={18} color={themeColors.primary} />
            <Text style={[styles.infoBulletText, { color: themeColors.textSecondary }]}>
              Your account is restored instantly.
            </Text>
          </View>
          <View style={styles.infoBullet}>
            <Ionicons name="checkmark-circle" size={18} color={themeColors.primary} />
            <Text style={[styles.infoBulletText, { color: themeColors.textSecondary }]}>
              All your scans, saved items, and notes come back.
            </Text>
          </View>
          <View style={styles.infoBullet}>
            <Ionicons name="checkmark-circle" size={18} color={themeColors.primary} />
            <Text style={[styles.infoBulletText, { color: themeColors.textSecondary }]}>
              The 30-day deletion timer is cancelled.
            </Text>
          </View>
        </View>

        {!!errorMessage && (
          <View style={[styles.errorBox, { backgroundColor: themeColors.error + '15', borderColor: themeColors.error + '40' }]}>
            <Ionicons name="alert-circle" size={18} color={themeColors.error} />
            <Text style={[styles.errorText, { color: themeColors.error }]}>{errorMessage}</Text>
          </View>
        )}

        {/* Primary action */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: themeColors.primary },
            reactivating && { opacity: 0.7 },
          ]}
          onPress={handleReactivate}
          disabled={reactivating || signingOut}
          activeOpacity={0.85}
        >
          {reactivating ? (
            <ActivityIndicator color={themeColors['on-primary']} />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={20} color={themeColors['on-primary']} />
              <Text style={[styles.primaryButtonText, { color: themeColors['on-primary'] }]}>
                Reactivate My Account
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Secondary action */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleSignOut}
          disabled={reactivating || signingOut}
          activeOpacity={0.7}
        >
          {signingOut ? (
            <ActivityIndicator color={themeColors.textSecondary} />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: themeColors.textSecondary }]}>
              Sign out
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>
          Changed your mind? You can sign out and reactivate anytime before{' '}
          {formatDate(scheduledDeletionAt)}.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'stretch',
  },

  heroWrap: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  heroCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },

  countdownCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 24,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  countdownIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  countdownValue: { fontSize: 20, fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  countdownMeta: { fontSize: 12, lineHeight: 18 },

  infoSection: { marginBottom: 24 },
  infoTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  infoBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  infoBulletText: { flex: 1, fontSize: 14, lineHeight: 20 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500' },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700' },

  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },

  footerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});

export default ReactivateAccountScreen;