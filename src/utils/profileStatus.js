
import { supabase } from './supabaseClient';

const MIN_NAME_LEN = 2;

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