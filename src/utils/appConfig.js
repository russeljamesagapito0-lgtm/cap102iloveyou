import { supabase } from './supabaseClient';

// Mirrors admin/src/lib/appSettings.js
export const DEFAULT_MAINTENANCE = { enabled: false, message: '', eta: null };
export const DEFAULT_MODEL_ID = 'convnext_384';

const fetchSetting = async (key) => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
};

/**
 * Returns { enabled, message, eta }.
 * Fails OPEN: if the request fails (offline, Supabase down, table missing)
 * the app is treated as NOT in maintenance, so offline scanning keeps working.
 */
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

export const fetchMaintenance = async () => {
  try {
    const value = await withTimeout(fetchSetting('maintenance'), 6000);
    return { ...DEFAULT_MAINTENANCE, ...(value || {}) };
  } catch (e) {
    console.warn('Maintenance check failed (treating as live):', e?.message);
    return DEFAULT_MAINTENANCE;
  }
};

/** Which model the admin has selected. Not wired into inference yet. */
export const fetchActiveModelId = async () => {
  try {
    const value = await fetchSetting('active_model');
    return value?.id || DEFAULT_MODEL_ID;
  } catch {
    return DEFAULT_MODEL_ID;
  }
};