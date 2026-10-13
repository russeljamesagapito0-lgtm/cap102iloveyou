// src/utils/googleAuth.js
// "Continue with Google" via Supabase OAuth (system browser + deep link back into the app).
// Works for both sign-up and sign-in: Supabase creates the auth user on first use.
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabaseClient';
import { fetchAccountStatus } from './accountStatus';
import { fetchProfileStatus } from './profileStatus';

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_REDIRECT_URL = Linking.createURL('auth/callback');

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

// Best-effort: fills in fields that are safe to populate from Google
// WITHOUT defeating the CompleteProfile gate.
// Deliberately does NOT fill first_name / last_name — those are set by
// the user in CompleteProfileScreen.
const ensureProfile = async (user) => {
  try {
    const meta = user.user_metadata || {};
    const fullName = (meta.full_name || meta.name || '').trim();

    const { data: existing } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const patch = {};
    if (!existing?.email && user.email) patch.email = user.email;
    if (!existing?.display_name && fullName) patch.display_name = fullName;
    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase.from('profiles').upsert({ ...patch, id: user.id });
    if (error) console.warn('Google profile upsert failed:', error.message);
  } catch (e) {
    console.warn('Google profile setup failed:', e?.message);
  }
};

/**
 * Runs the whole Google flow.
 * Returns:
 *   { status: 'success', needsProfileSetup: boolean }
 *   { status: 'cancelled' }
 *   { status: 'suspended' }
 *   { status: 'error', message }
 */
export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: GOOGLE_REDIRECT_URL,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;

    const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_URL);
    if (result.type !== 'success') return { status: 'cancelled' };

    const session = await createSessionFromUrl(result.url);
    if (!session?.user) throw new Error('No session returned.');

    const accountStatus = await fetchAccountStatus(session.user.id);
    if (accountStatus !== 'active') {
      await supabase.auth.signOut().catch(() => {});
      return {
        status: accountStatus === 'suspended' ? 'suspended' : 'error',
        message: "We couldn't verify your account right now. Please try again.",
      };
    }

    await ensureProfile(session.user);

    // If first_name/last_name are missing, the app will route to CompleteProfile.
    const profileStatus = await fetchProfileStatus(session.user.id);
    const needsProfileSetup = profileStatus !== 'complete';

    return { status: 'success', needsProfileSetup };
  } catch (e) {
    console.warn('Google sign-in failed:', e?.message);
    return { status: 'error', message: e?.message || 'Google sign-in failed. Please try again.' };
  }
};