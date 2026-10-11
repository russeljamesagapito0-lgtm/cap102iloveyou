import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * Tap-to-open searchable picker.
 * Props: label, value (display name), options [{code,name}], onSelect(option),
 *        loading, error, onRetry, disabled, hasError, placeholder
 */
const SelectField = ({
  label, value, options = [], onSelect, loading = false, error = null,
  onRetry, disabled = false, hasError = false, placeholder = 'Select',
}) => {
  const { themeColors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => { setOpen(false); setQuery(''); };
  const borderColor = hasError ? themeColors.error : value ? '#27AE60' : themeColors.border;

  return (
    <>
      <TouchableOpacity
        style={[styles.field, { backgroundColor: themeColors.card, borderColor }, disabled && { opacity: 0.5 }]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: value ? themeColors.primary : themeColors.textSecondary }]}>{label}</Text>
          <Text numberOfLines={1} style={[styles.value, { color: value ? themeColors.text : themeColors.textSecondary }]}>
            {value || placeholder}
          </Text>
        </View>
        {loading
          ? <ActivityIndicator size="small" color={themeColors.primary} />
          : <Ionicons name="chevron-down" size={20} color={themeColors.textSecondary} />}
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: themeColors.card }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: themeColors.text }]}>{label}</Text>
              <TouchableOpacity onPress={close} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.search, { backgroundColor: themeColors.surface, color: themeColors.text }]}
              placeholder="Search..."
              placeholderTextColor={themeColors.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />

            {loading ? (
              <ActivityIndicator style={{ marginTop: 32 }} color={themeColors.primary} />
            ) : error ? (
              <View style={styles.center}>
                <Text style={[styles.msg, { color: themeColors.textSecondary }]}>{error}</Text>
                {onRetry && (
                  <TouchableOpacity style={[styles.retry, { backgroundColor: themeColors.primary }]} onPress={onRetry}>
                    <Text style={{ color: themeColors['on-primary'], fontWeight: '600' }}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                ListEmptyComponent={<Text style={[styles.msg, { color: themeColors.textSecondary, textAlign: 'center', marginTop: 24 }]}>No results</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.item, { borderBottomColor: themeColors.border }]}
                    onPress={() => { onSelect(item); close(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.itemText, { color: themeColors.text }, item.name === value && { color: themeColors.primary, fontWeight: '600' }]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, height: 56, paddingHorizontal: 16 },
  label: { fontSize: 12, marginBottom: 2 },
  value: { fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%', minHeight: '50%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  search: { height: 44, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, marginBottom: 8 },
  item: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1 },
  itemText: { fontSize: 16 },
  center: { alignItems: 'center', marginTop: 32, gap: 12 },
  msg: { fontSize: 14 },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});

export default SelectField;