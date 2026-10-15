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