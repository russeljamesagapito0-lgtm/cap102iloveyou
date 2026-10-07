import { useLocation } from 'react-router-dom';
import Avatar from './Avatar';
import SettingsMenu from './SettingsMenu';

const PAGE_TITLES = {
  '/':      'Dashboard',
  '/users': 'Users',
  '/scans': 'Scans',
  '/audit': 'Audit Log',
};

const FALLBACK_TITLE = 'RootCare Admin';

const resolveTitle = (pathname) => {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];

  const match = Object.entries(PAGE_TITLES).find(
    ([path]) => path !== '/' && pathname.startsWith(path)
  );

  return match ? match[1] : FALLBACK_TITLE;
};

export default function Topbar() {
  const { pathname } = useLocation();
  const title = resolveTitle(pathname);

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">
        <Avatar size={32} />
        <SettingsMenu align="down" />
      </div>
    </header>
  );
}