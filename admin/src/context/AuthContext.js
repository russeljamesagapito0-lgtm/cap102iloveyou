import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, logAudit } from '../lib/supabase';

const AuthContext = createContext();

const SESSION_MS = 60 * 60 * 1000;
const EXPIRED_FLAG = 'rc_expired';
const EXPIRY_CHECK_MS = 15000;

const fetchProfile = async (userId) => {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setProfile(data.session ? await fetchProfile(data.session.user.id) : null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (_event === 'SIGNED_OUT') setExpiresAt(null);
      setSession(s);
      setProfile(s ? await fetchProfile(s.user.id) : null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const p = await fetchProfile(data.user.id);
    if (p?.role !== 'admin') {
      await supabase.auth.signOut();
      throw new Error('This account is not an admin.');
    }

    logAudit('login', 'admin', data.user.id, {
      email: p.email,
      at: new Date().toISOString(),
    });

    setProfile(p);
    sessionStorage.removeItem(EXPIRED_FLAG);
    setExpiresAt(Date.now() + SESSION_MS);
  };

  const signOut = async () => {
    if (profile) {
      logAudit('logout', 'admin', profile.id, {
        email: profile.email,
        at: new Date().toISOString(),
      });
    }
    await supabase.auth.signOut();
  };

  useEffect(() => {
    if (!expiresAt) return;

    const check = () => {
      if (Date.now() >= expiresAt) {
        if (profile) {
          logAudit('logout', 'admin', profile.id, {
            email: profile.email,
            at: new Date().toISOString(),
            reason: 'session_expired',
          });
        }
        sessionStorage.setItem(EXPIRED_FLAG, '1');
        supabase.auth.signOut();
      }
    };

    const id = setInterval(check, EXPIRY_CHECK_MS);
    document.addEventListener('visibilitychange', check);
    check();

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [expiresAt, profile]);

  const value = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);