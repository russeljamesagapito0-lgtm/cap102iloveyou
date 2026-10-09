import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const formatEta = (eta) => {
  if (!eta) return null;
  const d = new Date(eta);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

export default function MaintenanceScreen({ message, eta, onRetry }) {
  const { themeColors } = useTheme();
  const [checking, setChecking] = useState(false);
  const etaText = formatEta(eta);

  const retry = async () => {
    setChecking(true);
    try {
      await onRetry?.();
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: themeColors['surface-container-high'] }]}>
        <Ionicons name="construct-outline" size={56} color={themeColors.primary} />
      </View>

      <Text style={[styles.title, { color: themeColors.text }]}>Under maintenance</Text>

      <Text style={[styles.message, { color: themeColors.textSecondary }]}>
        {message || 'RootCare is undergoing scheduled maintenance. Please check back soon.'}
      </Text>

      {etaText && (
        <Text style={[styles.eta, { color: themeColors.text }]}>Expected back: {etaText}</Text>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: themeColors.primary }]}
        onPress={retry}
        disabled={checking}
        activeOpacity={0.8}
      >
        {checking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Check again</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 16 },
  eta: { fontSize: 14, fontWeight: '600', marginBottom: 28, textAlign: 'center' },
  button: {
    minWidth: 160,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});