import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

const SESSION_MS = 60 * 60 * 1000;
const EXPIRED_FLAG = 'rc_expired';
const EXPIRY_CHECK_MS = 15000;
const EXPIRES_KEY = 'rc_expires_at';

const readExpiry = () => {
  const v = Number(localStorage.getItem(EXPIRES_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
};

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
      if (data.session) {
        let exp = readExpiry();
        if (!exp) {
          exp = Date.now() + SESSION_MS;
          localStorage.setItem(EXPIRES_KEY, String(exp));
        }
        setExpiresAt(exp);
      }
      setSession(data.session);
      setProfile(data.session ? await fetchProfile(data.session.user.id) : null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (_event === 'SIGNED_OUT') {
        setExpiresAt(null);
        localStorage.removeItem(EXPIRES_KEY);
      }
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

    setProfile(p);
    sessionStorage.removeItem(EXPIRED_FLAG);
    const exp = Date.now() + SESSION_MS;
    localStorage.setItem(EXPIRES_KEY, String(exp));
    setExpiresAt(exp);
  };

  const signOut = () => supabase.auth.signOut();

  useEffect(() => {
    if (!expiresAt) return;

    const check = () => {
      if (Date.now() >= expiresAt) {
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
  }, [expiresAt]);

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