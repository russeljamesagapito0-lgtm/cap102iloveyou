import { supabase } from './supabaseClient';

const PREF_CACHE_TTL_MS = 60 * 1000;

let cachedPref = null;      
let cachedPrefAt = 0;
let inFlightPref = null;

export const invalidateNotificationPrefCache = () => {
  cachedPref = null;
  cachedPrefAt = 0;
  inFlightPref = null;
};

const loadPushPref = async (userId) => {
  const now = Date.now();
  if (cachedPref !== null && now - cachedPrefAt < PREF_CACHE_TTL_MS) {
    return cachedPref;
  }
  if (inFlightPref) return inFlightPref;

  inFlightPref = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('push_notifications')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Push pref load failed:', error.message);
        return true;
      }
      const enabled = data?.push_notifications ?? true;
      cachedPref = enabled;
      cachedPrefAt = Date.now();
      return enabled;
    } catch (e) {
      console.warn('Push pref error:', e?.message);
      return true;
    } finally {
      inFlightPref = null;
    }
  })();

  return inFlightPref;
};

export async function pushNotification({ type, title, body, data = {} }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const enabled = await loadPushPref(session.user.id);
    if (!enabled) return;

    const { error } = await supabase.from('notifications').insert({
      user_id: session.user.id,
      type,
      title,
      body,
      data,
    });

    if (error) console.warn('Notification insert failed:', error.message);
  } catch (err) {
    console.warn('Notification error:', err.message);
  }
}

export async function markNotificationRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) console.warn('Mark read failed:', error.message);
}

export async function markAllNotificationsRead() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', session.user.id)
    .eq('is_read', false);
  if (error) console.warn('Mark all read failed:', error.message);
}