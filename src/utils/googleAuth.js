// src/utils/googleAuth.js
// "Continue with Google" via Supabase OAuth (system browser + deep link back into the app).
// Works for both sign-up and sign-in: Supabase creates the auth user on first use.
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabaseClient';
import { fetchAccountStatus } from './accountStatus';

// Lets the auth browser tab close itself when the app is re-opened by the redirect (needed on web).
WebBrowser.maybeCompleteAuthSession();

// rootcare://auth/callback in dev-client / EAS builds (scheme comes from app.json).
// This exact URL must be in Supabase -> Auth -> URL Configuration -> Redirect URLs.
export const GOOGLE_REDIRECT_URL = Linking.createURL('auth/callback');

// Pulls the session out of the redirect URL. Handles both flows:
//   PKCE:     rootcare://auth/callback?code=...
//   implicit: rootcare://auth/callback#access_token=...&refresh_token=...
const createSessionFromUrl = async (url) => {
  const [base, fragment = ''] = url.split('#');
  const query = base.includes('?') ? base.split('?')[1] : '';
  const params = new URLSearchParams(query);
  const hashParams = new URLSearchParams(fragment);

  const errorDescription = params.get('error_description') || hashParams.get('error_description');
  if (errorDescription) throw new Error(errorDescription);

  const code = params.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data.session;
  }

  throw new Error('Google sign-in did not return a session.');
};

// Fills in the profile row from the Google account without overwriting anything the user
// (or the handle_new_user trigger) already stored. Best-effort: failure must not block login.
const ensureProfile = async (user) => {
  try {
    const meta = user.user_metadata || {};
    const fullName = (meta.full_name || meta.name || '').trim();
    const firstName = meta.given_name || fullName.split(' ')[0] || null;
    const lastName = meta.family_name || fullName.split(' ').slice(1).join(' ') || null;

    const { data: existing } = await supabase
      .from('profiles')
      .select('display_name, first_name, last_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const patch = {};
    if (!existing?.email && user.email) patch.email = user.email;
    if (!existing?.display_name && fullName) patch.display_name = fullName;
    if (!existing?.first_name && firstName) patch.first_name = firstName;
    if (!existing?.last_name && lastName) patch.last_name = lastName;
    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase.from('profiles').upsert({ ...patch, id: user.id });
    if (error) console.warn('Google profile upsert failed:', error.message);
  } catch (e) {
    console.warn('Google profile setup failed:', e?.message);
  }
};

/**
 * Runs the whole Google flow.
 * Returns { status: 'success' | 'cancelled' | 'suspended' | 'error', message? }
 */
export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: GOOGLE_REDIRECT_URL,
        skipBrowserRedirect: true, // we open the browser ourselves
        queryParams: { prompt: 'select_account' }, // always let the user pick the account
      },
    });
    if (error) throw error;

    const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_URL);
    if (result.type !== 'success') return { status: 'cancelled' };

    const session = await createSessionFromUrl(result.url);
    if (!session?.user) throw new Error('No session returned.');

    // Same suspension gate as email login: fail closed.
    const accountStatus = await fetchAccountStatus(session.user.id);
    if (accountStatus !== 'active') {
      await supabase.auth.signOut().catch(() => {});
      return { status: accountStatus === 'suspended' ? 'suspended' : 'error',
               message: "We couldn't verify your account right now. Please try again." };
    }

    await ensureProfile(session.user);
    return { status: 'success' };
  } catch (e) {
    console.warn('Google sign-in failed:', e?.message);
    return { status: 'error', message: e?.message || 'Google sign-in failed. Please try again.' };
  }
};
