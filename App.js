import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;
import React, { useState, useEffect } from 'react';
import { NavigationContainer, CommonActions, createNavigationContainerRef, DefaultTheme as NavDefaultTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, AppState } from 'react-native';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './src/utils/supabaseClient';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import MainTabs from './src/navigation/MainTabs';
import ScannerScreen from './src/screens/ScannerScreen';
import ResultScreen from './src/screens/ResultScreen';
import MaintenanceScreen from './src/screens/MaintenanceScreen';
import ReactivateAccountScreen from './src/screens/ReactivateAccountScreen';
import CompleteProfileScreen from './src/screens/CompleteProfileScreen';   // NEW
import { fetchMaintenance, DEFAULT_MAINTENANCE } from './src/utils/appConfig';

import { loadOfflineModel } from './src/utils/offlineInference';
import { flushQueue } from './src/utils/syncManager';
import { fetchAccountStatus } from './src/utils/accountStatus';
import { fetchProfileStatus } from './src/utils/profileStatus';            // NEW

const Stack = createStackNavigator();

const MAINTENANCE_POLL_MS = 30 * 1000;
const SUSPENSION_POLL_MS = 60 * 1000;

const navigationRef = createNavigationContainerRef();

const AppNavigator = () => {
  const { themeColors, isDarkMode, isLoading: themeLoading } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [maintenance, setMaintenance] = useState(DEFAULT_MAINTENANCE);
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);       // NEW

  const refreshMaintenance = React.useCallback(async () => {
    const next = await fetchMaintenance();
    setMaintenance(next);
    setMaintenanceChecked(true);
  }, []);

  useEffect(() => {
    refreshMaintenance();
    const interval = setInterval(refreshMaintenance, MAINTENANCE_POLL_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refreshMaintenance();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refreshMaintenance]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session check error:', error);
          setIsAuthenticated(false);
          setNeedsProfileSetup(false);
        } else {
          setIsAuthenticated(!!session);
          // NEW: check profile completeness on boot
          if (session?.user?.id) {
            const profileStatus = await fetchProfileStatus(session.user.id);
            setNeedsProfileSetup(profileStatus !== 'complete');
          } else {
            setNeedsProfileSetup(false);
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
        setIsAuthenticated(false);
        setNeedsProfileSetup(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      setIsAuthenticated(!!session);

      // NEW: recompute profile gate whenever auth state changes
      if (session?.user?.id) {
        const profileStatus = await fetchProfileStatus(session.user.id);
        setNeedsProfileSetup(profileStatus !== 'complete');
      } else {
        setNeedsProfileSetup(false);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const enforceSuspension = React.useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const route = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null;
      if (route === 'Login' || route === 'Onboarding') return;

      const status = await fetchAccountStatus(session.user.id);
      if (status !== 'suspended') return;

      await supabase.auth.signOut().catch(() => {});
      setIsAuthenticated(false);
      if (navigationRef.isReady()) {
        navigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'Login', params: { suspended: true } }] })
        );
      }
    } catch (e) {
      console.warn('Suspension check failed:', e?.message);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    enforceSuspension();
    const interval = setInterval(enforceSuspension, SUSPENSION_POLL_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') enforceSuspension();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isAuthenticated, enforceSuspension]);

  useEffect(() => {
    loadOfflineModel()
      .then(() => console.log('Offline TFLite model ready'))
      .catch((err) => console.warn(' Offline model not loaded:', err?.message));
  }, []);

  useEffect(() => {
    let wasConnected = false;

    const unsub = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected && state.isInternetReachable !== false;

      if (connected && !wasConnected) {
        console.log(' Back online — attempting queue flush');
        flushQueue()
          .then((res) => {
            if (res?.flushed > 0) console.log(' Flushed queued scans:', res);
          })
          .catch((e) => console.warn('Queue flush failed:', e?.message));
      }
      wasConnected = connected;
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const flush = () =>
      flushQueue().catch((e) => console.warn('Queue flush failed:', e?.message));

    flush();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') flush();
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  if (isLoading || themeLoading || !maintenanceChecked) {
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

  if (maintenance.enabled) {
    return (
      <MaintenanceScreen
        message={maintenance.message}
        eta={maintenance.eta}
        onRetry={refreshMaintenance}
      />
    );
  }

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

  // NEW: three-way initial route
  const initialRoute = !isAuthenticated
    ? 'Onboarding'
    : needsProfileSetup
      ? 'CompleteProfile'
      : 'MainTabs';

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Scanner" component={ScannerScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
        <Stack.Screen name="ReactivateAccount" component={ReactivateAccountScreen} />
        <Stack.Screen
          name="CompleteProfile"
          component={CompleteProfileScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppNavigator />
      <Toast />
    </ThemeProvider>
  );
};

export default App;