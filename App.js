// App.js
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme as NavDefaultTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';

import { supabase } from './src/utils/supabaseClient';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MainTabs from './src/navigation/MainTabs';
import ScannerScreen from './src/screens/ScannerScreen';
import ResultScreen from './src/screens/ResultScreen';

import { loadOfflineModel } from './src/utils/offlineInference';
import { flushQueue } from './src/utils/syncManager';

const Stack = createStackNavigator();

// ============================================
// INNER APP — lives inside ThemeProvider
// so it can use useTheme() to theme navigation
// ============================================
const AppNavigator = () => {
  const { themeColors, isDarkMode, isLoading: themeLoading } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ===== Auth session =====
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session check error:', error);
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(!!session);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      setIsAuthenticated(!!session);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // ===== Preload offline TFLite model (non-blocking) =====
  useEffect(() => {
    loadOfflineModel()
      .then(() => console.log('✅ Offline TFLite model ready'))
      .catch((err) => console.warn('⚠️ Offline model not loaded:', err?.message));
  }, []);

  // ===== Auto-flush sync queue on reconnect =====
  useEffect(() => {
    let wasConnected = false;

    const unsub = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected && state.isInternetReachable !== false;

      if (connected && !wasConnected) {
        console.log('🌐 Back online — attempting queue flush');
        flushQueue()
          .then((res) => {
            if (res?.flushed > 0) console.log('✅ Flushed queued scans:', res);
          })
          .catch((e) => console.warn('Queue flush failed:', e?.message));
      }
      wasConnected = connected;
    });

    return () => unsub();
  }, []);

  // ===== Loading screen =====
  if (isLoading || themeLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: themeColors.background,
        }}
      >
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  // ===== Navigation theme (affects default screen bg, card bg, etc.) =====
  const navigationTheme = {
    ...(isDarkMode ? NavDarkTheme : NavDefaultTheme),
    colors: {
      ...(isDarkMode ? NavDarkTheme.colors : NavDefaultTheme.colors),
      background: themeColors.background,
      card: themeColors.card,
      text: themeColors.text,
      border: themeColors.border,
      primary: themeColors.primary,
      notification: themeColors.error,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={isAuthenticated ? 'MainTabs' : 'Onboarding'}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Scanner" component={ScannerScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// ============================================
// ROOT APP — wraps everything in ThemeProvider
// ============================================
const App = () => {
  return (
    <ThemeProvider>
      <AppNavigator />
      <Toast />
    </ThemeProvider>
  );
};

export default App;