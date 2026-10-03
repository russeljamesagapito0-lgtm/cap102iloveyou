import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const nav = useNavigate();
  const { signIn, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice] = useState(() =>
    sessionStorage.getItem('rc_expired') ? 'Your session expired. Please sign in again.' : ''
  );
  const [busy, setBusy] = useState(false);

  if (!loading && isAdmin) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      nav('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>RootCare Admin</h1>
        <p className="subtitle">Sign in to continue</p>

        <div className="form-group">
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="label">Password</label>
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>

        {notice && !error && <p className="login-note">{notice}</p>}
        {error && <p className="login-note" style={{ color: 'var(--error)' }}>{error}</p>}
      </form>
    </div>
  );
}
