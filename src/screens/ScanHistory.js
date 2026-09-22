// screens/ScanHistory.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Platform,
  Image, Alert, Modal, ScrollView, TextInput, ActivityIndicator,
  Dimensions, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../utils/supabaseClient';

const { width } = Dimensions.get('window');

const spacing = { xs: 4, sm: 12, md: 16, lg: 24, xl: 32, marginMobile: 20 };
const rounded = { sm: 4, DEFAULT: 8, md: 12, lg: 16, xl: 24, full: 9999 };
const HEADER_HEIGHT = 56;
const MIN_TOUCH = 48;

const getTypeBadgeStyle = (type) => {
  switch (type) {
    case 'Viral': return { backgroundColor: '#E74C3C' };
    case 'Fungal': return { backgroundColor: '#F39C12' };
    case 'Bacterial': return { backgroundColor: '#3498DB' };
    case 'Pest': return { backgroundColor: '#27AE60' };
    case 'Healthy': return { backgroundColor: '#2ECC71' };
    default: return { backgroundColor: '#707A6C' };
  }
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'High': return '#E74C3C';
    case 'Medium': return '#F39C12';
    case 'Low': return '#27AE60';
    case 'None': return '#2ECC71';
    default: return '#707A6C';
  }
};

const getAccuracyColor = (accuracy) => {
  const n = typeof accuracy === 'number' ? accuracy : parseFloat(accuracy) || 0;
  if (n >= 90) return { backgroundColor: '#27AE60' };
  if (n >= 70) return { backgroundColor: '#F39C12' };
  return { backgroundColor: '#E74C3C' };
};

// Map a Supabase row -> the shape this UI expects
const mapRowToItem = (row) => ({
  id: row.id,
  title: row.disease_name || row.crop_type || 'Untitled Scan',
  subtitle: row.disease_type ? `${row.disease_type} Detected` : (row.crop_type ? `${row.crop_type} Scan` : 'Scan Result'),
  detail: row.severity ? `Severity: ${row.severity}` : '',
  extra: '',
  image: row.image_path ? { uri: row.image_path } : null,
  isArchived: !!row.is_archived,
  isSaved: !!row.is_saved,
  isDeleted: !!row.is_deleted,
  archivedAt: row.archived_at,
  createdAt: row.captured_at || row.created_at,
  diseaseType: row.disease_type || 'Healthy',
  severity: row.severity || 'None',
  accuracy: typeof row.accuracy === 'number' ? row.accuracy : parseFloat(row.accuracy) || 0,
  description: row.description || '',
  treatment: row.treatment || '',
  prevention: row.prevention || '',
  symptoms: row.symptoms || '',
  notes: row.notes || '',
});

const HistoryScreen = ({ navigation, route }) => {
  const { themeColors, isDarkMode } = useTheme();

  const initialTab = route?.params?.initialTab;
  const [activeTab, setActiveTab] = useState(initialTab || 'recent');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [isExporting, setIsExporting] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ icon: 'archive-outline', title: '', body: '', confirmLabel: 'Confirm', onConfirm: () => {} });
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successConfig, setSuccessConfig] = useState({ title: '', body: '' });

  const showSuccess = (title, body) => { setSuccessConfig({ title, body }); setSuccessModalVisible(true); };

  const diseaseTypes = ['All', 'Viral', 'Fungal', 'Bacterial', 'Pest', 'Healthy'];

  // ---------- LOAD FROM SUPABASE ----------
  const loadScans = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setHistoryData([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('captured_at', { ascending: false });

      if (error) {
        console.warn('Load scans failed:', error.message);
        setHistoryData([]);
      } else {
        setHistoryData((data || []).map(mapRowToItem));
      }
    } catch (err) {
      console.warn('Load scans error:', err.message);
      setHistoryData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadScans();
    }, [loadScans])
  );

  // ---------- HELPERS ----------
  const persist = async (id, patch) => {
    const { error } = await supabase.from('scans').update(patch).eq('id', id);
    if (error) {
      console.warn('Update failed:', error.message);
      Alert.alert('Update failed', error.message);
      return false;
    }
    return true;
  };

  const persistBulk = async (ids, patch) => {
    const { error } = await supabase.from('scans').update(patch).in('id', ids);
    if (error) {
      console.warn('Bulk update failed:', error.message);
      Alert.alert('Update failed', error.message);
      return false;
    }
    return true;
  };

  // ---------- FILTER/SORT ----------
  const getFilteredData = () => {
    let filtered = historyData.filter(item => {
      if (activeTab === 'recent') return !item.isDeleted && !item.isArchived && !item.isSaved;
      if (activeTab === 'saved') return item.isSaved && !item.isDeleted && !item.isArchived;
      if (activeTab === 'archived') return item.isArchived && !item.isDeleted;
      if (activeTab === 'trash') return item.isDeleted;
      return true;
    });
    if (selectedFilter !== 'All') filtered = filtered.filter(item => item.diseaseType === selectedFilter);
    switch (sortBy) {
      case 'newest': filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
      case 'oldest': filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case 'name': filtered.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'accuracy': filtered.sort((a, b) => b.accuracy - a.accuracy); break;
      default: break;
    }
    return filtered;
  };

  const filteredData = getFilteredData();

  // ---------- SELECT MODE ----------
  const enterSelectMode = () => setIsSelectMode(true);
  const exitSelectMode = () => { setIsSelectMode(false); setSelectedIds([]); };

  const toggleSelect = (id) => {
    if (!isSelectMode) return;
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        const n = prev.filter(s => s !== id);
        if (n.length === 0) exitSelectMode();
        return n;
      }
      return [...prev, id];
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredData.length) exitSelectMode();
    else setSelectedIds(filteredData.map(i => i.id));
  };

  // ---------- SINGLE ACTIONS ----------
  const handleSave = async (id) => {
    if (isSelectMode) { toggleSelect(id); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const item = historyData.find(i => i.id === id);
    const next = !item?.isSaved;

    // optimistic
    setHistoryData(prev => prev.map(i => i.id === id ? { ...i, isSaved: next } : i));

    const ok = await persist(id, { is_saved: next, updated_at: new Date().toISOString() });
    if (!ok) setHistoryData(prev => prev.map(i => i.id === id ? { ...i, isSaved: !next } : i));
  };

  const handleArchive = (id) => {
    if (isSelectMode) { toggleSelect(id); return; }
    setConfirmConfig({
      icon: 'archive-outline',
      title: 'Move to Archive',
      body: 'Move this scan to archive? You can restore it anytime.',
      confirmLabel: 'Move to Archive',
      onConfirm: async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setConfirmModalVisible(false);
        setHistoryData(prev => prev.map(i => i.id === id ? { ...i, isArchived: true, isDeleted: false } : i));
        const ok = await persist(id, { is_archived: true, is_deleted: false, archived_at: new Date().toISOString() });
        if (ok) showSuccess('Archived!', 'This scan has been moved to archive.');
        else loadScans();
      },
    });
    setConfirmModalVisible(true);
  };

  const handleTrash = (id) => {
    if (isSelectMode) { toggleSelect(id); return; }
    setConfirmConfig({
      icon: 'trash-outline',
      title: 'Move to Trash',
      body: 'Move this scan to trash? You can restore it anytime within 30 days.',
      confirmLabel: 'Move to Trash',
      onConfirm: async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setConfirmModalVisible(false);
        setHistoryData(prev => prev.map(i => i.id === id ? { ...i, isDeleted: true, isArchived: false } : i));
        const ok = await persist(id, { is_deleted: true, is_archived: false, deleted_at: new Date().toISOString() });
        if (ok) showSuccess('Moved to Trash!', 'This scan has been moved to trash.');
        else loadScans();
      },
    });
    setConfirmModalVisible(true);
  };

  const handleRestore = (id) => {
    if (isSelectMode) { toggleSelect(id); return; }
    setConfirmConfig({
      icon: 'refresh-outline',
      title: 'Restore Scan',
      body: 'Move this scan back to recent?',
      confirmLabel: 'Restore',
      onConfirm: async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setConfirmModalVisible(false);
        setHistoryData(prev => prev.map(i => i.id === id ? { ...i, isDeleted: false, isArchived: false } : i));
        const ok = await persist(id, { is_deleted: false, is_archived: false, archived_at: null, deleted_at: null });
        if (ok) showSuccess('Restored!', 'This scan is back in your recent list.');
        else loadScans();
      },
    });
    setConfirmModalVisible(true);
  };

  const handleDeleteForever = (id) => {
    if (isSelectMode) { toggleSelect(id); return; }
    setConfirmConfig({
      icon: 'trash-outline',
      title: 'Delete Forever',
      body: 'This action is permanent. This scan will be lost forever.',
      confirmLabel: 'Delete Forever',
      onConfirm: async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setConfirmModalVisible(false);
        const prev = historyData;
        setHistoryData(p => p.filter(i => i.id !== id));
        const { error } = await supabase.from('scans').delete().eq('id', id);
        if (error) {
          Alert.alert('Delete failed', error.message);
          setHistoryData(prev);
          return;
        }
        showSuccess('Deleted!', 'This scan has been permanently deleted.');
      },
    });
    setConfirmModalVisible(true);
  };

  // ---------- BULK ACTIONS ----------
  const handleBulkUnsave = () => {
    setConfirmConfig({
      icon: 'bookmark-outline',
      title: 'Unsave Selected',
      body: `Remove ${selectedIds.length} selected scan(s) from Saved?`,
      confirmLabel: 'Unsave',
      onConfirm: async () => {
        const ids = [...selectedIds];
        setHistoryData(historyData.map(i => ids.includes(i.id) ? { ...i, isSaved: false } : i));
        exitSelectMode(); setConfirmModalVisible(false);
        const ok = await persistBulk(ids, { is_saved: false, updated_at: new Date().toISOString() });
        if (ok) showSuccess('Unsaved!', 'Selected scans have been removed from Saved.');
        else loadScans();
      },
    });
    setConfirmModalVisible(true);
  };

  const handleBulkTrash = () => {
    setConfirmConfig({
      icon: 'trash-outline',
      title: 'Move Selected to Trash',
      body: `Move ${selectedIds.length} selected scan(s) to trash?`,
      confirmLabel: 'Move to Trash',
      onConfirm: async () => {
        const ids = [...selectedIds];
        setHistoryData(historyData.map(i => ids.includes(i.id) ? { ...i, isDeleted: true, isArchived: false } : i));
        exitSelectMode(); setConfirmModalVisible(false);
        const ok = await persistBulk(ids, { is_deleted: true, is_archived: false, deleted_at: new Date().toISOString() });
        if (ok) showSuccess('Moved to Trash!', 'Selected scans have been moved to trash.');
        else loadScans();
      },
    });
    setConfirmModalVisible(true);
  };

  const handleBulkArchive = () => {
    setConfirmConfig({
      icon: 'archive-outline',
      title: 'Archive All Selected',
      body: `Move ${selectedIds.length} selected scan(s) to archive?`,
      confirmLabel: 'Archive All',
      onConfirm: async () => {
        const ids = [...selectedIds];
        setHistoryData(historyData.map(i => ids.includes(i.id) ? { ...i, isArchived: true, isDeleted: false } : i));
        exitSelectMode(); setConfirmModalVisible(false);
        const ok = await persistBulk(ids, { is_archived: true, is_deleted: false, archived_at: new Date().toISOString() });
        if (ok) showSuccess('Archived!', 'Selected scans have been moved to archive.');
        else loadScans();
      },
    });
    setConfirmModalVisible(true);
  };

  const handleBulkRestore = () => {
    setConfirmConfig({
      icon: 'refresh-outline',
      title: 'Restore Selected',
      body: `Move ${selectedIds.length} selected scan(s) back to recent?`,
      confirmLabel: 'Restore',
      onConfirm: async () => {
        const ids = [...selectedIds];
        setHistoryData(historyData.map(i => ids.includes(i.id) ? { ...i, isDeleted: false, isArchived: false } : i));
        exitSelectMode(); setConfirmModalVisible(false);
        const ok = await persistBulk(ids, { is_deleted: false, is_archived: false, archived_at: null, deleted_at: null });
        if (ok) showSuccess('Restored!', 'Selected scans have been restored.');
        else loadScans();
      },
    });
    setConfirmModalVisible(true);
  };

  const handleBulkDeleteForever = () => {
    setConfirmConfig({
      icon: 'trash-outline',
      title: 'Delete Selected Forever',
      body: `Delete ${selectedIds.length} selected scan(s) forever?`,
      confirmLabel: 'Delete Forever',
      onConfirm: async () => {
        const ids = [...selectedIds];
        const prev = historyData;
        setHistoryData(p => p.filter(i => !ids.includes(i.id)));
        exitSelectMode(); setConfirmModalVisible(false);
        const { error } = await supabase.from('scans').delete().in('id', ids);
        if (error) {
          Alert.alert('Delete failed', error.message);
          setHistoryData(prev);
          return;
        }
        showSuccess('Deleted!', 'Selected scans have been permanently deleted.');
      },
    });
    setConfirmModalVisible(true);
  };

  // ---------- DETAILS / NOTES ----------
  const handleViewDetails = (item) => {
    if (isSelectMode) { toggleSelect(item.id); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
    setDetailModalVisible(true);
  };

  const openNotesModal = (item) => { setSelectedItem(item); setNoteText(item.notes || ''); setNotesModalVisible(true); };

  const saveNote = async () => {
    if (!noteText.trim()) return Alert.alert('Empty Note', 'Please enter a note before saving.');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const trimmed = noteText.trim();
    const id = selectedItem.id;

    setHistoryData(prev => prev.map(i => i.id === id ? { ...i, notes: trimmed } : i));
    setSelectedItem({ ...selectedItem, notes: trimmed });
    setNotesModalVisible(false);

    const ok = await persist(id, { notes: trimmed, updated_at: new Date().toISOString() });
    if (ok) showSuccess('Saved!', 'Your note has been added to this scan.');
    else loadScans();
  };

  const exportReport = async () => {
    try { setIsExporting(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsExporting(false); } catch (e) { setIsExporting(false); }
  };

  const getDateKey = (item) => {
    const date = new Date(item.createdAt);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderSectionHeader = (dateKey) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderText, { color: themeColors.text }]}>{dateKey}</Text>
      <View style={[styles.sectionHeaderLine, { backgroundColor: themeColors.border }]} />
    </View>
  );

  const renderItem = ({ item, index }) => {
    const currentDateKey = getDateKey(item);
    let showHeader = false;
    if (index === 0) showHeader = true;
    else showHeader = currentDateKey !== getDateKey(filteredData[index - 1]);
    return (
      <View>
        {showHeader && renderSectionHeader(currentDateKey)}
        {viewMode === 'list' ? renderListItem({ item }) : renderDetailedItem({ item })}
      </View>
    );
  };

  const renderPlaceholder = (item) => (
    <View style={[styles.imageContainer, { backgroundColor: themeColors.secondary }]}>
      <Ionicons name="leaf" size={28} color={themeColors['on-primary']} />
    </View>
  );

  const renderListItem = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity style={styles.cardWrapper} onPress={() => handleViewDetails(item)} onLongPress={enterSelectMode} delayLongPress={300} activeOpacity={0.7}>
        <View style={[styles.historyCard, { backgroundColor: themeColors.surface }, item.isDeleted && { opacity: 0.8, backgroundColor: isDarkMode ? '#3A1A1A' : '#FFDAD6' }, isSelected && { borderWidth: 2, borderColor: themeColors.primary }]}>
          <View style={styles.cardRow}>
            {isSelectMode && (
              <TouchableOpacity onPress={() => toggleSelect(item.id)} style={styles.checkboxContainer}>
                <View style={[styles.checkbox, { borderColor: themeColors.outline, backgroundColor: themeColors.card }, isSelected && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color={themeColors['on-primary']} />}
                </View>
              </TouchableOpacity>
            )}
            {item.image ? (
              <View style={[styles.imageContainer, { backgroundColor: themeColors.secondary }]}>
                <Image source={item.image} style={styles.thumbnail} resizeMode="cover" />
              </View>
            ) : renderPlaceholder(item)}
            <View style={styles.historyContent}>
              <View style={styles.titleRow}>
                <Text style={[styles.historyTitle, { color: themeColors.text }]} numberOfLines={1}>{item.title}</Text>
                <View style={styles.badgeRow}>
                  {item.isSaved && <View style={[styles.savedBadge, { backgroundColor: themeColors.primary }]}><Ionicons name="bookmark" size={10} color={themeColors['on-primary']} /></View>}
                  {item.isDeleted && <View style={[styles.deletedBadge, { backgroundColor: themeColors.error }]}><Text style={[styles.deletedBadgeText, { color: themeColors['on-primary'] }]}>TRASH</Text></View>}
                  {item.isArchived && <View style={[styles.archivedBadge, { backgroundColor: themeColors.textSecondary }]}><Text style={[styles.archivedBadgeText, { color: themeColors['on-primary'] }]}>ARCHIVE</Text></View>}
                </View>
              </View>
              <Text style={[styles.historySubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>{item.subtitle}</Text>
              <View style={styles.detailRow}>
                <View style={styles.accuracyContainer}>
                  <View style={[styles.accuracyBarTrack, { backgroundColor: themeColors.border }]}>
                    <View style={[styles.accuracyBarFill, { width: `${Math.min(item.accuracy, 100)}%` }, getAccuracyColor(item.accuracy)]} />
                  </View>
                  <Text style={[styles.accuracyText, { color: themeColors.textSecondary }]}>{item.accuracy}%</Text>
                </View>
                <View style={[styles.typeBadge, getTypeBadgeStyle(item.diseaseType)]}><Text style={[styles.typeBadgeText, { color: themeColors['on-primary'] }]}>{item.diseaseType}</Text></View>
              </View>
            </View>
            <View style={styles.actionButtons}>
              {activeTab === 'recent' && !item.isDeleted && !item.isArchived && (
                <>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleSave(item.id)}><Ionicons name={item.isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={item.isSaved ? themeColors.primary : themeColors.secondary} /></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleArchive(item.id)}><Ionicons name="archive-outline" size={20} color={themeColors.secondary} /></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleTrash(item.id)}><Ionicons name="trash-outline" size={20} color={themeColors.error} /></TouchableOpacity>
                </>
              )}
              {activeTab === 'saved' && (
                <>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleSave(item.id)}><Ionicons name={item.isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={item.isSaved ? themeColors.primary : themeColors.secondary} /></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleRestore(item.id)}><Ionicons name="refresh-outline" size={20} color="#4CAF50" /></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleTrash(item.id)}><Ionicons name="trash-outline" size={20} color={themeColors.error} /></TouchableOpacity>
                </>
              )}
              {activeTab === 'archived' && (
                <>
                  <TouchableOpacity style={[styles.actionButtonDisabled]} disabled><Ionicons name="bookmark-outline" size={20} color={themeColors.border} /></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleRestore(item.id)}><Ionicons name="refresh-outline" size={20} color="#4CAF50" /></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleTrash(item.id)}><Ionicons name="trash-outline" size={20} color={themeColors.error} /></TouchableOpacity>
                </>
              )}
              {activeTab === 'trash' && (
                <>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleRestore(item.id)}><Ionicons name="refresh-outline" size={20} color="#4CAF50" /></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteForever(item.id)}><Ionicons name="trash-outline" size={20} color={themeColors.error} /></TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailedItem = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity style={styles.detailedCardWrapper} onPress={() => handleViewDetails(item)} onLongPress={enterSelectMode} delayLongPress={300} activeOpacity={0.7}>
        <View style={[styles.detailedCard, { backgroundColor: themeColors.surface }, item.isDeleted && { opacity: 0.8, backgroundColor: isDarkMode ? '#3A1A1A' : '#FFDAD6' }, isSelected && { borderWidth: 2, borderColor: themeColors.primary }]}>
          {isSelectMode && (
            <TouchableOpacity onPress={() => toggleSelect(item.id)} style={styles.checkboxContainerDetailed}>
              <View style={[styles.checkbox, { borderColor: themeColors.outline, backgroundColor: themeColors.card }, isSelected && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}>
                {isSelected && <Ionicons name="checkmark" size={16} color={themeColors['on-primary']} />}
              </View>
            </TouchableOpacity>
          )}
          {item.image ? (
            <Image source={item.image} style={styles.detailedImage} resizeMode="cover" />
          ) : (
            <View style={[styles.detailedImage, { backgroundColor: themeColors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="leaf" size={48} color={themeColors['on-primary']} />
            </View>
          )}
          <View style={styles.detailedContent}>
            <View style={styles.detailedHeader}>
              <Text style={[styles.detailedTitle, { color: themeColors.text }]} numberOfLines={1}>{item.title}</Text>
              <View style={styles.badgeRow}>
                {item.isSaved && <View style={[styles.savedBadge, { backgroundColor: themeColors.primary }]}><Ionicons name="bookmark" size={12} color={themeColors['on-primary']} /></View>}
                {item.isDeleted && <View style={[styles.deletedBadge, { backgroundColor: themeColors.error }]}><Text style={[styles.deletedBadgeText, { color: themeColors['on-primary'] }]}>TRASH</Text></View>}
                {item.isArchived && <View style={[styles.archivedBadge, { backgroundColor: themeColors.textSecondary }]}><Text style={[styles.archivedBadgeText, { color: themeColors['on-primary'] }]}>ARCHIVE</Text></View>}
              </View>
            </View>
            <Text style={[styles.detailedSubtitle, { color: themeColors.textSecondary }]}>{item.subtitle}</Text>
            <Text style={[styles.detailedDescription, { color: themeColors.textSecondary }]} numberOfLines={2}>{item.description || 'No description'}</Text>
            <View style={[styles.detailedFooter, { backgroundColor: themeColors.background }]}>
              <View style={styles.detailedStat}>
                <Text style={[styles.detailedStatLabel, { color: themeColors.textSecondary }]}>Accuracy</Text>
                <View style={styles.detailedAccuracyBar}>
                  <View style={[styles.accuracyBarTrack, { backgroundColor: themeColors.border }]}>
                    <View style={[styles.accuracyBarFill, { width: `${Math.min(item.accuracy, 100)}%` }, getAccuracyColor(item.accuracy)]} />
                  </View>
                  <Text style={[styles.detailedStatValue, { color: themeColors.text }]}>{item.accuracy}%</Text>
                </View>
              </View>
              <View style={styles.detailedStat}>
                <Text style={[styles.detailedStatLabel, { color: themeColors.textSecondary }]}>Severity</Text>
                <Text style={[styles.detailedStatValue, { color: getSeverityColor(item.severity) }]}>{item.severity}</Text>
              </View>
            </View>
            <View style={styles.detailedActions}>
              <View style={[styles.typeBadge, getTypeBadgeStyle(item.diseaseType)]}><Text style={[styles.typeBadgeText, { color: themeColors['on-primary'] }]}>{item.diseaseType}</Text></View>
              <View style={styles.detailedActionButtons}>
                {activeTab === 'recent' && !item.isDeleted && !item.isArchived && (
                  <>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleSave(item.id)}><Ionicons name={item.isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={item.isSaved ? themeColors.primary : themeColors.secondary} /></TouchableOpacity>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleArchive(item.id)}><Ionicons name="archive-outline" size={18} color={themeColors.secondary} /></TouchableOpacity>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleTrash(item.id)}><Ionicons name="trash-outline" size={18} color={themeColors.error} /></TouchableOpacity>
                  </>
                )}
                {activeTab === 'saved' && (
                  <>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleSave(item.id)}><Ionicons name={item.isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={item.isSaved ? themeColors.primary : themeColors.secondary} /></TouchableOpacity>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleRestore(item.id)}><Ionicons name="refresh-outline" size={18} color="#4CAF50" /></TouchableOpacity>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleTrash(item.id)}><Ionicons name="trash-outline" size={18} color={themeColors.error} /></TouchableOpacity>
                  </>
                )}
                {activeTab === 'archived' && (
                  <>
                    <TouchableOpacity style={styles.detailedActionButtonDisabled} disabled><Ionicons name="bookmark-outline" size={18} color={themeColors.border} /></TouchableOpacity>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleRestore(item.id)}><Ionicons name="refresh-outline" size={18} color="#4CAF50" /></TouchableOpacity>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleTrash(item.id)}><Ionicons name="trash-outline" size={18} color={themeColors.error} /></TouchableOpacity>
                  </>
                )}
                {activeTab === 'trash' && (
                  <>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleRestore(item.id)}><Ionicons name="refresh-outline" size={18} color="#4CAF50" /></TouchableOpacity>
                    <TouchableOpacity style={styles.detailedActionButton} onPress={() => handleDeleteForever(item.id)}><Ionicons name="trash-outline" size={18} color={themeColors.error} /></TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getTabCount = (tab) => {
    if (tab === 'recent') return historyData.filter(i => !i.isDeleted && !i.isArchived && !i.isSaved).length;
    if (tab === 'saved') return historyData.filter(i => i.isSaved && !i.isDeleted && !i.isArchived).length;
    if (tab === 'archived') return historyData.filter(i => i.isArchived && !i.isDeleted).length;
    if (tab === 'trash') return historyData.filter(i => i.isDeleted).length;
    return 0;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={isSelectMode ? exitSelectMode : () => navigation.goBack()}>
          <Ionicons name={isSelectMode ? 'close' : 'chevron-back'} size={28} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: themeColors.text }]}>{isSelectMode ? `Selected (${selectedIds.length})` : 'Scan History'}</Text>
        <View style={styles.headerActions}>
          {isSelectMode && (
            <TouchableOpacity style={styles.headerIconButton} onPress={handleSelectAll}>
              <View style={[styles.checkbox, { borderColor: themeColors.outline, backgroundColor: themeColors.card }, selectedIds.length === filteredData.length && selectedIds.length > 0 && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}>
                {selectedIds.length === filteredData.length && selectedIds.length > 0 && <Ionicons name="checkmark" size={16} color={themeColors['on-primary']} />}
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerIconButton} onPress={() => { const next = viewMode === 'list' ? 'detailed' : 'list'; setViewMode(next); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
            <Ionicons name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} size={22} color={themeColors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setFilterModalVisible(true)} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={22} color={themeColors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {isSelectMode && (
        <View style={styles.bulkActions}>
          {activeTab === 'recent' && (
            <>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkArchive}><Ionicons name="archive-outline" size={18} color={themeColors.secondary} /><Text style={[styles.bulkButtonText, { color: themeColors.secondary }]}>Archive</Text></TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkTrash}><Ionicons name="trash-outline" size={18} color={themeColors.error} /><Text style={[styles.bulkButtonText, { color: themeColors.error }]}>Trash</Text></TouchableOpacity>
            </>
          )}
          {activeTab === 'saved' && (
            <>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkUnsave}><Ionicons name="bookmark-outline" size={18} color={themeColors.secondary} /><Text style={[styles.bulkButtonText, { color: themeColors.secondary }]}>Unsave</Text></TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkTrash}><Ionicons name="trash-outline" size={18} color={themeColors.error} /><Text style={[styles.bulkButtonText, { color: themeColors.error }]}>Trash</Text></TouchableOpacity>
            </>
          )}
          {activeTab === 'archived' && (
            <>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkRestore}><Ionicons name="refresh-outline" size={18} color="#4CAF50" /><Text style={[styles.bulkButtonText, { color: themeColors.secondary }]}>Restore</Text></TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkTrash}><Ionicons name="trash-outline" size={18} color={themeColors.error} /><Text style={[styles.bulkButtonText, { color: themeColors.error }]}>Trash</Text></TouchableOpacity>
            </>
          )}
          {activeTab === 'trash' && (
            <>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkRestore}><Ionicons name="refresh-outline" size={18} color="#4CAF50" /><Text style={[styles.bulkButtonText, { color: themeColors.secondary }]}>Restore</Text></TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkDeleteForever}><Ionicons name="trash-outline" size={18} color={themeColors.error} /><Text style={[styles.bulkButtonText, { color: themeColors.error }]}>Delete</Text></TouchableOpacity>
            </>
          )}
        </View>
      )}

      {activeTab === 'trash' && (
        <View style={styles.trashNoticeWrapper}>
          <View style={[styles.trashNotice, { backgroundColor: themeColors.error + '20' }]}>
            <Ionicons name="information-circle-outline" size={18} color={themeColors.error} />
            <Text style={[styles.trashNoticeText, { color: themeColors.error }]}>Items in Trash are automatically deleted after 30 days.</Text>
          </View>
        </View>
      )}

      <View style={[styles.toggleContainer, { backgroundColor: themeColors.surface }]}>
        {['recent', 'saved', 'archived', 'trash'].map((tab) => (
          <TouchableOpacity key={tab} style={[styles.toggleButton, activeTab === tab && { backgroundColor: themeColors.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }]} onPress={() => { setActiveTab(tab); exitSelectMode(); }} activeOpacity={0.7}>
            <Text style={[styles.toggleText, { color: themeColors.textSecondary }, activeTab === tab && { color: themeColors['on-primary'] }]}>
              {tab === 'recent' ? 'Recent' : tab === 'saved' ? 'Saved' : tab === 'archived' ? 'Archive' : 'Trash'}{' '}
              <Text style={styles.toggleCount}>({getTabCount(tab)})</Text>
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : filteredData.length > 0 ? (
        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          key={viewMode}
          ListHeaderComponent={
            <View style={styles.filterInfo}>
              <Text style={[styles.filterInfoText, { color: themeColors.textSecondary }]}>
                {selectedFilter !== 'All' ? `Filter: ${selectedFilter} . ` : ''}Sort: {sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'name' ? 'A-Z' : 'Accuracy'}{' . '}View: {viewMode === 'list' ? 'List' : 'Detailed'}
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name={activeTab === 'recent' ? 'document-text-outline' : activeTab === 'saved' ? 'bookmark-outline' : activeTab === 'archived' ? 'archive-outline' : 'trash-outline'} size={60} color={themeColors.secondary} />
          <Text style={[styles.emptyText, { color: themeColors.text }]}>{activeTab === 'recent' ? 'No active scans' : activeTab === 'saved' ? 'No saved scans' : activeTab === 'archived' ? 'No archived scans' : 'No items in trash'}</Text>
          <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>{activeTab === 'recent' ? 'Your scan results will appear here' : activeTab === 'saved' ? 'Save scans to access them quickly' : activeTab === 'archived' ? 'Archived scans will appear here' : 'Deleted scans will appear here'}</Text>
        </View>
      )}

      {/* Filter Modal */}
      <Modal animationType="slide" transparent visible={filterModalVisible} onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Filter & Sort</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.modalCloseButton}><Ionicons name="close" size={24} color={themeColors.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: themeColors.text }]}>Disease Type</Text>
                <View style={styles.filterOptions}>
                  {diseaseTypes.map(type => (
                    <TouchableOpacity key={type} style={[styles.filterChip, { backgroundColor: themeColors.surface }, selectedFilter === type && { backgroundColor: themeColors.primary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedFilter(type); }}>
                      <Text style={[styles.filterChipText, { color: themeColors.text }, selectedFilter === type && { color: themeColors['on-primary'] }]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: themeColors.text }]}>Sort By</Text>
                <View style={styles.sortOptions}>
                  {[{ id: 'newest', label: 'Newest First' }, { id: 'oldest', label: 'Oldest First' }, { id: 'name', label: 'Alphabetical' }, { id: 'accuracy', label: 'Accuracy' }].map(o => (
                    <TouchableOpacity key={o.id} style={[styles.sortOption, { backgroundColor: themeColors.surface }, sortBy === o.id && { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.secondary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSortBy(o.id); }}>
                      <Text style={[styles.sortOptionText, { color: themeColors.text }, sortBy === o.id && { color: themeColors.secondary, fontWeight: '600' }]}>{o.label}</Text>
                      {sortBy === o.id && <Ionicons name="checkmark" size={18} color={themeColors.secondary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={[styles.applyButton, { backgroundColor: themeColors.primary }]} onPress={() => setFilterModalVisible(false)}><Text style={[styles.applyButtonText, { color: themeColors['on-primary'] }]}>Apply Filters</Text></TouchableOpacity>
              <TouchableOpacity style={styles.resetButton} onPress={() => { setSelectedFilter('All'); setSortBy('newest'); }}><Text style={[styles.resetButtonText, { color: themeColors.textSecondary }]}>Reset Filters</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      {selectedItem && (
        <Modal animationType="slide" transparent visible={detailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
          <View style={styles.detailModalOverlay}>
            <View style={[styles.detailModalContent, { backgroundColor: themeColors.background }]}>
              <View style={styles.detailModalHeader}>
                <TouchableOpacity style={styles.detailCloseButton} onPress={() => setDetailModalVisible(false)}><Ionicons name="arrow-back" size={24} color={themeColors.text} /></TouchableOpacity>
                <Text style={[styles.detailModalTitle, { color: themeColors.text }]}>Analysis Details</Text>
                <TouchableOpacity style={styles.detailExportButton} onPress={exportReport} disabled={isExporting}>{isExporting ? <ActivityIndicator size="small" color={themeColors.secondary} /> : <Ionicons name="download-outline" size={24} color={themeColors.secondary} />}</TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
                <View style={styles.detailImageContainer}>
                  {selectedItem.image ? (
                    <Image source={selectedItem.image} style={styles.detailImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.detailImage, { backgroundColor: themeColors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="leaf" size={64} color={themeColors['on-primary']} />
                    </View>
                  )}
                  <View style={[styles.detailTypeBadge, getTypeBadgeStyle(selectedItem.diseaseType)]}><Text style={[styles.detailTypeBadgeText, { color: themeColors['on-primary'] }]}>{selectedItem.diseaseType}</Text></View>
                </View>
                <Text style={[styles.detailDiseaseName, { color: themeColors.text }]}>{selectedItem.title}</Text>
                <Text style={[styles.detailSubtitle, { color: themeColors.textSecondary }]}>{selectedItem.subtitle}</Text>
                <View style={[styles.detailStatsRow, { backgroundColor: themeColors.surface }]}>
                  <View style={styles.detailStat}><Text style={[styles.detailStatValue, { color: themeColors.text }]}>{selectedItem.accuracy}%</Text><Text style={[styles.detailStatLabel, { color: themeColors.textSecondary }]}>Accuracy</Text></View>
                  <View style={[styles.detailStatDivider, { backgroundColor: themeColors.border }]} />
                  <View style={styles.detailStat}><View style={[styles.detailSeverityDot, { backgroundColor: getSeverityColor(selectedItem.severity) }]} /><Text style={[styles.detailStatValue, { color: themeColors.text }]}>{selectedItem.severity}</Text><Text style={[styles.detailStatLabel, { color: themeColors.textSecondary }]}>Severity</Text></View>
                  <View style={[styles.detailStatDivider, { backgroundColor: themeColors.border }]} />
                  <View style={styles.detailStat}><Text style={[styles.detailStatValue, { color: themeColors.text }]}>{new Date(selectedItem.createdAt).toLocaleDateString()}</Text><Text style={[styles.detailStatLabel, { color: themeColors.textSecondary }]}>Date</Text></View>
                </View>
                {!!selectedItem.description && <View style={styles.detailSection}><Text style={[styles.detailSectionTitle, { color: themeColors.secondary }]}>Description</Text><Text style={[styles.detailSectionText, { color: themeColors.text }]}>{selectedItem.description}</Text></View>}
                {!!selectedItem.symptoms && <View style={styles.detailSection}><Text style={[styles.detailSectionTitle, { color: themeColors.secondary }]}>Symptoms</Text><Text style={[styles.detailSectionText, { color: themeColors.text }]}>{selectedItem.symptoms}</Text></View>}
                {!!selectedItem.treatment && <View style={styles.detailSection}><Text style={[styles.detailSectionTitle, { color: themeColors.secondary }]}>Treatment</Text><Text style={[styles.detailSectionText, { color: themeColors.text }]}>{selectedItem.treatment}</Text></View>}
                {!!selectedItem.prevention && <View style={styles.detailSection}><Text style={[styles.detailSectionTitle, { color: themeColors.secondary }]}>Prevention</Text><Text style={[styles.detailSectionText, { color: themeColors.text }]}>{selectedItem.prevention}</Text></View>}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <Text style={[styles.detailSectionTitle, { color: themeColors.secondary }]}>Notes</Text>
                    <TouchableOpacity onPress={() => { setDetailModalVisible(false); setTimeout(() => openNotesModal(selectedItem), 300); }}><Ionicons name="create-outline" size={20} color={themeColors.secondary} /></TouchableOpacity>
                  </View>
                  <Text style={[styles.detailSectionText, { color: selectedItem.notes ? themeColors.text : themeColors.textSecondary, fontStyle: selectedItem.notes ? 'normal' : 'italic' }]}>{selectedItem.notes || 'No notes added. Tap the pencil icon to add notes.'}</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Notes Modal */}
      {selectedItem && (
        <Modal animationType="slide" transparent visible={notesModalVisible} onRequestClose={() => setNotesModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '60%', backgroundColor: themeColors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>Add Notes</Text>
                <TouchableOpacity onPress={() => setNotesModalVisible(false)} style={styles.modalCloseButton}><Ionicons name="close" size={24} color={themeColors.text} /></TouchableOpacity>
              </View>
              <Text style={[styles.notesForText, { color: themeColors.text }]}>Notes for: {selectedItem.title}</Text>
              <TextInput style={[styles.notesInput, { backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.border }]} placeholder="Enter your observations, field location, treatment notes..." placeholderTextColor={themeColors.textSecondary} multiline value={noteText} onChangeText={setNoteText} textAlignVertical="top" />
              <View style={styles.notesActions}>
                <TouchableOpacity style={[styles.notesButton, { backgroundColor: themeColors.surface }]} onPress={() => setNotesModalVisible(false)}><Text style={[styles.notesCancelText, { color: themeColors.text }]}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.notesButton, { backgroundColor: themeColors.primary }]} onPress={saveNote}><Text style={[styles.notesSaveText, { color: themeColors['on-primary'] }]}>Save Note</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Confirm Modal */}
      <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.savedModalCard, { backgroundColor: themeColors.card }]}>
            <View style={[styles.confirmIconCircle, { backgroundColor: themeColors.surface }]}><Ionicons name={confirmConfig.icon} size={30} color={themeColors.secondary} /></View>
            <Text style={[styles.savedModalTitle, { color: themeColors.text }]}>{confirmConfig.title}</Text>
            <Text style={[styles.savedModalBody, { color: themeColors.textSecondary }]}>{confirmConfig.body}</Text>
            <TouchableOpacity style={[styles.savedModalButton, { backgroundColor: themeColors.primary }]} onPress={confirmConfig.onConfirm} activeOpacity={0.85}><Text style={[styles.savedModalButtonText, { color: themeColors['on-primary'] }]}>{confirmConfig.confirmLabel}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.confirmCancelButton} onPress={() => setConfirmModalVisible(false)} activeOpacity={0.7}><Text style={[styles.confirmCancelText, { color: themeColors.textSecondary }]}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={successModalVisible} transparent animationType="fade" onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.savedModalCard, { backgroundColor: themeColors.card }]}>
            <View style={[styles.savedIconCircle, { backgroundColor: themeColors.primary }]}><Ionicons name="checkmark" size={32} color={themeColors['on-primary']} /></View>
            <Text style={[styles.savedModalTitle, { color: themeColors.text }]}>{successConfig.title}</Text>
            <Text style={[styles.savedModalBody, { color: themeColors.textSecondary }]}>{successConfig.body}</Text>
            <TouchableOpacity style={[styles.savedModalButton, { backgroundColor: themeColors.primary }]} onPress={() => setSuccessModalVisible(false)} activeOpacity={0.85}><Text style={[styles.savedModalButtonText, { color: themeColors['on-primary'] }]}>OK</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}) },
  header: { width: '100%', minHeight: HEADER_HEIGHT, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
  headerText: { fontFamily: 'Montserrat', fontSize: 18, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconButton: { padding: spacing.xs },
  checkboxContainer: { justifyContent: 'center', marginRight: spacing.xs },
  checkboxContainerDetailed: { position: 'absolute', top: 10, right: 10, zIndex: 5 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  trashNoticeWrapper: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  trashNotice: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: 30, borderRadius: rounded.DEFAULT, gap: spacing.sm },
  trashNoticeText: { flex: 1, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  toggleContainer: { flexDirection: 'row', margin: spacing.md, borderRadius: rounded.md, padding: spacing.xs },
  toggleButton: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: rounded.DEFAULT },
  toggleText: { fontSize: 12, fontWeight: '600' },
  toggleCount: { fontSize: 12, fontWeight: '400' },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  filterInfo: { paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  filterInfoText: { fontSize: 12, fontWeight: '500' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  sectionHeaderText: { fontSize: 16, fontWeight: '700', marginRight: spacing.sm },
  sectionHeaderLine: { flex: 1, height: 1 },
  cardWrapper: { marginBottom: spacing.sm },
  historyCard: { borderRadius: rounded.DEFAULT, padding: spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  imageContainer: { width: 70, height: 70, borderRadius: rounded.DEFAULT, overflow: 'hidden', marginRight: spacing.sm, justifyContent: 'center', alignItems: 'center' },
  thumbnail: { width: '100%', height: '100%' },
  historyContent: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  badgeRow: { flexDirection: 'row', gap: 4 },
  savedBadge: { width: 20, height: 20, borderRadius: rounded.full, alignItems: 'center', justifyContent: 'center' },
  deletedBadge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: rounded.sm },
  deletedBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  archivedBadge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: rounded.sm },
  archivedBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  historySubtitle: { fontSize: 12, fontWeight: '500' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  accuracyContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 100 },
  accuracyBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', maxWidth: 100 },
  accuracyBarFill: { height: '100%', borderRadius: 3 },
  accuracyText: { fontSize: 10, fontWeight: '600', minWidth: 35 },
  typeBadge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: rounded.full },
  typeBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  actionButtons: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { padding: spacing.xs },
  actionButtonDisabled: { padding: spacing.xs, opacity: 0.4 },
  bulkActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },
  bulkButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs },
  bulkButtonText: { fontSize: 14, fontWeight: '600' },
  detailedCardWrapper: { marginBottom: spacing.md },
  detailedCard: { borderRadius: rounded.DEFAULT, overflow: 'hidden' },
  detailedImage: { width: '100%', height: 160 },
  detailedContent: { padding: spacing.md, gap: spacing.xs },
  detailedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailedTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  detailedSubtitle: { fontSize: 13, fontWeight: '500' },
  detailedDescription: { fontSize: 12, lineHeight: 18 },
  detailedFooter: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: rounded.DEFAULT, padding: spacing.sm, marginTop: spacing.xs },
  detailedStat: { alignItems: 'center', gap: 2 },
  detailedStatLabel: { fontSize: 10, fontWeight: '500' },
  detailedStatValue: { fontSize: 13, fontWeight: '600' },
  detailedAccuracyBar: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%' },
  detailedActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  detailedActionButtons: { flexDirection: 'row', gap: spacing.lg },
  detailedActionButton: { padding: spacing.xs },
  detailedActionButtonDisabled: { padding: spacing.xs, opacity: 0.4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: spacing.md },
  emptySubtext: { fontSize: 14, marginTop: spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: rounded.xl, padding: spacing.lg, width: '90%', maxWidth: 400, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalCloseButton: { padding: spacing.xs },
  modalSection: { marginBottom: spacing.md },
  modalSectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: rounded.full, borderWidth: 1, borderColor: 'transparent' },
  filterChipText: { fontSize: 12, fontWeight: '500' },
  sortOptions: { gap: spacing.xs },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: rounded.DEFAULT },
  sortOptionText: { fontSize: 13 },
  applyButton: { paddingVertical: spacing.sm, borderRadius: rounded.DEFAULT, alignItems: 'center', marginTop: spacing.xs },
  applyButtonText: { fontSize: 16, fontWeight: '700' },
  resetButton: { paddingVertical: spacing.sm, borderRadius: rounded.DEFAULT, alignItems: 'center', marginTop: spacing.xs },
  resetButtonText: { fontSize: 14, fontWeight: '600' },
  detailModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailModalContent: { borderTopLeftRadius: rounded.xl, borderTopRightRadius: rounded.xl, padding: spacing.lg, maxHeight: '90%', minHeight: '70%' },
  detailModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  detailCloseButton: { padding: spacing.xs },
  detailExportButton: { padding: spacing.xs },
  detailModalTitle: { fontSize: 18, fontWeight: '700' },
  detailScrollContent: { paddingBottom: spacing.lg },
  detailImageContainer: { width: '100%', height: 200, borderRadius: rounded.DEFAULT, overflow: 'hidden', marginBottom: spacing.md, position: 'relative' },
  detailImage: { width: '100%', height: '100%' },
  detailTypeBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: rounded.full },
  detailTypeBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  detailDiseaseName: { fontSize: 22, fontWeight: '700', marginBottom: spacing.xs },
  detailSubtitle: { fontSize: 14, marginBottom: spacing.md },
  detailStatsRow: { flexDirection: 'row', borderRadius: rounded.DEFAULT, padding: spacing.md, marginBottom: spacing.md, justifyContent: 'space-around' },
  detailStat: { alignItems: 'center' },
  detailStatValue: { fontSize: 16, fontWeight: '700' },
  detailStatLabel: { fontSize: 11, marginTop: 2 },
  detailStatDivider: { width: 1 },
  detailSeverityDot: { width: 10, height: 10, borderRadius: rounded.full, marginBottom: spacing.xs },
  detailSection: { marginBottom: spacing.md },
  detailSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  detailSectionTitle: { fontSize: 15, fontWeight: '700' },
  detailSectionText: { fontSize: 14, lineHeight: 22 },
  notesForText: { fontSize: 14, marginBottom: spacing.sm, fontWeight: '500' },
  notesInput: { borderRadius: rounded.DEFAULT, padding: spacing.md, minHeight: 150, fontSize: 14, borderWidth: 1 },
  notesActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  notesButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: rounded.DEFAULT, alignItems: 'center' },
  notesCancelText: { fontWeight: '600' },
  notesSaveText: { fontWeight: '600' },
  savedModalCard: { width: '100%', maxWidth: 340, borderRadius: rounded.xl, padding: spacing.xl, alignItems: 'center' },
  savedIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  confirmIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  savedModalTitle: { fontSize: 20, fontWeight: '700', marginBottom: spacing.xs, textAlign: 'center' },
  savedModalBody: { fontSize: 14, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  savedModalButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: rounded.full, width: '100%', minHeight: 48, paddingHorizontal: spacing.sm, gap: spacing.xs + 2 },
  savedModalButtonText: { fontSize: 14, fontWeight: '600' },
  confirmCancelButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs, marginTop: spacing.xs, width: '100%' },
  confirmCancelText: { fontSize: 14, fontWeight: '500' },
});

export default HistoryScreen;