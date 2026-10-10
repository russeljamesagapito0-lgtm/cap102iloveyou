import { createContext, useContext, useEffect, useState, useRef } from 'react';
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
    .maybeSingle();
  return data;
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState(null);
  const loggedSessionRef = useRef(null);

  const recordLogin = (s, p) => {
    if (!s?.user?.id) return;
    if (loggedSessionRef.current === s.access_token) return;
    loggedSessionRef.current = s.access_token;

    logAudit('login', 'admin', s.user.id, {
      email: p?.email || s.user.email,
      at: new Date().toISOString(),
      method: 'session-restore',
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const p = await fetchProfile(data.session.user.id);
        setProfile(p);
        recordLogin(data.session, p);
        setExpiresAt(Date.now() + SESSION_MS);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (_event === 'SIGNED_OUT') {
        setExpiresAt(null);
        loggedSessionRef.current = null;
      }
      setSession(s);
      if (s) {
        const p = await fetchProfile(s.user.id);
        setProfile(p);
        recordLogin(s, p);
      } else {
        setProfile(null);
      }
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
    setExpiresAt(Date.now() + SESSION_MS);
  };

  const signOut = async () => {
    if (profile) {
      logAudit('logout', 'admin', profile.id, {
        email: profile.email,
        at: new Date().toISOString(),
      });
    }
    loggedSessionRef.current = null;
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
        loggedSessionRef.current = null;
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