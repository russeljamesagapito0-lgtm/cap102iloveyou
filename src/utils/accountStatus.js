// src/utils/accountStatus.js
// Reads profiles.status ('active' | 'suspended') for the signed-in user.
// Admins set this from the admin panel (Users -> Suspend user).
import { supabase } from './supabaseClient';

export const SUSPENDED_TITLE = 'Account Suspended';
export const SUSPENDED_MESSAGE =
  'Your account has been suspended by an administrator, so you can’t log in right now. ' +
  'If you think this is a mistake, please contact RootCare support.';

/**
 * Returns 'active' | 'suspended', or null if the status couldn't be checked
 * (network/RLS error). Callers decide whether to fail open or closed.
 */
export const fetchAccountStatus = async (userId) => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    // No profile row (or no status) = nothing to suspend.
    return data?.status === 'suspended' ? 'suspended' : 'active';
  } catch (_) {
    return null;
  }
};
