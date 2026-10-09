import { NavLink } from 'react-router-dom';
import Icon from './Icon';

const LINKS = [
  { to: '/',      label: 'Dashboard', icon: 'dashboard' },
  { to: '/users', label: 'Users',     icon: 'users' },
  { to: '/scans', label: 'Scans',     icon: 'scans' },
  { to: '/models', label: 'Models', icon: 'models' },
  { to: '/maintenance', label: 'Maintenance', icon: 'maintenance' },
  { to: '/audit', label: 'Audit Log', icon: 'audit' },
];

const navLinkClass = ({ isActive }) =>
  'nav-link' + (isActive ? ' active' : '');

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/emblem.png" alt="" className="sidebar-logo" />
        <div className="sidebar-brand-text">
          <h1>RootCare</h1>
          <p>Admin Dashboard</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {LINKS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={navLinkClass}
          >
            <span className="nav-icon">
              <Icon name={icon} size={18} />
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">v0.2</div>
    </aside>
  );
}