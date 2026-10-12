import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const FAB_SIZE = 64;

export default function CustomTabBar({ state, navigation, descriptors }) {
  const { themeColors } = useTheme();

  const routeConfig = {
    Home: { icon: 'home-outline', activeIcon: 'home', label: 'Home' },
    Chatbot: { icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses', label: 'Ask AI' },
    Scanner: { icon: 'scan-outline', activeIcon: 'scan', label: 'Scan Leaves', isCenter: true },
    History: { icon: 'time-outline', activeIcon: 'time', label: 'Scan History' },
    Analytics: { icon: 'analytics-outline', activeIcon: 'analytics', label: 'Analytics' },
  };

  const currentRoute = state.routes[state.index];
  const { options } = descriptors[currentRoute.key];

  if (options?.tabBarStyle?.display === 'none') return null;

  const nestedState = currentRoute.state;
  const activeNestedRouteName = nestedState?.routes[nestedState.index]?.name;

  if (currentRoute.name === 'Scanner' && (activeNestedRouteName === 'Scanner' || activeNestedRouteName === 'Result')) {
    return null;
  }

  return (
    <View style={styles.shadowWrapper}>
      <View style={[styles.container, { backgroundColor: themeColors.card }]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = routeConfig[route.name];

          if (!config) return null;

          const activeColor = themeColors.primary;
          const inactiveColor = themeColors.textSecondary;

          if (config.isCenter) {
            return (
              <View key={route.key} style={styles.fabSlot}>
                <TouchableOpacity
                  style={[
                    styles.fabButton,
                    {
                      backgroundColor: themeColors.primary,
                      borderColor: themeColors.card,
                    },
                  ]}
                  onPress={() => navigation.navigate(route.name)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={isFocused ? config.activeIcon : config.icon}
                    size={28}
                    color={themeColors['on-primary']}
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.fabLabel,
                    { color: isFocused ? activeColor : inactiveColor },
                  ]}
                >
                  {config.label}
                </Text>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItem}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isFocused ? config.activeIcon : config.icon}
                size={24}
                color={isFocused ? activeColor : inactiveColor}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? activeColor : inactiveColor },
                  isFocused && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 12,
  },
  container: {
    flexDirection: 'row',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 5 : 5,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    top: -(FAB_SIZE / 2 - 8),
  },
  fabButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
  fabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 4,
    textAlign: 'center',
  },
});