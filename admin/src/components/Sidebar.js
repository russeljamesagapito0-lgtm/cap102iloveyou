import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',         label: 'Dashboard' },
  { to: '/users',    label: 'Users' },
  { to: '/scans',    label: 'Scans' },
  { to: '/diseases', label: 'Disease Info' },
  { to: '/feedback', label: 'Feedback' },
  { to: '/audit',    label: 'Audit Log' }
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>RootCare</h1>
        <p>Admin Dashboard</p>
      </div>

      <nav className="sidebar-nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">v0.2</div>
    </aside>
  );
}