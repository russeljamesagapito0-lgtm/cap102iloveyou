import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

const SESSION_MS = 60 * 60 * 1000; // auto sign-out 1 hour after login

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState(null);

  const loadProfile = async (s) => {
    if (!s) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).single();
    setProfile(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === 'SIGNED_OUT') setExpiresAt(null);
      setSession(s);
      loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (p?.role !== 'admin') {
      await supabase.auth.signOut();
      throw new Error('This account is not an admin.');
    }
    setProfile(p);
    sessionStorage.removeItem('rc_expired');
    setExpiresAt(Date.now() + SESSION_MS);
  };

  const signOut = () => supabase.auth.signOut();

  // Absolute 1h limit. Checked on an interval and on tab focus (timers pause while the laptop sleeps).
  useEffect(() => {
    if (!expiresAt) return;
    const check = () => {
      if (Date.now() >= expiresAt) {
        sessionStorage.setItem('rc_expired', '1');
        supabase.auth.signOut();
      }
    };
    const id = setInterval(check, 15000);
    document.addEventListener('visibilitychange', check);
    check();
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [expiresAt]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin: profile?.role === 'admin', signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
