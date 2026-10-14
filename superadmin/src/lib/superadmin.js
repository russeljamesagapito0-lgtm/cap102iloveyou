import { supabase } from './supabase';

// All superadmin operations go through the manage-admins edge function,
// which holds the service role key and verifies the caller server-side.
const call = async (body) => {
  const { data, error } = await supabase.functions.invoke('manage-admins', { body });
  if (data?.error) throw new Error(data.error);
  if (error) {
    // functions.invoke hides the JSON body of non-2xx responses inside error.context
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return data;
};

export const listAdmins = async () => (await call({ action: 'list' })).admins || [];
export const createAdmin = (payload) => call({ action: 'create', ...payload });
export const setAdminSuspended = (id, suspended) =>
  call({ action: suspended ? 'suspend' : 'reactivate', id });
export const resetAdminPassword = (id, password) =>
  call({ action: 'reset_password', id, password });
