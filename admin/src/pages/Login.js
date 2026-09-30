import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@rootcare.app');
  const [password, setPassword] = useState('demo1234');

  const submit = (e) => {
    e.preventDefault();
    nav('/');
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>RootCare Admin</h1>
        <p className="subtitle">Sign in to continue (mock)</p>

        <div className="form-group">
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="btn btn-primary btn-full" type="submit">
          Sign in
        </button>

        <p className="login-note">Any credentials work in this mock.</p>
      </form>
    </div>
  );
}