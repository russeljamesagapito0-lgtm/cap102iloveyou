import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function Topbar({ user }) {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { signOut } = useAuth();

  const initials = user.name
    .split(' ')
    .map((w) => w[0]?.toUpperCase())
    .join('')
    .slice(0, 2);

  return (
    <header className="topbar">
      <input
        className="topbar-search"
        placeholder="Search users, scans, feedback..."
      />

      <div className="topbar-user">
        <button
          className="theme-toggle"
          onClick={toggleDarkMode}
          aria-label="Toggle theme"
        >
          {isDarkMode ? 'Light mode' : 'Dark mode'}
        </button>

        <button className="theme-toggle" onClick={signOut}>Sign out</button>

        <div className="topbar-user-info">
          <p className="topbar-user-name">{user.name}</p>
          <p className="topbar-user-email">{user.email}</p>
        </div>

        <div className="avatar">{initials}</div>
      </div>
    </header>
  );
}