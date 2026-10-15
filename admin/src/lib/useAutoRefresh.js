import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

/**
 * Keeps a page's data fresh without a manual reload.
 *  - polls every `intervalMs` (only while the browser tab is visible), and
 *  - if `table` is given, also refreshes within ~0.5s of any INSERT/UPDATE/DELETE on it
 *    via Supabase Realtime (needs the table in the supabase_realtime publication; if it
 *    isn't, polling alone still keeps the page updated).
 * `refresh` should be a SILENT refetch (no loading spinner) so the screen doesn't flicker.
 */
export default function useAutoRefresh(refresh, { intervalMs = 10000, table = null } = {}) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let debounce = null;
    const run = () => {
      if (document.visibilityState === 'visible') {
        Promise.resolve(refreshRef.current()).catch(() => {});
      }
    };

    const timer = setInterval(run, intervalMs);
    document.addEventListener('visibilitychange', run); // catch up when returning to the tab

    let channel = null;
    if (table) {
      channel = supabase
        .channel(`auto-refresh-${table}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          clearTimeout(debounce);
          debounce = setTimeout(run, 500);
        })
        .subscribe();
    }

    return () => {
      clearInterval(timer);
      clearTimeout(debounce);
      document.removeEventListener('visibilitychange', run);
      if (channel) supabase.removeChannel(channel);
    };
  }, [intervalMs, table]);
}
