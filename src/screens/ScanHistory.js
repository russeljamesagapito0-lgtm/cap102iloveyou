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
const HEADER_HEIGHT = 60;
const MIN_TOUCH = 48;

const TABS = [
  { key: 'recent',   label: 'Recent',  iconOff: 'time-outline',     iconOn: 'time' },
  { key: 'saved',    label: 'Saved',   iconOff: 'bookmark-outline', iconOn: 'bookmark' },
  { key: 'archived', label: 'Archive', iconOff: 'archive-outline',  iconOn: 'archive' },
  { key: 'trash',    label: 'Trash',   iconOff: 'trash-outline',    iconOn: 'trash' },
];

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

const isRealValue = (v) => {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s.length > 0 && s.toLowerCase() !== 'unknown';
};

const mapRowToItem = (row) => {
  const diseaseType = isRealValue(row.disease_type) ? row.disease_type : null;

  let subtitle;
  if (diseaseType) {
    subtitle = `${diseaseType} Detected`;
  } else if (isRealValue(row.crop_type)) {
    subtitle = `${row.crop_type} Scan`;
  } else {
    subtitle = 'Scan Result';
  }

  return {
    id: row.id,
    title: row.disease_name || row.crop_type || 'Untitled Scan',
    subtitle,
    detail: row.severity ? `Severity: ${row.severity}` : '',
    extra: '',
    image: row.image_path ? { uri: row.image_path } : null,
    isArchived: !!row.is_archived,
    isSaved: !!row.is_saved,
    isDeleted: !!row.is_deleted,
    archivedAt: row.archived_at,
    createdAt: row.captured_at || row.created_at,
    diseaseType,
    severity: row.severity || 'None',
    accuracy: typeof row.accuracy === 'number' ? row.accuracy : parseFloat(row.accuracy) || 0,
    description: row.description || '',
    treatment: row.treatment || '',
    prevention: row.prevention || '',
    symptoms: row.symptoms || '',
    notes: row.notes || '',
  };
};

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

  const handleSave = async (id) => {
    if (isSelectMode) { toggleSelect(id); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const item = historyData.find(i => i.id === id);
    const next = !item?.isSaved;

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
                {item.diseaseType && (
                  <View style={[styles.typeBadge, getTypeBadgeStyle(item.diseaseType)]}>
                    <Text style={[styles.typeBadgeText, { color: themeColors['on-primary'] }]}>
                      {item.diseaseType}
                    </Text>
                  </View>
                )}
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
              {item.diseaseType && (
                <View style={[styles.typeBadge, getTypeBadgeStyle(item.diseaseType)]}>
                  <Text style={[styles.typeBadgeText, { color: themeColors['on-primary'] }]}>
                    {item.diseaseType}
                  </Text>
                </View>
              )}
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
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={themeColors.background} />

      {/* ---------- HEADER ---------- */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        {isSelectMode ? (
          <>
            <TouchableOpacity style={styles.headerButton} onPress={exitSelectMode}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>
              {selectedIds.length} selected
            </Text>
            <TouchableOpacity style={styles.headerButton} onPress={handleSelectAll}>
              <Text style={[styles.headerActionText, { color: themeColors.primary }]}>
                {selectedIds.length === filteredData.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.headerButton} />
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Scan History</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton} onPress={() => setViewMode(viewMode === 'list' ? 'detailed' : 'list')}>
                <Ionicons name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} size={22} color={themeColors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={() => setFilterModalVisible(true)}>
                <Ionicons name="options-outline" size={22} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ---------- TABS ---------- */}
      <View style={[styles.tabsContainer, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = getTabCount(tab.key);
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && { borderBottomColor: themeColors.primary, borderBottomWidth: 2 }]}
              onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
            >
              <Ionicons name={isActive ? tab.iconOn : tab.iconOff} size={18} color={isActive ? themeColors.primary : themeColors.textSecondary} />
              <Text style={[styles.tabLabel, { color: isActive ? themeColors.primary : themeColors.textSecondary }]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: isActive ? themeColors.primary : themeColors.border }]}>
                  <Text style={[styles.tabBadgeText, { color: isActive ? themeColors['on-primary'] : themeColors.textSecondary }]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ---------- FILTER CHIP ROW ---------- */}
      {(selectedFilter !== 'All' || sortBy !== 'newest') && !isSelectMode && (
        <View style={styles.activeFilterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilterScroll}>
            {selectedFilter !== 'All' && (
              <View style={[styles.activeFilterChip, { backgroundColor: themeColors.primary + '20', borderColor: themeColors.primary }]}>
                <Text style={[styles.activeFilterText, { color: themeColors.primary }]}>{selectedFilter}</Text>
                <TouchableOpacity onPress={() => setSelectedFilter('All')}>
                  <Ionicons name="close-circle" size={16} color={themeColors.primary} />
                </TouchableOpacity>
              </View>
            )}
            {sortBy !== 'newest' && (
              <View style={[styles.activeFilterChip, { backgroundColor: themeColors.primary + '20', borderColor: themeColors.primary }]}>
                <Text style={[styles.activeFilterText, { color: themeColors.primary }]}>
                  Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                </Text>
                <TouchableOpacity onPress={() => setSortBy('newest')}>
                  <Ionicons name="close-circle" size={16} color={themeColors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* ---------- LIST ---------- */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading scans...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="leaf-outline" size={64} color={themeColors.border} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No scans found</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                {activeTab === 'recent' && 'Start scanning crops to see them here.'}
                {activeTab === 'saved' && 'Save scans to access them quickly.'}
                {activeTab === 'archived' && 'Archived scans will appear here.'}
                {activeTab === 'trash' && 'Deleted scans will appear here.'}
              </Text>
            </View>
          }
        />
      )}

      {/* ---------- BULK ACTION BAR ---------- */}
      {isSelectMode && selectedIds.length > 0 && (
        <View style={[styles.bulkBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
          {activeTab === 'recent' && (
            <>
              <TouchableOpacity style={styles.bulkButton} onPress={() => { /* save bulk not used */ }}>
                <Ionicons name="bookmark-outline" size={22} color={themeColors.textSecondary} />
                <Text style={[styles.bulkButtonText, { color: themeColors.textSecondary }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkArchive}>
                <Ionicons name="archive-outline" size={22} color={themeColors.textSecondary} />
                <Text style={[styles.bulkButtonText, { color: themeColors.textSecondary }]}>Archive</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkTrash}>
                <Ionicons name="trash-outline" size={22} color={themeColors.error} />
                <Text style={[styles.bulkButtonText, { color: themeColors.error }]}>Trash</Text>
              </TouchableOpacity>
            </>
          )}
          {activeTab === 'saved' && (
            <>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkUnsave}>
                <Ionicons name="bookmark-outline" size={22} color={themeColors.textSecondary} />
                <Text style={[styles.bulkButtonText, { color: themeColors.textSecondary }]}>Unsave</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkRestore}>
                <Ionicons name="refresh-outline" size={22} color="#4CAF50" />
                <Text style={[styles.bulkButtonText, { color: '#4CAF50' }]}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkTrash}>
                <Ionicons name="trash-outline" size={22} color={themeColors.error} />
                <Text style={[styles.bulkButtonText, { color: themeColors.error }]}>Trash</Text>
              </TouchableOpacity>
            </>
          )}
          {activeTab === 'archived' && (
            <>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkRestore}>
                <Ionicons name="refresh-outline" size={22} color="#4CAF50" />
                <Text style={[styles.bulkButtonText, { color: '#4CAF50' }]}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkTrash}>
                <Ionicons name="trash-outline" size={22} color={themeColors.error} />
                <Text style={[styles.bulkButtonText, { color: themeColors.error }]}>Trash</Text>
              </TouchableOpacity>
            </>
          )}
          {activeTab === 'trash' && (
            <>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkRestore}>
                <Ionicons name="refresh-outline" size={22} color="#4CAF50" />
                <Text style={[styles.bulkButtonText, { color: '#4CAF50' }]}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkButton} onPress={handleBulkDeleteForever}>
                <Ionicons name="trash-outline" size={22} color={themeColors.error} />
                <Text style={[styles.bulkButtonText, { color: themeColors.error }]}>Delete Forever</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* ---------- FILTER MODAL ---------- */}
      <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <View style={[styles.filterSheet, { backgroundColor: themeColors.surface }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: themeColors.text }]}>Filter & Sort</Text>

            <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>Disease Type</Text>
            <View style={styles.filterChipRow}>
              {diseaseTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterChip, { borderColor: themeColors.border, backgroundColor: themeColors.card }, selectedFilter === type && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                  onPress={() => setSelectedFilter(type)}
                >
                  <Text style={[styles.filterChipText, { color: selectedFilter === type ? themeColors['on-primary'] : themeColors.text }]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>Sort By</Text>
            <View style={styles.filterChipRow}>
              {['newest', 'oldest', 'name', 'accuracy'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.filterChip, { borderColor: themeColors.border, backgroundColor: themeColors.card }, sortBy === option && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                  onPress={() => setSortBy(option)}
                >
                  <Text style={[styles.filterChipText, { color: sortBy === option ? themeColors['on-primary'] : themeColors.text }]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity style={[styles.filterResetButton, { borderColor: themeColors.border }]} onPress={() => { setSelectedFilter('All'); setSortBy('newest'); }}>
                <Text style={[styles.filterResetText, { color: themeColors.text }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterApplyButton, { backgroundColor: themeColors.primary }]} onPress={() => setFilterModalVisible(false)}>
                <Text style={[styles.filterApplyText, { color: themeColors['on-primary'] }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---------- DETAIL MODAL ---------- */}
      <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.detailSheet, { backgroundColor: themeColors.surface }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.detailSheetHeader}>
              <Text style={[styles.detailSheetTitle, { color: themeColors.text }]} numberOfLines={2}>
                {selectedItem?.title}
              </Text>
              <TouchableOpacity
                style={styles.detailCloseButton}
                onPress={() => setDetailModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={26} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.detailScrollContent}
            >
              {selectedItem?.image ? (
                <Image source={selectedItem.image} style={styles.detailImage} resizeMode="cover" />
              ) : (
                <View style={[styles.detailImage, { backgroundColor: themeColors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="leaf" size={64} color={themeColors['on-primary']} />
                </View>
              )}

              <View style={styles.detailRowInfo}>
                <Text style={[styles.detailDate, { color: themeColors.textSecondary }]}>
                  {selectedItem?.createdAt
                    ? new Date(selectedItem.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })
                    : ''}
                </Text>
              </View>

              <View style={styles.detailStatsRow}>
                <View style={styles.detailStatBlock}>
                  <Text style={[styles.detailStatLabel, { color: themeColors.textSecondary }]}>
                    Accuracy
                  </Text>
                  <Text style={[styles.detailStatValue, { color: themeColors.text }]}>
                    {selectedItem?.accuracy}%
                  </Text>
                  <View style={[styles.accuracyBarTrack, { backgroundColor: themeColors.border }]}>
                    <View
                      style={[
                        styles.accuracyBarFill,
                        { width: `${Math.min(selectedItem?.accuracy || 0, 100)}%` },
                        getAccuracyColor(selectedItem?.accuracy),
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.detailStatBlock}>
                  <Text style={[styles.detailStatLabel, { color: themeColors.textSecondary }]}>
                    Severity
                  </Text>
                  <Text style={[styles.detailStatValue, { color: getSeverityColor(selectedItem?.severity) }]}>
                    {selectedItem?.severity || 'None'}
                  </Text>
                </View>
              </View>

              {[
                { label: 'Description', value: selectedItem?.description },
                { label: 'Symptoms', value: selectedItem?.symptoms },
                { label: 'Treatment', value: selectedItem?.treatment },
                { label: 'Prevention', value: selectedItem?.prevention },
                { label: 'Notes', value: selectedItem?.notes },
              ]
                .filter((section) => section.value)
                .map((section) => (
                  <View key={section.label} style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { color: themeColors.text }]}>
                      {section.label}
                    </Text>
                    <Text style={[styles.detailSectionBody, { color: themeColors.textSecondary }]}>
                      {section.value}
                    </Text>
                  </View>
                ))}

              <View style={styles.detailActionsFull}>
                <TouchableOpacity
                  style={[styles.detailActionFullButton, { borderColor: themeColors.border }]}
                  onPress={() => {
                    setDetailModalVisible(false);
                    openNotesModal(selectedItem);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={themeColors.text} />
                  <Text style={[styles.detailActionFullText, { color: themeColors.text }]}>Add Note</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailActionFullButton, { borderColor: themeColors.border }]}
                  onPress={exportReport}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <ActivityIndicator size="small" color={themeColors.text} />
                  ) : (
                    <Ionicons name="share-outline" size={20} color={themeColors.text} />
                  )}
                  <Text style={[styles.detailActionFullText, { color: themeColors.text }]}>
                    {isExporting ? 'Exporting...' : 'Export'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---------- NOTES MODAL ---------- */}
      <Modal visible={notesModalVisible} transparent animationType="fade" onRequestClose={() => setNotesModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNotesModalVisible(false)}>
          <View style={[styles.notesSheet, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.sheetTitle, { color: themeColors.text }]}>Add Note</Text>
            <TextInput
              style={[styles.notesInput, { color: themeColors.text, borderColor: themeColors.border, backgroundColor: themeColors.card }]}
              placeholder="Write your notes here..."
              placeholderTextColor={themeColors.textSecondary}
              multiline
              numberOfLines={5}
              value={noteText}
              onChangeText={setNoteText}
              textAlignVertical="top"
            />
            <View style={styles.notesActions}>
              <TouchableOpacity style={[styles.notesCancelButton, { borderColor: themeColors.border }]} onPress={() => setNotesModalVisible(false)}>
                <Text style={[styles.notesCancelText, { color: themeColors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.notesSaveButton, { backgroundColor: themeColors.primary }]} onPress={saveNote}>
                <Text style={[styles.notesSaveText, { color: themeColors['on-primary'] }]}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---------- CONFIRM MODAL ---------- */}
      <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setConfirmModalVisible(false)}>
          <View style={[styles.confirmSheet, { backgroundColor: themeColors.surface }]}>
            <View style={[styles.confirmIconContainer, { backgroundColor: themeColors.primary + '15' }]}>
              <Ionicons name={confirmConfig.icon} size={32} color={themeColors.primary} />
            </View>
            <Text style={[styles.confirmTitle, { color: themeColors.text }]}>{confirmConfig.title}</Text>
            <Text style={[styles.confirmBody, { color: themeColors.textSecondary }]}>{confirmConfig.body}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmCancelButton, { borderColor: themeColors.border }]} onPress={() => setConfirmModalVisible(false)}>
                <Text style={[styles.confirmCancelText, { color: themeColors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmActionButton, { backgroundColor: themeColors.primary }]} onPress={confirmConfig.onConfirm}>
                <Text style={[styles.confirmActionText, { color: themeColors['on-primary'] }]}>{confirmConfig.confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---------- SUCCESS MODAL ---------- */}
      <Modal visible={successModalVisible} transparent animationType="fade" onRequestClose={() => setSuccessModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSuccessModalVisible(false)}>
          <View style={[styles.successSheet, { backgroundColor: themeColors.surface }]}>
            <View style={[styles.successIconContainer, { backgroundColor: '#27AE60' + '20' }]}>
              <Ionicons name="checkmark-circle" size={48} color="#27AE60" />
            </View>
            <Text style={[styles.successTitle, { color: themeColors.text }]}>{successConfig.title}</Text>
            <Text style={[styles.successBody, { color: themeColors.textSecondary }]}>{successConfig.body}</Text>
            <TouchableOpacity style={[styles.successButton, { backgroundColor: themeColors.primary }]} onPress={() => setSuccessModalVisible(false)}>
              <Text style={[styles.successButtonText, { color: themeColors['on-primary'] }]}>Great!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Active filter row
  activeFilterRow: {
    paddingVertical: 8,
  },
  activeFilterScroll: {
    paddingHorizontal: spacing.marginMobile,
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: rounded.full,
    borderWidth: 1,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: 80,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  cardWrapper: {
    marginBottom: spacing.sm,
  },
  historyCard: {
    borderRadius: rounded.md,
    padding: spacing.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    paddingRight: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: rounded.DEFAULT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  historyContent: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  savedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rounded.sm,
  },
  deletedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  archivedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rounded.sm,
  },
  archivedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  historySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  accuracyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  accuracyBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    maxWidth: 80,
  },
  accuracyBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  accuracyText: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 30,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: rounded.full,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },

  // Detailed view
  detailedCardWrapper: {
    marginBottom: spacing.md,
  },
  detailedCard: {
    borderRadius: rounded.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  checkboxContainerDetailed: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 10,
    padding: 4,
  },
  detailedImage: {
    width: '100%',
    height: 160,
  },
  detailedContent: {
    padding: spacing.md,
  },
  detailedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailedTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  detailedSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  detailedDescription: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  detailedFooter: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: rounded.DEFAULT,
    gap: spacing.lg,
  },
  detailedStat: {
    flex: 1,
  },
  detailedStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailedAccuracyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailedStatValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  detailedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  detailedActionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  detailedActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailedActionButtonDisabled: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },

  // Loading / Empty
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  // Bulk bar
  bulkBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  bulkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: 2,
    minWidth: 60,
  },
  bulkButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Modal overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCC',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Filter sheet
  filterSheet: {
    borderTopLeftRadius: rounded.xl,
    borderTopRightRadius: rounded.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: rounded.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  filterResetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterResetText: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterApplyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  filterApplyText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Detail sheet
  detailSheet: {
    borderTopLeftRadius: rounded.xl,
    borderTopRightRadius: rounded.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
    maxHeight: '92%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  detailScrollContent: {
    paddingBottom: spacing.lg,
  },
  detailSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  detailSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    lineHeight: 26,
  },
  detailCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  detailImage: {
    width: '100%',
    height: 220,
    borderRadius: rounded.lg,
    marginBottom: spacing.md,
    backgroundColor: '#000',
  },
  detailRowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.lg,
  },
  detailDate: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailStatsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  detailStatBlock: {
    flex: 1,
  },
  detailStatLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  detailStatValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  detailSection: {
    marginBottom: spacing.lg,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  detailSectionBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  detailActionsFull: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  detailActionFullButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
  },
  detailActionFullText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Notes sheet
  notesSheet: {
    margin: spacing.marginMobile,
    borderRadius: rounded.lg,
    padding: spacing.lg,
    marginBottom: 100,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: rounded.md,
    padding: spacing.md,
    fontSize: 15,
    minHeight: 120,
    marginBottom: spacing.md,
  },
  notesActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  notesCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    alignItems: 'center',
  },
  notesCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  notesSaveButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  notesSaveText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Confirm modal
  confirmSheet: {
    margin: spacing.marginMobile,
    borderRadius: rounded.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: 100,
  },
  confirmIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  confirmBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  confirmActionText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Success modal
  successSheet: {
    margin: spacing.marginMobile,
    borderRadius: rounded.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: 100,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  successButton: {
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    borderRadius: rounded.full,
    alignItems: 'center',
    width: '100%',
  },
  successButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default HistoryScreen;