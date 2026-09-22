// context/ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const lightColors = {
  // ===== MATERIAL DESIGN TOKENS =====
  surface: '#FFF8F6',
  'surface-dim': '#FBD1C4',
  'surface-container': '#FFE9E3',
  'surface-container-low': '#FFF1ED',
  'surface-container-high': '#FFE2DA',
  'surface-container-highest': '#FFDBD0',
  'surface-container-lowest': '#FFFFFF',
  'on-surface': '#2C160E',
  'on-surface-variant': '#40493D',
  outline: '#707A6C',
  'outline-variant': '#BFCABA',
  primary: '#0D631B',
  'on-primary': '#FFFFFF',
  'primary-container': '#2E7D32',
  'on-primary-container': '#CBFFC2',
  'primary-fixed': '#A3F69C',
  'primary-fixed-dim': '#88D982',
  secondary: '#7A5649',
  'on-secondary': '#FFFFFF',
  'secondary-container': '#FDCDBC',
  'on-secondary-container': '#795548',
  tertiary: '#774C00',
  'tertiary-container': '#986200',
  'on-tertiary-container': '#FFEEDE',
  error: '#BA1A1A',
  'on-error': '#FFFFFF',
  'error-container': '#FFDAD6',
  'on-error-container': '#93000A',
  background: '#FFF8F6',
  'on-background': '#2C160E',
  'surface-variant': '#FFDBD0',
  'surface-tint': '#1B6D24',

  // ===== APP-SPECIFIC ALIASES (FIX) =====
  text: '#2C160E',            // white-on-dark in dark mode
  textSecondary: '#40493D',   // muted text
  border: '#BFCABA',          // divider color
  card: '#FFFFFF',            // card surface
  accent: '#0D631B',          // brand accent
};

const darkColors = {
  // ===== MATERIAL DESIGN TOKENS =====
  surface: '#1A1A1A',
  'surface-dim': '#121212',
  'surface-container': '#2C2C2C',
  'surface-container-low': '#242424',
  'surface-container-high': '#383838',
  'surface-container-highest': '#444444',
  'surface-container-lowest': '#1E1E1E',
  'on-surface': '#FFFFFF',
  'on-surface-variant': '#B0B0B0',
  outline: '#888888',
  'outline-variant': '#444444',
  primary: '#88D982',
  'on-primary': '#00390A',
  'primary-container': '#0D631B',
  'on-primary-container': '#CBFFC2',
  'primary-fixed': '#A3F69C',
  'primary-fixed-dim': '#88D982',
  secondary: '#E0BBAA',
  'on-secondary': '#442A20',
  'secondary-container': '#5D4037',
  'on-secondary-container': '#FDCDBC',
  tertiary: '#FFB74D',
  'tertiary-container': '#5D4037',
  'on-tertiary-container': '#FFEEDE',
  error: '#FFB4AB',
  'on-error': '#690005',
  'error-container': '#93000A',
  'on-error-container': '#FFDAD6',
  background: '#121212',
  'on-background': '#FFFFFF',
  'surface-variant': '#444444',
  'surface-tint': '#88D982',

  // ===== APP-SPECIFIC ALIASES (FIX) =====
  text: '#FFFFFF',            // ✅ NOW WHITE in dark mode
  textSecondary: '#B0B0B0',   // ✅ muted light grey
  border: '#444444',          // ✅ dark border
  card: '#1E1E1E',            // ✅ dark card
  accent: '#88D982',          // ✅ bright green accent
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@theme_preference');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        } else {
          setIsDarkMode(systemColorScheme === 'dark');
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadTheme();
  }, [systemColorScheme]);

  const toggleDarkMode = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem('@theme_preference', newMode ? 'dark' : 'light');
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  };

  const themeColors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, themeColors, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};