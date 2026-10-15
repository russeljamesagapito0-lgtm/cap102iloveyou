import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: window.sessionStorage,
    },
  }
);

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export const logAudit = (action, entity, entityId, details = {}) =>
  supabase.from('audit_log').insert({
    action,
    entity,
    entity_id: entityId ? String(entityId) : null,
    details,
  });

// Supabase caps every response at 1000 rows. Pages through with .range().
// `build` must return a fresh query each call and order by a unique column
// (add .order('id')) so rows are not skipped or repeated between pages.
// `max` is a safety ceiling; pass Infinity for backups.
export const fetchPages = async (build, { pageSize = 1000, max = 50000 } = {}) => {
  let rows = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    rows = rows.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  return rows;
};
