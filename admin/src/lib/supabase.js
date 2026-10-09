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