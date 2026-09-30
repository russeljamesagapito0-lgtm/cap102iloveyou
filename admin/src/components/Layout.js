import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { mockUser } from '../data/mockData';

export default function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar user={mockUser} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}