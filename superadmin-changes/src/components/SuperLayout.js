import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../context/AuthContext';

export default function SuperLayout() {
  const { loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="content">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!isSuperAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Sidebar superadmin />
      <div className="main-area">
        <Topbar />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
