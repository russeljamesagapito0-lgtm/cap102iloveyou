import { NavLink } from 'react-router-dom';
import Icon from './Icon';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/emblem.png" alt="" className="sidebar-logo" />
        <div className="sidebar-brand-text">
          <h1>RootCare</h1>
          <p>Super Admin</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="nav-icon"><Icon name="shield" size={18} /></span>
            <span className="nav-label">Admin Accounts</span>
          </NavLink>
        </div>
      </nav>

      <div className="sidebar-footer">v0.2</div>
    </aside>
  );
}
