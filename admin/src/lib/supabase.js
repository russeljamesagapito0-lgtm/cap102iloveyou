import { createClient } from '@supabase/supabase-js';

// Session lives in memory only: reloading or closing the tab signs the admin out.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: true } }
);

// Clean up tokens saved by earlier versions of this app
Object.keys(localStorage)
  .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  .forEach((k) => localStorage.removeItem(k));

export const fmtDate = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-');

// Fire-and-forget audit entry (admin_id is filled by the database)
export const logAudit = (action, entity, entityId, details = {}) =>
  supabase.from('audit_log').insert({ action, entity, entity_id: entityId ? String(entityId) : null, details });
