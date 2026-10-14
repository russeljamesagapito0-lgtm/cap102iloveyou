import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="content">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <main className="content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}