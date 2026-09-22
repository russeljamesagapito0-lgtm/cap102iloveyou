// utils/notifications.js
import { supabase } from './supabaseClient';

export async function pushNotification({ type, title, body, data = {} }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

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