// src/components/PageHeader.js
// Reusable page header. Replaces the old Topbar.
// Renders the page title (and optional subtitle) on the left, and the
// settings menu on the right.
// Pages with their own actions can pass children, which render right-aligned
// before the settings menu.
import SettingsMenu from './SettingsMenu';

export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        {title && <h1 className="page-title">{title}</h1>}
        {subtitle && <p className="page-meta">{subtitle}</p>}
      </div>

      <div className="page-header-right">
        {children}
        <SettingsMenu align="down" />
      </div>
    </div>
  );
}