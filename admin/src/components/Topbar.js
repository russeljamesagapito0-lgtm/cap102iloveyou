import { useTheme } from '../context/ThemeContext';

export default function Topbar({ user }) {
  const { isDarkMode, toggleDarkMode } = useTheme();

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
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

        <div className="topbar-user-info">
          <p className="topbar-user-name">{user.name}</p>
          <p className="topbar-user-email">{user.email}</p>
        </div>

        <div className="avatar">{initials}</div>
      </div>
    </header>
  );
}