import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import useOpenFeedbackCount from '../lib/useOpenFeedbackCount';

const SECTIONS = [
  {
    links: [
      { to: '/',      label: 'Dashboard', icon: 'dashboard' },
      { to: '/users', label: 'Users',     icon: 'users' },
    ],
  },
  {
    title: 'Insights',
    links: [
      { to: '/analytics', label: 'Analytics', icon: 'analytics' },
      { to: '/reports',   label: 'Reports',   icon: 'reports' },
      { to: '/feedback',  label: 'Feedback',  icon: 'feedback' },
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

const navLinkClass = ({ isActive }) =>
  'nav-link' + (isActive ? ' active' : '');

export default function Sidebar() {
  const openFeedback = useOpenFeedbackCount();

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
        {SECTIONS.map(({ title, links }) => (
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
                {to === '/feedback' && openFeedback > 0 && (
                  <span className="nav-count">{openFeedback > 99 ? '99+' : openFeedback}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">v0.2</div>
    </aside>
  );
}