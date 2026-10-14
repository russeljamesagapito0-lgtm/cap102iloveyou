import { supabase } from './supabaseClient';

export const SUSPENDED_TITLE = 'Account Suspended';
export const SUSPENDED_MESSAGE =
  'Your account has been suspended by an administrator, so you can’t log in right now. ' +
  'If you think this is a mistake, please contact RootCare support.';

export const fetchAccountStatus = async (userId) => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return data?.status === 'suspended' ? 'suspended' : 'active';
  } catch (_) {
    return null;
  }
};
