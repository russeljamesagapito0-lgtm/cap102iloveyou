import { NavLink } from 'react-router-dom';
import Icon from './Icon';

const SECTIONS = [
  {
    links: [
      { to: '/',      label: 'Dashboard', icon: 'dashboard' },
      { to: '/users', label: 'Users',     icon: 'users' },
      { to: '/scans', label: 'Scans',     icon: 'scans' },
    ],
  },
  {
    title: 'Insights',
    links: [
      { to: '/analytics', label: 'Analytics', icon: 'analytics' },
      { to: '/reports',   label: 'Reports',   icon: 'reports' },
    ],
  },
  {
    title: 'Utilities',
    links: [
      { to: '/models',      label: 'Models',      icon: 'models' },
      { to: '/maintenance', label: 'Maintenance', icon: 'maintenance' },
    ],
  },
];

const SUPER_SECTIONS = [
  {
    links: [{ to: '/superadmin', label: 'Admin Accounts', icon: 'shield' }],
  },
];

const navLinkClass = ({ isActive }) =>
  'nav-link' + (isActive ? ' active' : '');

export default function Sidebar({ superadmin = false }) {
  const sections = superadmin ? SUPER_SECTIONS : SECTIONS;
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/emblem.png" alt="" className="sidebar-logo" />
        <div className="sidebar-brand-text">
          <h1>RootCare</h1>
          <p>{superadmin ? 'Super Admin' : 'Admin Dashboard'}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map(({ title, links }) => (
          <div className="nav-section" key={title || 'main'}>
            {title && <div className="nav-section-label">{title}</div>}
            {links.map(({ to, label, icon }) => (
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
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">v0.2</div>
    </aside>
  );
}