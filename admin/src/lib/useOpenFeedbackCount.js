import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import useAutoRefresh from './useAutoRefresh';

// Number of feedback items still marked 'open'. Used for the sidebar badge.
export default function useOpenFeedbackCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const { count: c, error } = await supabase
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');
    if (!error) setCount(c || 0);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useAutoRefresh(refresh, { intervalMs: 30000, table: 'feedback' });

  return count;
}
