import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { loading, isAdmin, profile } = useAuth();
  if (loading) return <div className="content">Loading...</div>;
  if (!isAdmin) return <Navigate to="/login" replace />;

  const user = { name: profile.full_name || profile.email, email: profile.email };
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar user={user} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
