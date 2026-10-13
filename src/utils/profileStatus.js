// src/utils/profileStatus.js
// Checks whether a user's profile has the minimum required fields.
// Used to gate the CompleteProfile screen after Google sign-in.
import { supabase } from './supabaseClient';

const MIN_NAME_LEN = 2;

/**
 * Returns one of:
 *   'complete'   — first_name AND last_name are both set (min 2 chars)
 *   'incomplete' — the row exists but is missing one or both names
 *   'missing'    — no profile row at all (shouldn't happen after signup trigger)
 *   null         — couldn't check (network/RLS error)
 */
export const fetchProfileStatus = async (userId) => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) return null;
    if (!data) return 'missing';

    const first = (data.first_name || '').trim();
    const last = (data.last_name || '').trim();
    if (first.length >= MIN_NAME_LEN && last.length >= MIN_NAME_LEN) return 'complete';
    return 'incomplete';
  } catch (_) {
    return null;
  }
};