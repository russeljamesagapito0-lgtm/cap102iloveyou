// src/screens/HomeScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  Animated,
  RefreshControl,
  Platform,
  Modal,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../utils/supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { markAllNotificationsRead } from '../utils/notifications';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const weatherImage = require('../assets/weather.png');
const backgroundImage = require('../assets/screen.png');
const alertsImage = require('../assets/alerts.png');
const logoImage = require('../assets/logo.png');

const fertilizerTips = [
  { id: '1', title: 'Apply NPK 15-15-15', description: 'Broadcast evenly around the base of each plant, 5cm away from the stem.', timing: 'Best in early morning or late afternoon' },
  { id: '2', title: 'Organic Compost', description: 'Mix well-decomposed compost into the topsoil to improve fertility.', timing: 'Apply every 4-6 weeks' },
  { id: '3', title: 'Foliar Spray', description: 'Use liquid fertilizer for quick nutrient absorption during growth.', timing: 'Apply during active growth stage' },
];

const cropCareTips = [
  { id: '1', icon: 'water-outline', title: 'Watering', description: 'Water deeply 2-3 times per week.' },
  { id: '2', icon: 'leaf-outline', title: 'Weeding', description: 'Remove weeds weekly to reduce competition.' },
  { id: '3', icon: 'bug-outline', title: 'Pest Control', description: 'Inspect leaves for pests every 3 days.' },
  { id: '4', icon: 'cut-outline', title: 'Pruning', description: 'Remove dead or diseased leaves promptly.' },
];

// ============ TIME HELPERS ============
const timeAgo = (dateString) => {
  if (!dateString) return '';
  const then = new Date(dateString).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`;
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ============ WEATHER HELPERS ============
const mapWeatherCode = (code) => {
  if (code === 0) return { label: 'Clear', icon: 'sunny', condition: 'Clear' };
  if (code === 1 || code === 2) return { label: 'Partly Cloudy', icon: 'partly-sunny', condition: 'Clouds' };
  if (code === 3) return { label: 'Cloudy', icon: 'cloudy', condition: 'Clouds' };
  if (code === 45 || code === 48) return { label: 'Foggy', icon: 'cloud-outline', condition: 'Fog' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rainy-outline', condition: 'Drizzle' };
  if (code >= 61 && code <= 67) return { label: 'Rainy', icon: 'rainy', condition: 'Rain' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'snow', condition: 'Snow' };
  if (code >= 80 && code <= 82) return { label: 'Rain Showers', icon: 'rainy', condition: 'Rain' };
  if (code >= 95 && code <= 99) return { label: 'Thunderstorm', icon: 'thunderstorm', condition: 'Thunderstorm' };
  return { label: 'Unknown', icon: 'cloud-outline', condition: 'Unknown' };
};

const fetchWeatherData = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const loc = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = loc.coords;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
    `&timezone=auto&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();

  const current = data.current;
  const currentMapped = mapWeatherCode(current.weather_code);

  const dailyForecast = data.daily.time.map((date, i) => {
    const dayMapped = mapWeatherCode(data.daily.weather_code[i]);
    return {
      date,
      tempMax: Math.round(data.daily.temperature_2m_max[i]),
      tempMin: Math.round(data.daily.temperature_2m_min[i]),
      rain: data.daily.precipitation_sum[i] || 0,
      rainChance: data.daily.precipitation_probability_max[i] || 0,
      condition: dayMapped.condition,
      icon: dayMapped.icon,
      label: dayMapped.label,
    };
  });

  return {
    current: {
      temp: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: Math.round(current.relative_humidity_2m),
      condition: currentMapped.condition,
      icon: currentMapped.icon,
      label: currentMapped.label,
    },
    forecast: dailyForecast,
  };
};

const buildGoodPlantingDays = (forecast) => {
  if (!forecast) return {};
  const map = {};
  forecast.forEach((day) => {
    const good = day.rain >= 1 && day.rain <= 15 && day.tempMax >= 18 && day.tempMax <= 32 && day.rainChance < 80;
    map[day.date] = good;
  });
  return map;
};

const buildAlertsFromForecast = (forecast) => {
  if (!forecast || forecast.length === 0) return [];
  const alerts = [];
  const heavyRain = forecast.find((d) => d.rain >= 15);
  if (heavyRain) alerts.push({ id: 'heavy-rain', icon: 'rainy', title: 'Heavy Rain Expected', description: `Up to ${heavyRain.rain.toFixed(1)}mm expected on ${heavyRain.date}. Delay fertilizer application.`, time: 'Today' });
  const drySpell = forecast.slice(0, 4).every((d) => d.rain < 0.5);
  if (drySpell) alerts.push({ id: 'dry-spell', icon: 'sunny', title: 'Dry Days Ahead', description: 'Little to no rainfall expected over the next 4 days. Water your crops regularly.', time: 'Today' });
  const perfect = forecast.slice(0, 3).filter((d) => d.rain >= 1 && d.rain <= 10 && d.tempMax >= 18 && d.tempMax <= 32);
  if (perfect.length >= 2) alerts.push({ id: 'perfect', icon: 'sunny', title: 'Perfect Conditions', description: `Ideal for planting over the next ${perfect.length} days. Great time to sow.`, time: 'Today' });
  if (alerts.length === 0) alerts.push({ id: 'stable', icon: 'sunny', title: 'Stable Weather', description: 'No significant weather events expected in the next few days.', time: 'Today' });
  return alerts;
};

// ============ WEATHER ALERT MODAL ============
const WeatherAlertModal = ({ visible, onClose, weather, loading, forecast }) => {
  const { themeColors } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const goodPlantingDays = buildGoodPlantingDays(forecast);
  const alerts = buildAlertsFromForecast(forecast);

  const changeMonth = (delta) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    else if (newMonth > 11) { newMonth = 0; newYear += 1; }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const renderCalendar = () => {
    const today = new Date();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    const days = [];

    for (let i = 0; i < firstDayOfWeek; i++) days.push(<View key={`empty-${i}`} style={styles.calendarDayEmpty} />);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(currentYear, currentMonth, day);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
      const isGoodDay = goodPlantingDays[dateStr] === true;
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      days.push(
        <View key={day} style={[styles.calendarDay, isToday && styles.calendarDayToday, !isToday && isGoodDay && styles.calendarDayGood]}>
          <Text style={[styles.calendarDayText, { color: themeColors.text }, isToday && styles.calendarDayTextToday, !isToday && isGoodDay && styles.calendarDayTextGood, !isToday && !isGoodDay && isWeekend && styles.calendarDayTextWeekend]}>
            {day}
          </Text>
          {isGoodDay && !isToday && <View style={styles.calendarDot} />}
        </View>
      );
    }
    return days;
  };

  const currentWeatherIcon = weather?.icon || 'sunny';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="cloud-outline" size={24} color={themeColors.primary} />
              <Text style={[styles.modalHeaderTitle, { color: themeColors.text }]}>Weather & Farming</Text>
            </View>
            <TouchableOpacity style={[styles.modalCloseButton, { backgroundColor: themeColors.surface }]} onPress={onClose}>
              <Ionicons name="close" size={20} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.weatherSummary, { backgroundColor: themeColors.card }]}>
              <View style={styles.weatherSummaryLeft}>
                {loading ? <ActivityIndicator size="large" color={themeColors.primary} /> : <Ionicons name={currentWeatherIcon} size={40} color="#F59E0B" />}
                <View>
                  <Text style={[styles.weatherSummaryTemp, { color: themeColors.text }]}>{loading ? '—' : `${weather?.temp ?? '—'}°C`}</Text>
                  <Text style={[styles.weatherSummaryDesc, { color: themeColors.textSecondary }]}>
                    {loading ? 'Loading current weather...' : `${weather?.label ?? 'Unknown'} • Feels like ${weather?.feelsLike ?? '—'}°C`}
                  </Text>
                </View>
              </View>
              <View style={styles.weatherSummaryRight}>
                <Text style={[styles.weatherSummaryLabel, { color: themeColors.textSecondary }]}>Humidity</Text>
                <Text style={[styles.weatherSummaryValue, { color: themeColors.text }]}>{loading ? '—' : `${weather?.humidity ?? '—'}%`}</Text>
              </View>
            </View>

            <View style={[styles.calendarSection, { backgroundColor: themeColors.card }]}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={() => changeMonth(-1)}><Ionicons name="chevron-back" size={20} color={themeColors.text} /></TouchableOpacity>
                <Text style={[styles.calendarTitle, { color: themeColors.text }]}>{MONTHS[currentMonth]} {currentYear}</Text>
                <TouchableOpacity onPress={() => changeMonth(1)}><Ionicons name="chevron-forward" size={20} color={themeColors.text} /></TouchableOpacity>
              </View>
              <View style={styles.calendarGrid}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <View key={day} style={styles.calendarDayHeader}>
                    <Text style={[styles.calendarDayHeaderText, { color: themeColors.textSecondary }]}>{day}</Text>
                  </View>
                ))}
                {renderCalendar()}
              </View>
              <View style={[styles.calendarLegend, { borderTopColor: themeColors.border }]}>
                <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendGood]} /><Text style={[styles.legendText, { color: themeColors.textSecondary }]}>Good Planting Day</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendToday]} /><Text style={[styles.legendText, { color: themeColors.textSecondary }]}>Today</Text></View>
              </View>
            </View>

            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}><Ionicons name="flask-outline" size={22} color={themeColors.primary} /><Text style={[styles.sectionTitle, { color: themeColors.text }]}>Fertilizer Application Tips</Text></View>
              {fertilizerTips.map((tip) => (
                <View key={tip.id} style={[styles.tipCard, { backgroundColor: themeColors.card }]}>
                  <Text style={[styles.tipTitle, { color: themeColors.text }]}>{tip.title}</Text>
                  <Text style={[styles.tipDescription, { color: themeColors.textSecondary }]}>{tip.description}</Text>
                  <View style={styles.tipTiming}><Ionicons name="time-outline" size={14} color="#F59E0B" /><Text style={styles.tipTimingText}>{tip.timing}</Text></View>
                </View>
              ))}
            </View>

            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}><Ionicons name="leaf-outline" size={22} color={themeColors.primary} /><Text style={[styles.sectionTitle, { color: themeColors.text }]}>Root Crop Care Guide</Text></View>
              <View style={styles.careGrid}>
                {cropCareTips.map((tip) => (
                  <View key={tip.id} style={[styles.careCard, { backgroundColor: themeColors.card }]}>
                    <View style={styles.careIconContainer}><Ionicons name={tip.icon} size={24} color={themeColors.primary} /></View>
                    <Text style={[styles.careTitle, { color: themeColors.text }]}>{tip.title}</Text>
                    <Text style={[styles.careDescription, { color: themeColors.textSecondary }]}>{tip.description}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}><Ionicons name="warning-outline" size={22} color="#F97316" /><Text style={[styles.sectionTitle, { color: themeColors.text }]}>Weather Alerts</Text></View>
              {alerts.map((alert) => (
                <View key={alert.id} style={[styles.alertItem, { backgroundColor: themeColors.card }]}>
                  <View style={[styles.alertIconContainer, { backgroundColor: isDarkModeSafe(themeColors) ? 'rgba(136,217,130,0.15)' : 'rgba(13,99,27,0.1)' }]}>
                    <Ionicons name={alert.icon === 'rainy' ? 'rainy-outline' : 'sunny-outline'} size={24} color={themeColors.primary} />
                  </View>
                  <View style={styles.alertContent}>
                    <Text style={[styles.alertTitle, { color: themeColors.text }]}>{alert.title}</Text>
                    <Text style={[styles.alertDescription, { color: themeColors.textSecondary }]}>{alert.description}</Text>
                    <View style={styles.alertTime}><Ionicons name="time-outline" size={14} color={themeColors.textSecondary} /><Text style={[styles.alertTimeText, { color: themeColors.textSecondary }]}>{alert.time}</Text></View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const isDarkModeSafe = (colors) => colors.text === '#FFFFFF';

// ============ NOTIFICATION ICONS ============
const notificationIcon = (type) => {
  switch (type) {
    case 'profile_updated': return { name: 'person-circle-outline', color: '#0D631B' };
    case 'avatar_updated':  return { name: 'image-outline',         color: '#7A5649' };
    case 'password_changed':return { name: 'lock-closed-outline',   color: '#BA1A1A' };
    case 'scan_saved':      return { name: 'bookmark-outline',      color: '#0D631B' };
    default:                return { name: 'notifications-outline', color: '#707A6C' };
  }
};

// ============ NOTIFICATIONS MODAL ============
const NotificationsModal = ({ visible, onClose, items, loading, onMarkAllRead }) => {
  const { themeColors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.background, maxHeight: '85%' }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="notifications-outline" size={24} color={themeColors.primary} />
              <Text style={[styles.modalHeaderTitle, { color: themeColors.text }]}>Notifications</Text>
            </View>
            <TouchableOpacity style={[styles.modalCloseButton, { backgroundColor: themeColors.surface }]} onPress={onClose}>
              <Ionicons name="close" size={20} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {items.some((n) => !n.is_read) && (
            <TouchableOpacity onPress={onMarkAllRead} style={styles.markAllButton}>
              <Text style={[styles.markAllText, { color: themeColors.primary }]}>Mark all as read</Text>
            </TouchableOpacity>
          )}

          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={themeColors.primary} />
              </View>
            ) : items.length === 0 ? (
              <View style={{ paddingVertical: 60, alignItems: 'center', gap: 8 }}>
                <Ionicons name="notifications-off-outline" size={56} color={themeColors.border} />
                <Text style={[styles.emptyNotifTitle, { color: themeColors.text }]}>No notifications yet</Text>
                <Text style={[styles.emptyNotifSub, { color: themeColors.textSecondary }]}>
                  Updates about your profile and scans will show up here.
                </Text>
              </View>
            ) : (
              items.map((n) => {
                const ic = notificationIcon(n.type);
                return (
                  <View
                    key={n.id}
                    style={[
                      styles.notifItem,
                      { backgroundColor: n.is_read ? themeColors.surface : themeColors.card, borderColor: themeColors.border },
                    ]}
                  >
                    <View style={[styles.notifIconWrap, { backgroundColor: `${ic.color}22` }]}>
                      <Ionicons name={ic.name} size={20} color={ic.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.notifTitle, { color: themeColors.text }]} numberOfLines={1}>{n.title}</Text>
                      {!!n.body && (
                        <Text style={[styles.notifBody, { color: themeColors.textSecondary }]} numberOfLines={2}>{n.body}</Text>
                      )}
                      <Text style={[styles.notifTime, { color: themeColors.textSecondary }]}>{timeAgo(n.created_at)}</Text>
                    </View>
                    {!n.is_read && <View style={[styles.unreadDot, { backgroundColor: '#DC2626' }]} />}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============ HOME SCREEN ============
const HomeScreen = ({ navigation }) => {
  const { themeColors, isDarkMode } = useTheme();
  const scanScale = useRef(new Animated.Value(1)).current;
  const [weatherModalVisible, setWeatherModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);

  const [displayName, setDisplayName] = useState('RootCare');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const [lastScan, setLastScan] = useState(null);
  const [savedScans, setSavedScans] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const goToHistory = useCallback(
    (initialTab) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      let target = null;
      let current = navigation;
      const currentRoutes = current.getState?.()?.routeNames || [];
      if (currentRoutes.includes('History')) {
        target = current;
      } else {
        let parent = current.getParent?.();
        while (parent) {
          const routes = parent.getState?.()?.routeNames || [];
          if (routes.includes('History')) { target = parent; break; }
          parent = parent.getParent?.();
        }
      }
      if (target) target.navigate('History', initialTab ? { initialTab } : undefined);
      else navigation.navigate('History', initialTab ? { initialTab } : undefined);
    },
    [navigation]
  );

  const loadWeather = useCallback(async () => {
    try {
      setWeatherLoading(true);
      const data = await fetchWeatherData();
      setWeather(data.current);
      setForecast(data.forecast);
    } catch (err) {
      console.warn('Weather unavailable:', err.message);
      setWeather(null);
      setForecast(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setNotifLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setNotifications([]);
        setNotifLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('Notifications load failed:', error.message);
        setNotifications([]);
      } else {
        setNotifications(data || []);
      }
    } catch (err) {
      console.warn('Notifications error:', err.message);
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const handleMarkAllRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsRead();
  };

  const loadRecentActivity = useCallback(async () => {
    try {
      setActivityLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setLastScan(null);
        setSavedScans([]);
        setActivityLoading(false);
        return;
      }

      const userId = session.user.id;

      const { data: lastData, error: lastError } = await supabase
        .from('scans')
        .select('id, crop_type, image_path, captured_at, created_at, is_saved, is_archived, is_deleted')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('captured_at', { ascending: false })
        .limit(1);

      if (lastError) {
        console.warn('Last scan fetch failed:', lastError.message);
        setLastScan(null);
      } else {
        setLastScan(lastData?.[0] || null);
      }

      const { data: savedData, error: savedError } = await supabase
        .from('scans')
        .select('id, crop_type, image_path, captured_at, created_at, is_saved, is_archived, is_deleted')
        .eq('user_id', userId)
        .eq('is_saved', true)
        .eq('is_archived', false)
        .eq('is_deleted', false)
        .order('captured_at', { ascending: false })
        .limit(3);

      if (savedError) {
        console.warn('Saved scans fetch failed:', savedError.message);
        setSavedScans([]);
      } else {
        setSavedScans(savedData || []);
      }
    } catch (err) {
      console.warn('Recent activity error:', err.message);
      setLastScan(null);
      setSavedScans([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setDisplayName('RootCare');
        setAvatarUrl(null);
        setProfileLoading(false);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        if (!userError.message.includes('Auth session missing')) {
          console.error('Error fetching user:', userError.message);
        }
        setDisplayName('RootCare');
        setAvatarUrl(null);
        setProfileLoading(false);
        return;
      }

      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name, first_name, last_name, avatar_url')
          .eq('id', user.id)
          .single();

        if (profileError) {
          setDisplayName('RootCare');
          setAvatarUrl(null);
        } else if (profile) {
          const name =
            profile.display_name ||
            `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
            'RootCare';
          setDisplayName(name);
          setAvatarUrl(profile.avatar_url || null);
        } else {
          setDisplayName('RootCare');
          setAvatarUrl(null);
        }
      } else {
        setDisplayName('RootCare');
        setAvatarUrl(null);
      }
    } catch (error) {
      setDisplayName('RootCare');
      setAvatarUrl(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const startPulse = () => {
    Animated.sequence([
      Animated.timing(scanScale, { toValue: 1.02, duration: 1000, useNativeDriver: true }),
      Animated.timing(scanScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ]).start(() => startPulse());
  };

  useEffect(() => {
    startPulse();
    fetchUserProfile();
    loadWeather();
    loadNotifications();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        fetchUserProfile();
        loadRecentActivity();
        loadNotifications();
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [loadWeather, loadRecentActivity, loadNotifications]);

  // Reload profile + activity + notifications whenever Home gains focus
  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
      loadRecentActivity();
      loadNotifications();
    }, [loadRecentActivity, loadNotifications])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUserProfile(), loadWeather(), loadRecentActivity(), loadNotifications()]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(false);
  };

  const currentWeatherIcon = weather?.icon || 'sunny';
  const currentWeatherLabel = weather?.label || 'Sunny';
  const currentWeatherTemp = weather ? `${weather.temp}°C` : '28°C';

  const weatherAlertSummary = (() => {
    if (!forecast || forecast.length === 0) {
      return { title: 'Perfect Conditions', body: 'Ideal for fertilizer application today.' };
    }
    const heavyRain = forecast.find((d) => d.rain >= 15);
    if (heavyRain) {
      return { title: 'Heavy Rain Soon', body: 'Delay fertilizer application for a few days.' };
    }
    const drySpell = forecast.slice(0, 4).every((d) => d.rain < 0.5);
    if (drySpell) {
      return { title: 'Dry Days Ahead', body: 'Water your crops regularly this week.' };
    }
    return { title: 'Perfect Conditions', body: 'Ideal for fertilizer application today.' };
  })();

  const hasActivity = !!lastScan || savedScans.length > 0;
  const scanTime = (row) => row?.captured_at || row?.created_at;

  const avatarSource = avatarUrl ? { uri: avatarUrl } : logoImage;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: isDarkMode ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 248, 246, 0.95)',
            borderBottomColor: themeColors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Settings');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.avatarContainer, { backgroundColor: themeColors.primaryFixed || themeColors.primary }]}>
                <Image source={avatarSource} style={styles.avatar} resizeMode="cover" />
              </View>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.greetingText, { color: themeColors.textSecondary }]}>Welcome back</Text>
              <Text style={[styles.headerTitle, { color: themeColors.primary }]}>
                {profileLoading ? 'Loading...' : displayName}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setNotificationsModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={themeColors.primary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[themeColors.primary]}
            tintColor={themeColors.primary}
            title="Refreshing..."
            titleColor={themeColors.primary}
          />
        }
      >
        <View style={styles.greetingSection}>
          <View style={styles.greetingTextBlock}>
            <Text style={[styles.greetingTitle, { color: themeColors.text }]}>
              Good morning, {profileLoading ? 'Farmer' : displayName.split(' ')[0]}!
            </Text>
            <Text style={[styles.greetingSubtitle, { color: themeColors.textSecondary }]}>
              Your crops are thriving today.
            </Text>
          </View>

          <ImageBackground source={weatherImage} style={styles.weatherCard} imageStyle={styles.weatherCardImage} resizeMode="cover">
            <View style={styles.weatherCardOverlay}>
              {weatherLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name={currentWeatherIcon} size={20} color="#FFFFFF" />
                  <Text style={styles.weatherTemp}>{currentWeatherTemp}</Text>
                  <Text style={styles.weatherLabel}>{currentWeatherLabel}</Text>
                </>
              )}
            </View>
          </ImageBackground>
        </View>

        <Animated.View style={[styles.scanCard, { transform: [{ scale: scanScale }] }]}>
          <ImageBackground source={backgroundImage} style={styles.scanCardBackground} imageStyle={styles.scanCardImage} resizeMode="cover">
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate('Scanner');
              }}
              activeOpacity={0.9}
            >
              <View style={styles.scanCardContent}>
                <View style={styles.scanIconContainer}>
                  <Ionicons name="scan-outline" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.scanTextContainer}>
                  <Text style={styles.scanTitle}>Scan Your Crop</Text>
                  <Text style={styles.scanDescription}>
                    AI-powered disease detection for cassava & roots
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </ImageBackground>
        </Animated.View>

        <View style={styles.bentoGrid}>
          <TouchableOpacity
            style={styles.bentoCardWrapper}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setWeatherModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <ImageBackground source={alertsImage} style={[styles.bentoCard, styles.weatherAlertCard]} imageStyle={styles.bentoCardImage} resizeMode="cover">
              <View style={styles.weatherAlertOverlay}>
                <View style={styles.bentoCardHeader}>
                  <View style={styles.weatherAlertIconContainer}>
                    <Ionicons name="cloud-done-outline" size={18} color="#FFF8F6" />
                  </View>
                </View>
                <View style={styles.bentoCardFooter}>
                  <Text style={styles.weatherAlertLabel}>Weather Alerts</Text>
                  <Text style={styles.weatherAlertValue}>{weatherAlertSummary.title}</Text>
                  <Text style={styles.bentoDescription}>{weatherAlertSummary.body}</Text>
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Text style={[styles.activityTitle, { color: themeColors.text }]}>
              Recent Activity
            </Text>
            <TouchableOpacity onPress={() => goToHistory('recent')} activeOpacity={0.7}>
              <Text style={[styles.activityViewAll, { color: themeColors.primary }]}>
                View All
              </Text>
            </TouchableOpacity>
          </View>

          {activityLoading ? (
            <View style={styles.activityEmpty}>
              <ActivityIndicator size="small" color={themeColors.primary} />
            </View>
          ) : !hasActivity ? (
            <TouchableOpacity
              style={[styles.activityItem, { backgroundColor: themeColors.surface }]}
              onPress={() => goToHistory('recent')}
              activeOpacity={0.7}
            >
              <View style={[styles.activityIcon, styles.activityIconBeige]}>
                <Ionicons name="leaf-outline" size={20} color="#7A5649" />
              </View>
              <View style={styles.activityContent}>
                <Text style={[styles.activityItemTitle, { color: themeColors.text }]}>
                  No activity yet
                </Text>
                <Text style={[styles.activityItemSubtitle, { color: themeColors.textSecondary }]}>
                  Scan a crop to see your history here.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.activityList}>
              {lastScan && (
                <TouchableOpacity
                  style={[styles.activityItem, { backgroundColor: themeColors.surface }]}
                  onPress={() => goToHistory('recent')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.activityIcon, styles.activityIconGreen]}>
                    <Ionicons name="analytics-outline" size={20} color="#0D631B" />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityItemTitle, { color: themeColors.text }]} numberOfLines={1}>
                      Last Scan: {lastScan.crop_type || 'Cassava'}
                    </Text>
                    <Text style={[styles.activityItemSubtitle, { color: themeColors.textSecondary }]}>
                      {timeAgo(scanTime(lastScan))}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              )}

              {savedScans.map((scan) => (
                <TouchableOpacity
                  key={scan.id}
                  style={[styles.activityItem, { backgroundColor: themeColors.surface }]}
                  onPress={() => goToHistory('saved')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.activityIcon, styles.activityIconBeige]}>
                    <Ionicons name="bookmark" size={20} color="#7A5649" />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityItemTitle, { color: themeColors.text }]} numberOfLines={1}>
                      Saved: {scan.crop_type || 'Cassava'}
                    </Text>
                    <Text style={[styles.activityItemSubtitle, { color: themeColors.textSecondary }]}>
                      {timeAgo(scanTime(scan))}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <WeatherAlertModal
        visible={weatherModalVisible}
        onClose={() => setWeatherModalVisible(false)}
        weather={weather}
        forecast={forecast}
        loading={weatherLoading}
      />

      <NotificationsModal
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
        items={notifications}
        loading={notifLoading}
        onMarkAllRead={handleMarkAllRead}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}) },
  header: { width: '100%', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarContainer: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  headerTextContainer: { flexDirection: 'column' },
  greetingText: { fontSize: 10, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  notificationButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  badge: { position: 'absolute', top: -2, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF8F6' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 },
  greetingSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greetingTextBlock: { flex: 1, paddingRight: 10 },
  greetingTitle: { fontSize: 22, fontWeight: '700', marginBottom: 1 },
  greetingSubtitle: { fontSize: 13, fontWeight: '400' },
  weatherCard: { borderRadius: 14, overflow: 'hidden', minWidth: 64, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  weatherCardImage: { borderRadius: 14 },
  weatherCardOverlay: { backgroundColor: 'rgba(0, 0, 0, 0.35)', paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  weatherTemp: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  weatherLabel: { fontSize: 10, fontWeight: '500', color: 'rgba(255, 255, 255, 0.9)' },
  scanCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden', height: 110, shadowColor: '#0D631B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  scanCardBackground: { width: '100%', height: '100%' },
  scanCardImage: { borderRadius: 16 },
  scanButton: { backgroundColor: 'rgba(46, 125, 50, 0.85)', paddingVertical: 14, paddingHorizontal: 16, width: '100%', height: '100%', justifyContent: 'center' },
  scanCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scanIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  scanTextContainer: { flex: 1 },
  scanTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 1 },
  scanDescription: { fontSize: 11, fontWeight: '400', color: 'rgba(255, 255, 255, 0.85)' },
  bentoGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  bentoCardWrapper: { flex: 1, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  bentoCard: { flex: 1, minHeight: 110, justifyContent: 'center' },
  bentoCardImage: { borderRadius: 16 },
  weatherAlertOverlay: { flex: 1, padding: 14, justifyContent: 'space-between', backgroundColor: 'rgba(152, 98, 0, 0.75)' },
  weatherAlertCard: { backgroundColor: 'transparent' },
  bentoCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weatherAlertIconContainer: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255, 248, 246, 0.2)', justifyContent: 'center', alignItems: 'center' },
  bentoCardFooter: { gap: 1 },
  weatherAlertLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255, 248, 246, 0.85)' },
  weatherAlertValue: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  bentoDescription: { fontSize: 11, fontWeight: '400', color: 'rgba(255, 255, 255, 0.85)' },
  activitySection: { marginBottom: 16 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activityTitle: { fontSize: 16, fontWeight: '600' },
  activityViewAll: { fontSize: 12, fontWeight: '600' },
  activityList: { gap: 10 },
  activityEmpty: { paddingVertical: 20, alignItems: 'center' },
  activityItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, gap: 14 },
  activityIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  activityIconGreen: { backgroundColor: '#A3F69C' },
  activityIconBeige: { backgroundColor: '#FFDBCF' },
  activityContent: { flex: 1 },
  activityItemTitle: { fontSize: 13, fontWeight: '600' },
  activityItemSubtitle: { fontSize: 11, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%', minHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalHeaderTitle: { fontSize: 20, fontWeight: '600' },
  modalCloseButton: { padding: 4, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalScrollContent: { paddingBottom: 20 },
  markAllButton: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8, marginBottom: 8 },
  markAllText: { fontSize: 13, fontWeight: '600' },
  emptyNotifTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  emptyNotifSub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  notifItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1 },
  notifIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '600' },
  notifBody: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  notifTime: { fontSize: 11, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  weatherSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 16 },
  weatherSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weatherSummaryTemp: { fontSize: 24, fontWeight: '700' },
  weatherSummaryDesc: { fontSize: 14, fontWeight: '400' },
  weatherSummaryRight: { alignItems: 'center' },
  weatherSummaryLabel: { fontSize: 12, fontWeight: '400' },
  weatherSummaryValue: { fontSize: 16, fontWeight: '600' },
  calendarSection: { borderRadius: 16, padding: 16, marginBottom: 16 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calendarTitle: { fontSize: 16, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayHeader: { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
  calendarDayHeaderText: { fontSize: 11, fontWeight: '600' },
  calendarDay: { width: '14.28%', alignItems: 'center', paddingVertical: 6, borderRadius: 20, position: 'relative' },
  calendarDayEmpty: { width: '14.28%', paddingVertical: 6 },
  calendarDayToday: { backgroundColor: '#0D631B' },
  calendarDayGood: { backgroundColor: 'rgba(13, 99, 27, 0.1)' },
  calendarDayText: { fontSize: 13, fontWeight: '500' },
  calendarDayTextToday: { color: '#FFFFFF', fontWeight: '700' },
  calendarDayTextWeekend: { color: '#DC2626' },
  calendarDayTextGood: { color: '#0D631B', fontWeight: '600' },
  calendarDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#0D631B', position: 'absolute', bottom: 0 },
  calendarLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendGood: { backgroundColor: 'rgba(13, 99, 27, 0.3)' },
  legendToday: { backgroundColor: '#0D631B' },
  legendText: { fontSize: 11 },
  sectionContainer: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  tipCard: { borderRadius: 12, padding: 14, marginBottom: 8 },
  tipTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  tipDescription: { fontSize: 13, marginBottom: 6, lineHeight: 18 },
  tipTiming: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tipTimingText: { fontSize: 11, color: '#F59E0B', fontWeight: '500' },
  careGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  careCard: { borderRadius: 12, padding: 14, width: '48%' },
  careIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(13, 99, 27, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  careTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  careDescription: { fontSize: 11, lineHeight: 16 },
  alertItem: { flexDirection: 'row', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  alertIconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  alertDescription: { fontSize: 13, marginBottom: 4 },
  alertTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  alertTimeText: { fontSize: 11 },
});

export default HomeScreen;