// Supabase Edge Function: the ONLY place admin accounts are created or suspended.
// Deploy: supabase functions deploy manage-admins
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 1. Authenticate the caller and make sure they are an ACTIVE superadmin
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { data: me } = await sb.from('profiles').select('role,status').eq('id', user.id).maybeSingle()
  if (me?.role !== 'superadmin' || me?.status !== 'active') return json({ error: 'Forbidden' }, 403)

  const audit = (action: string, entityId: string | null, details: object) =>
    sb.from('audit_log').insert({ admin_id: user.id, action, entity: 'admin', entity_id: entityId, details })

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const { action } = body

  // 2. List admin accounts (admins only, never users or other superadmins)
  if (action === 'list') {
    const { data, error } = await sb.from('profiles')
      .select('id,email,full_name,status,last_active_at,created_at')
      .eq('role', 'admin').order('created_at', { ascending: false })
    return error ? json({ error: error.message }, 400) : json({ admins: data })
  }

  // 3. Create an admin
  if (action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const full_name = String(body.full_name ?? '').trim()
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Enter a valid email' }, 400)
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)

    const { data, error } = await sb.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: full_name || email.split('@')[0] },
    })
    if (error) return json({ error: error.message }, 400)

    // handle_new_user() already created the profile as role 'user'; promote it (service role bypasses the role guard)
    const { error: pErr } = await sb.from('profiles')
      .update({ role: 'admin', status: 'active', email, full_name: full_name || email.split('@')[0] })
      .eq('id', data.user.id)
    if (pErr) {
      await sb.auth.admin.deleteUser(data.user.id) // roll back so no half-made account is left
      return json({ error: pErr.message }, 400)
    }
    await audit('admin.create', data.user.id, { email })
    return json({ ok: true, id: data.user.id })
  }

  // 4. Suspend / reactivate an admin
  if (action === 'suspend' || action === 'reactivate') {
    const { id } = body
    if (!id) return json({ error: 'Missing id' }, 400)

    const { data: target } = await sb.from('profiles').select('role,email').eq('id', id).maybeSingle()
    if (target?.role !== 'admin') return json({ error: 'Target is not an admin account' }, 400)

    const suspend = action === 'suspend'
    const { error } = await sb.auth.admin.updateUserById(id, { ban_duration: suspend ? '876000h' : 'none' })
    if (error) return json({ error: error.message }, 400)

    await sb.from('profiles').update({ status: suspend ? 'suspended' : 'active' }).eq('id', id)
    if (suspend) await sb.auth.admin.signOut(id, 'global') // revoke refresh tokens

    await audit(`admin.${action}`, id, { email: target.email })
    return json({ ok: true })
  }

  return json({ error: 'Unknown action' }, 400)
})
