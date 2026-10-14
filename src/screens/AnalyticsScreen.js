import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  RefreshControl,
  LayoutAnimation,
  UIManager,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../utils/supabaseClient';
import { DISEASE_INFO } from '../constants/diseaseInfo';
import { getSeasonConfig, DEFAULT_SEASON_CONFIG } from '../constants/seasonConfig';
import {
  getCurrentSeason,
  getLastSeason,
  getPreviousSeason,
  buildSeasonReport,
  buildComparison,
  buildSixMonthComparison,
  buildHeadlineAdvice,
  buildRollingComparison,
  buildActionChecklist,
  ACTION_META,
} from '../utils/analyticsEngine';
import { buildSeasonReportHtml } from '../utils/seasonReportPdf';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const rounded = { sm: 8, md: 12, lg: 18, full: 9999 };

const GREEN_HEALTHY = '#2E9E4F';

const DISEASE_GREENS = ['#1E7A3A', '#2E9E4F', '#4CB86A', '#6ECB87', '#93DCA6'];
const DISEASE_PALETTE = DISEASE_GREENS;

const SEVERITY = {
  High: { color: '#D9423A', label: 'High' },
  Medium: { color: '#E8912D', label: 'Medium' },
  Low: { color: '#2E9E4F', label: 'Low' },
};

const RANGES = [
  { key: 'current', label: 'This season' },
  { key: 'last', label: 'Last season' },
  { key: 'all', label: 'All time' },
];

const withAlpha = (hex, a) => {
  const n = Math.round(a * 255).toString(16).padStart(2, '0');
  return `${hex}${n}`;
};

const animateLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));

const timeAgo = (iso) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  const months = Math.floor(day / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
};

const formatScanDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatScanTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const CODE_ALIASES = {
  cbb: 'bacterial_blight',
  cbsd: 'cassava_brown_streak',
  cmd: 'cassava_mosaic',
  cgm: 'green_mite',
  cad: 'anthracnose',
};

const normalizeCode = (raw) => {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  if (!k) return null;
  return CODE_ALIASES[k] || k;
};

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

const HealthBar = ({ healthy, diseases, total, trackColor }) => {
  if (!total) return null;
  const segments = [
    { key: 'healthy', count: healthy, color: GREEN_HEALTHY },
    ...diseases.map((d, i) => ({
      key: d.code,
      count: d.count,
      color: DISEASE_PALETTE[i % DISEASE_PALETTE.length],
    })),
  ].filter((s) => s.count > 0);

  return (
    <View style={[styles.bar, { backgroundColor: trackColor }]}>
      {segments.map((s, i) => (
        <View
          key={s.key}
          style={{
            flex: s.count,
            backgroundColor: s.color,
            marginLeft: i === 0 ? 0 : 2,
          }}
        />
      ))}
    </View>
  );
};

const LegendDot = ({ color, label, count, textColor }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={[styles.legendText, { color: textColor }]} numberOfLines={1}>
      {label}
    </Text>
    <Text style={[styles.legendCount, { color: textColor }]}>{count}</Text>
  </View>
);

const RollingTrendCard = ({ rolling, themeColors }) => {
  if (!rolling) return null;

  const tone =
    rolling.trend === 'worsening'
      ? { bg: '#D9423A', fg: '#FFFFFF', sub: 'rgba(255,255,255,0.9)' }
      : rolling.trend === 'improving'
      ? { bg: '#2E9E4F', fg: '#FFFFFF', sub: 'rgba(255,255,255,0.9)' }
      : { bg: themeColors.surface, fg: themeColors.text, sub: themeColors.textSecondary };

  const icon =
    rolling.trend === 'worsening'
      ? 'trending-up'
      : rolling.trend === 'improving'
      ? 'trending-down'
      : rolling.trend === 'quiet'
      ? 'moon-outline'
      : 'remove';

  return (
    <View style={[styles.rollingCard, { backgroundColor: tone.bg, borderColor: tone.bg }]}>
      <View style={styles.rollingHeader}>
        <Ionicons name={icon} size={16} color={tone.fg} />
        <Text style={[styles.rollingTitle, { color: tone.fg }]}>Last 30 days</Text>
      </View>

      <Text style={[styles.rollingBody, { color: tone.fg }]}>{rolling.text}</Text>

      {!!rolling.driverText && (
        <Text style={[styles.rollingDriver, { color: tone.sub }]}>{rolling.driverText}</Text>
      )}
    </View>
  );
};

const Checklist = ({ items, themeColors }) => {
  if (!items.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
          What to do next
        </Text>
      </View>

      <View
        style={[
          styles.checklistCard,
          { backgroundColor: themeColors.card, borderColor: themeColors.border },
        ]}
      >
        {items.map((item, i) => {
          const iconName = ACTION_META.ICON_FOR_ACTION[item.kind];
          const isLast = i === items.length - 1;
          const accent =
            item.kind === 'urgent'
              ? '#D9423A'
              : item.kind === 'treat'
              ? '#E8912D'
              : item.kind === 'protect'
              ? themeColors.primary
              : themeColors.textSecondary;

          return (
            <View
              key={item.id}
              style={[
                styles.checklistRow,
                !isLast && {
                  borderBottomWidth: 1,
                  borderBottomColor: themeColors.border,
                },
              ]}
            >
              <View style={[styles.checklistNumber, { backgroundColor: accent + '18' }]}>
                <Text style={[styles.checklistNumberText, { color: accent }]}>{i + 1}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.checklistLabelRow}>
                  <Ionicons name={iconName} size={14} color={accent} />
                  <Text
                    style={[styles.checklistLabel, { color: themeColors.text }]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                </View>
                {!!item.detail && (
                  <Text style={[styles.checklistDetail, { color: themeColors.textSecondary }]}>
                    {item.detail}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/* Scans modal                                                         */
/* ------------------------------------------------------------------ */

const ScanThumb = ({ scan, style }) => {
  if (scan.image) {
    return <Image source={{ uri: scan.image }} style={style} resizeMode="cover" />;
  }
  return (
    <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EDE7' }]}>
      <Ionicons name="leaf" size={24} color="#2E9E4F" />
    </View>
  );
};

const DiseaseScansModal = ({ visible, item, scans, onClose, onOpenScan, themeColors }) => {
  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scansOverlay}>
        <View style={[styles.scansSheet, { backgroundColor: themeColors.background }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.scansHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scansTitle, { color: themeColors.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[styles.scansSub, { color: themeColors.textSecondary }]}>
                {scans.length} scan{scans.length === 1 ? '' : 's'} this season
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.scansCloseBtn, { backgroundColor: themeColors.surface }]}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scansList}
            showsVerticalScrollIndicator={false}
          >
            {scans.map((scan, i) => {
              const isLast = i === scans.length - 1;
              return (
                <TouchableOpacity
                  key={scan.id}
                  style={[
                    styles.scanRow,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: themeColors.border },
                  ]}
                  onPress={() => onOpenScan(scan)}
                  activeOpacity={0.7}
                >
                  <ScanThumb scan={scan} style={styles.scanThumb} />

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.scanRowTitle, { color: themeColors.text }]} numberOfLines={1}>
                      {formatScanDate(scan.createdAt)}
                    </Text>
                    <Text style={[styles.scanRowSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {formatScanTime(scan.createdAt)}
                      {scan.accuracy > 0 ? ` · ${Math.round(scan.accuracy * 100)}%` : ''}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                </TouchableOpacity>
              );
            })}

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Disease card                                                        */
/* ------------------------------------------------------------------ */

const DiseaseCard = ({
  item,
  color,
  percent,
  defaultOpen,
  themeColors,
  scans,
  onViewScans,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const sev = SEVERITY[item.severity];
  const hasType = item.type && item.type !== 'Unknown';
  const hasAdvice = !!item.prevention || !!item.treatment;

  const toggle = () => {
    if (!hasAdvice) return;
    Haptics.selectionAsync();
    animateLayout();
    setOpen((o) => !o);
  };

  return (
    <View
      style={[
        styles.diseaseCard,
        { backgroundColor: themeColors.card, borderColor: themeColors.border },
      ]}
    >
      <View style={[styles.diseaseAccent, { backgroundColor: color }]} />

      <TouchableOpacity
        onPress={toggle}
        activeOpacity={hasAdvice ? 0.7 : 1}
        style={styles.diseaseHead}
        accessibilityRole={hasAdvice ? 'button' : 'text'}
        accessibilityState={hasAdvice ? { expanded: open } : undefined}
        accessibilityLabel={`${item.name}, ${item.count} scans${hasAdvice ? ', tap for advice' : ''}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.diseaseName, { color: themeColors.text }]} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.chipRow}>
            {sev && (
              <View style={[styles.chip, { backgroundColor: withAlpha(sev.color, 0.14) }]}>
                <View style={[styles.chipDot, { backgroundColor: sev.color }]} />
                <Text style={[styles.chipText, { color: sev.color }]}>{sev.label} severity</Text>
              </View>
            )}
            {hasType && (
              <View style={[styles.chip, { backgroundColor: themeColors.surface }]}>
                <Text style={[styles.chipText, { color: themeColors.textSecondary }]}>
                  {item.type}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.diseaseCountCol}>
          <Text style={[styles.diseaseCountNum, { color: themeColors.text }]}>{item.count}</Text>
          <Text style={[styles.diseaseCountSub, { color: themeColors.textSecondary }]}>
            {percent}%
          </Text>
        </View>

        {hasAdvice && (
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={themeColors.textSecondary}
            style={{ marginLeft: spacing.sm }}
          />
        )}
      </TouchableOpacity>

      {open && hasAdvice && (
        <View style={styles.adviceWrap}>
          {!!item.treatment && (
            <View
              style={[
                styles.adviceBlock,
                { backgroundColor: withAlpha(themeColors.primary, 0.08) },
              ]}
            >
              <View style={styles.adviceHeader}>
                <Ionicons name="medkit-outline" size={15} color={themeColors.primary} />
                <Text style={[styles.adviceLabel, { color: themeColors.primary }]}>
                  If still active
                </Text>
              </View>
              <Text style={[styles.adviceText, { color: themeColors.text }]}>
                {item.treatment}
              </Text>
            </View>
          )}
          {!!item.prevention && (
            <View
              style={[
                styles.adviceBlock,
                { backgroundColor: withAlpha(themeColors.primary, 0.08) },
              ]}
            >
              <View style={styles.adviceHeader}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={15}
                  color={themeColors.primary}
                />
                <Text style={[styles.adviceLabel, { color: themeColors.primary }]}>
                  Before next season
                </Text>
              </View>
              <Text style={[styles.adviceText, { color: themeColors.text }]}>
                {item.prevention}
              </Text>
            </View>
          )}

          {scans && scans.length > 0 && (
            <TouchableOpacity
              style={[
                styles.viewScansBtn,
                { backgroundColor: withAlpha(themeColors.primary, 0.12) },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                onViewScans(item, scans);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="list-outline" size={15} color={themeColors.primary} />
              <Text style={[styles.viewScansText, { color: themeColors.primary }]}>
                View all {scans.length} scan{scans.length === 1 ? '' : 's'}
              </Text>
              <Ionicons name="arrow-forward" size={15} color={themeColors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

const AnalyticsScreen = () => {
  const { themeColors, isDarkMode } = useTheme();
  const navigation = useNavigation();

  const [rawScans, setRawScans] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState('current');
  const [exporting, setExporting] = useState(false);
  const [scansModal, setScansModal] = useState({ visible: false, item: null, scans: [] });
  const [seasonConfigId, setSeasonConfigId] = useState(DEFAULT_SEASON_CONFIG.id);
  const scrollRef = useRef(null);

  const seasonConfig = useMemo(
    () => getSeasonConfig(seasonConfigId),
    [seasonConfigId]
  );

  const loadScans = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setRawScans([]);
        return;
      }

      const [profileRes, scansRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('season_config_id')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('scans')
          .select('id, disease_name, disease_type, disease_code, severity, accuracy, captured_at, created_at, is_deleted, image_path, image_url')
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .order('captured_at', { ascending: false }),
      ]);

      if (profileRes.data?.season_config_id) {
        setSeasonConfigId(profileRes.data.season_config_id);
      }

      if (scansRes.error) {
        console.warn('Analytics load failed:', scansRes.error.message);
        return;
      }

      setRawScans(
        (scansRes.data || []).map((r) => ({
          id: r.id,
          title: r.disease_name || r.crop_type || 'Untitled Scan',
          diseaseCode: r.disease_code || null,
          diseaseName: r.disease_name || null,
          diseaseType: r.disease_type || null,
          severity: r.severity || null,
          accuracy: typeof r.accuracy === 'number' ? r.accuracy : parseFloat(r.accuracy) || 0,
          createdAt: r.captured_at || r.created_at,
          image: r.image_url || r.image_path || null,
        }))
      );
    } catch (err) {
      console.warn('Analytics error:', err.message);
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadScans();
    }, [loadScans])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadScans();
  }, [loadScans]);

  const currentSeason = useMemo(
    () => getCurrentSeason(seasonConfig),
    [seasonConfig]
  );
  const lastSeason = useMemo(
    () => getLastSeason(seasonConfig),
    [seasonConfig]
  );

  const report = useMemo(() => {
    if (range === 'all') {
      return buildSeasonReport(rawScans, {
        name: 'All Time',
        year: '',
        start: new Date(1970, 0, 1),
        end: new Date(2100, 0, 1),
      });
    }
    if (range === 'last') return buildSeasonReport(rawScans, lastSeason);
    return buildSeasonReport(rawScans, currentSeason);
  }, [rawScans, range, currentSeason, lastSeason]);

  const comparison = useMemo(() => {
    if (range === 'current') {
      const lastReport = buildSeasonReport(rawScans, lastSeason);
      return buildComparison(report, lastReport, 'last season');
    }

    if (range === 'last') {
      const seasonBeforeLast = getPreviousSeason(lastSeason, seasonConfig);
      if (!seasonBeforeLast) return null;
      const reportBeforeLast = buildSeasonReport(rawScans, seasonBeforeLast);
      return buildComparison(report, reportBeforeLast, 'the season before');
    }

    if (range === 'all') {
      return buildSixMonthComparison(rawScans);
    }

    return null;
  }, [rawScans, range, report, lastSeason, seasonConfig]);

  const rolling = useMemo(() => {
    if (range !== 'current') return null;
    return buildRollingComparison(rawScans);
  }, [rawScans, range]);

  const checklist = useMemo(() => buildActionChecklist(report), [report]);

  const headline = useMemo(() => buildHeadlineAdvice(report), [report]);

  const lastScanAt = useMemo(() => {
    if (!rawScans.length) return null;
    return rawScans.reduce((newest, s) => {
      const t = new Date(s.createdAt).getTime();
      return t > newest ? t : newest;
    }, 0);
  }, [rawScans]);

  const scansByCode = useMemo(() => {
    const map = {};
    for (const s of rawScans) {
      const c = normalizeCode(s.diseaseCode);
      if (!c || c === 'healthy') continue;
      if (!map[c]) map[c] = [];
      map[c].push(s);
    }
    for (const c of Object.keys(map)) {
      map[c].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return map;
  }, [rawScans]);

  const openScansModal = (item, scans) => {
    setScansModal({ visible: true, item, scans });
  };

  const closeScansModal = () => {
    setScansModal({ visible: false, item: null, scans: [] });
  };

  const openScanDetail = (scan) => {
    Haptics.selectionAsync();
    closeScansModal();

    const code = normalizeCode(scan.diseaseCode);
    const info = code ? DISEASE_INFO[code] : null;

    navigation.navigate('Result', {
      imageUri: scan.image || null,
      preparedImageUri: null,
      scanDate: scan.createdAt,
      diseaseKey: info ? code : null,
      diseaseLabel: info?.name || scan.diseaseName || 'Unknown',
      confidence: scan.accuracy,
      readOnly: true,
    });
  };

  // Builds the report HTML once, shared by share and print flows.
  const buildPdfHtml = useCallback(async () => {
    let user = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, full_name, region')
          .eq('id', session.user.id)
          .maybeSingle();
        user = profile || null;
      }
    } catch (_) {}

    return buildSeasonReportHtml({
      report,
      comparison,
      headline,
      rolling,
      checklist,
      user,
    });
  }, [report, comparison, headline, rolling, checklist]);

  const handleExportPdf = async () => {
    if (exporting || report.totalScans === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExporting(true);

    try {
      const html = await buildPdfHtml();
      const { uri } = await Print.printToFileAsync({ html });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          'Sharing unavailable',
          'This device cannot open the share sheet. The PDF was still generated.'
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `RootCare Season Report — ${report.label}`,
        UTI: 'com.adobe.pdf',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.warn('PDF export failed:', err?.message);
      Alert.alert('Export failed', err?.message || 'Could not generate the PDF.');
    } finally {
      setExporting(false);
    }
  };

  const handlePrintPdf = async () => {
    if (exporting || report.totalScans === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExporting(true);

    try {
      const html = await buildPdfHtml();
      await Print.printAsync({ html });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      // Cancelling the native print sheet throws on some platforms — ignore that.
      const msg = err?.message || '';
      if (!/cancel/i.test(msg)) {
        console.warn('Print failed:', msg);
        Alert.alert('Print failed', msg || 'Could not open the print dialog.');
      }
    } finally {
      setExporting(false);
    }
  };

  const changeRange = (key) => {
    if (key === range) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateLayout();
    setRange(key);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  if (initialLoad) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: themeColors.background }]}
        edges={['top']}
      >
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Gathering your scans…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasScans = report.totalScans > 0;
  const allHealthy = hasScans && report.breakdown.length === 0;
  const heroColor = allHealthy
    ? GREEN_HEALTHY
    : report.diseasedPct >= 50
    ? themeColors.primary
    : themeColors.text;

  const heroLine = !hasScans
    ? ''
    : allHealthy
    ? `All ${report.totalScans} scan${report.totalScans === 1 ? '' : 's'} came back healthy`
    : `${report.healthyCount} of ${report.totalScans} scan${report.totalScans === 1 ? '' : 's'} ${
        report.healthyCount === 1 ? 'was' : 'were'
      } healthy`;

  const lastScanLabel = lastScanAt ? `Last scan: ${timeAgo(new Date(lastScanAt).toISOString())}` : '';
  const showPrintButton = Platform.OS !== 'web';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerEyebrow, { color: themeColors.textSecondary }]}>
            Analytics
          </Text>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            Season report
          </Text>
          {hasScans && (
            <Text style={[styles.headerSub, { color: themeColors.textSecondary }]}>
              {report.label}
              {lastScanLabel ? ` · ${lastScanLabel}` : ''}
            </Text>
          )}
        </View>

        {hasScans && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleExportPdf}
              disabled={exporting}
              style={[
                styles.shareBtn,
                { backgroundColor: themeColors.surface },
                exporting && { opacity: 0.6 },
              ]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Share PDF report"
            >
              {exporting ? (
                <ActivityIndicator size="small" color={themeColors.primary} />
              ) : (
                <Ionicons name="share-outline" size={20} color={themeColors.primary} />
              )}
            </TouchableOpacity>

            {showPrintButton && (
              <TouchableOpacity
                onPress={handlePrintPdf}
                disabled={exporting}
                style={[
                  styles.shareBtn,
                  { backgroundColor: themeColors.surface },
                  exporting && { opacity: 0.6 },
                ]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Print report"
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={themeColors.primary} />
                ) : (
                  <Ionicons name="print-outline" size={20} color={themeColors.primary} />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={[styles.rangeBar, { backgroundColor: themeColors.surface }]}>
        {RANGES.map((r) => {
          const active = range === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.rangeBtn, active && { backgroundColor: themeColors.primary }]}
              onPress={() => changeRange(r.key)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.rangeText,
                  { color: active ? themeColors['on-primary'] : themeColors.textSecondary },
                ]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
            colors={[themeColors.primary]}
          />
        }
      >
        {!hasScans ? (
          <View style={styles.emptyWrap}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: withAlpha(themeColors.primary, 0.12) },
              ]}
            >
              <Ionicons name="leaf-outline" size={44} color={themeColors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              {range === 'current' ? 'No scans this season yet' : `No scans in ${report.label}`}
            </Text>
            <Text style={[styles.emptyBody, { color: themeColors.textSecondary }]}>
              Scan a few cassava leaves and this page will show how your field is doing
              and what to do next.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Scanner')}
              style={[styles.emptyCta, { backgroundColor: themeColors.primary }]}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Ionicons name="scan-outline" size={18} color={themeColors['on-primary']} />
              <Text style={[styles.emptyCtaText, { color: themeColors['on-primary'] }]}>
                Scan a leaf
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.hero,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
            >
              <Text style={[styles.heroLine, { color: heroColor }]}>{heroLine}</Text>

              <HealthBar
                healthy={report.healthyCount}
                diseases={report.breakdown}
                total={report.totalScans}
                trackColor={themeColors.surface}
              />

              <View style={styles.legend}>
                <LegendDot
                  color={GREEN_HEALTHY}
                  label="Healthy"
                  count={report.healthyCount}
                  textColor={themeColors.text}
                />
                {report.breakdown.map((b, i) => (
                  <LegendDot
                    key={b.code}
                    color={DISEASE_PALETTE[i % DISEASE_PALETTE.length]}
                    label={b.name}
                    count={b.count}
                    textColor={themeColors.text}
                  />
                ))}
              </View>

              {comparison && (
                <View style={[styles.trendRow, { borderTopColor: themeColors.border }]}>
                  <View
                    style={[
                      styles.trendIcon,
                      {
                        backgroundColor: withAlpha(
                          comparison.diff > 0
                            ? themeColors.primary
                            : comparison.diff < 0
                            ? GREEN_HEALTHY
                            : themeColors.textSecondary,
                          0.14
                        ),
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        comparison.diff > 0
                          ? 'trending-up'
                          : comparison.diff < 0
                          ? 'trending-down'
                          : 'remove'
                      }
                      size={15}
                      color={
                        comparison.diff > 0
                          ? themeColors.primary
                          : comparison.diff < 0
                          ? GREEN_HEALTHY
                          : themeColors.textSecondary
                      }
                    />
                  </View>
                  <Text style={[styles.trendText, { color: themeColors.textSecondary }]}>
                    {comparison.text}
                  </Text>
                </View>
              )}
            </View>

            <RollingTrendCard rolling={rolling} themeColors={themeColors} />

            {headline && (
              <View
                style={[
                  styles.headlineCard,
                  {
                    backgroundColor: withAlpha(themeColors.primary, 0.08),
                    borderLeftColor: themeColors.primary,
                  },
                ]}
              >
                <Text style={[styles.headlineTitle, { color: themeColors.text }]}>
                  {headline.title}
                </Text>
                <Text style={[styles.headlineBody, { color: themeColors.text }]}>
                  {headline.body}
                </Text>
              </View>
            )}

            <Checklist items={checklist} themeColors={themeColors} />

            {report.breakdown.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    What your plants faced
                  </Text>
                </View>

                {report.breakdown.map((b, i) => {
                  const scansForDisease = scansByCode[b.code] || [];
                  return (
                    <DiseaseCard
                      key={`${range}-${b.code}`}
                      item={b}
                      color={DISEASE_PALETTE[i % DISEASE_PALETTE.length]}
                      percent={Math.round((b.count / report.totalScans) * 100)}
                      defaultOpen={false}
                      themeColors={themeColors}
                      scans={scansForDisease}
                      onViewScans={openScansModal}
                    />
                  );
                })}
              </View>
            ) : (
              <View
                style={[styles.goodCard, { backgroundColor: withAlpha(GREEN_HEALTHY, 0.1) }]}
              >
                <Ionicons name="checkmark-circle" size={30} color={GREEN_HEALTHY} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.goodTitle, { color: themeColors.text }]}>
                    No diseases detected
                  </Text>
                  <Text style={[styles.goodBody, { color: themeColors.textSecondary }]}>
                    Keep up your current routine and keep scanning regularly.
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <DiseaseScansModal
        visible={scansModal.visible}
        item={scansModal.item}
        scans={scansModal.scans}
        onClose={closeScansModal}
        onOpenScan={openScanDetail}
        themeColors={themeColors}
      />
    </SafeAreaView>
  );
};

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}),
  },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rangeBar: {
    flexDirection: 'row',
    borderRadius: rounded.full,
    padding: 4,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  rangeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderRadius: rounded.full,
  },
  rangeText: { fontSize: 13, fontWeight: '700' },

  scrollContent: { padding: spacing.md, paddingBottom: 110 },

  hero: {
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroLine: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: rounded.full,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.sm,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  legendCount: { fontSize: 13, fontWeight: '800', marginLeft: 2 },

  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trendIcon: {
    width: 26,
    height: 26,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendText: { fontSize: 12.5, lineHeight: 18, flex: 1 },

  rollingCard: {
    borderWidth: 1,
    borderRadius: rounded.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rollingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  rollingTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rollingDriver: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 8,
    fontWeight: '600',
  },
  rollingBody: { fontSize: 13.5, lineHeight: 20, fontWeight: '500' },

  headlineCard: {
    borderLeftWidth: 4,
    borderRadius: rounded.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  headlineTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  headlineBody: { fontSize: 13.5, lineHeight: 20 },

  checklistCard: {
    borderWidth: 1,
    borderRadius: rounded.md,
    overflow: 'hidden',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  checklistNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checklistNumberText: { fontSize: 12, fontWeight: '800' },
  checklistLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  checklistLabel: { fontSize: 14.5, fontWeight: '700', flex: 1, lineHeight: 19 },
  checklistDetail: { fontSize: 13, lineHeight: 19 },

  section: { marginBottom: spacing.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

  diseaseCard: {
    borderWidth: 1,
    borderRadius: rounded.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  diseaseAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  diseaseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingLeft: spacing.md + 5,
    paddingRight: spacing.md,
    minHeight: 62,
  },
  diseaseName: { fontSize: 15.5, fontWeight: '700', lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: rounded.full,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11.5, fontWeight: '600' },

  diseaseCountCol: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
    minWidth: 48,
  },
  diseaseCountNum: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  diseaseCountSub: { fontSize: 11, marginTop: 1, fontWeight: '600' },

  adviceWrap: {
    paddingLeft: spacing.md + 5,
    paddingRight: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  adviceBlock: { borderRadius: rounded.sm, padding: spacing.md },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  adviceLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  adviceText: { fontSize: 13.5, lineHeight: 20 },

  viewScansBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: rounded.sm,
    marginTop: 4,
  },
  viewScansText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  scansOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  scansSheet: {
    borderTopLeftRadius: rounded.lg,
    borderTopRightRadius: rounded.lg,
    padding: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '85%',
    minHeight: '50%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCC',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  scansHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  scansTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  scansSub: { fontSize: 13, marginTop: 2 },
  scansCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scansList: { paddingBottom: spacing.md },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  scanThumb: {
    width: 52,
    height: 52,
    borderRadius: rounded.sm,
  },
  scanRowTitle: { fontSize: 14.5, fontWeight: '700' },
  scanRowSub: { fontSize: 12, marginTop: 2 },

  goodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: rounded.md,
    padding: spacing.md,
  },
  goodTitle: { fontSize: 15, fontWeight: '700' },
  goodBody: { fontSize: 13, lineHeight: 19, marginTop: 2 },

  emptyWrap: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    borderRadius: rounded.full,
    marginTop: spacing.lg,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '700' },
});

export default AnalyticsScreen;