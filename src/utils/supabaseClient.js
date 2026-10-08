import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';


const SecureStoreAdapter = {
  getItem: async (key) => {
    try {
      const chunkKeys = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunkKeys) {
        const keys = JSON.parse(chunkKeys);
        const values = await Promise.all(
          keys.map(k => SecureStore.getItemAsync(k))
        );
        return values.join('');
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore getItem error:', error);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      if (value.length > 1900) {
        const chunks = value.match(/.{1,1900}/g) || [];
        const chunkKeys = [];
        
        for (let i = 0; i < chunks.length; i++) {
          const chunkKey = `${key}_part_${i}`;
          await SecureStore.setItemAsync(chunkKey, chunks[i]);
          chunkKeys.push(chunkKey);
        }
        
        await SecureStore.setItemAsync(`${key}_chunks`, JSON.stringify(chunkKeys));
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },
  removeItem: async (key) => {
    try {
      const chunkKeys = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunkKeys) {
        const keys = JSON.parse(chunkKeys);
        await Promise.all(keys.map(k => SecureStore.deleteItemAsync(k)));
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
    }
  },
};

// Read from app.json extra section
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration in app.json');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
