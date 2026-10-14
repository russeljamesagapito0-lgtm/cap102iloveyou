import Avatar from './Avatar';
import SettingsMenu from './SettingsMenu';

export default function Topbar() {
  return (
    <header className="topbar">
      <h1 className="topbar-title">Admin Accounts</h1>
      <div className="topbar-right">
        <Avatar size={32} />
        <SettingsMenu align="down" />
      </div>
    </header>
  );
}
