import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Scans from './pages/Scans';
import Maintenance from './pages/Maintenance';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';

const protectedRoutes = [
  { path: '/',      element: <Dashboard /> },
  { path: '/users', element: <Users /> },
  { path: '/scans', element: <Scans /> },
  { path: '/analytics', element: <Analytics /> },
  { path: '/reports', element: <Reports /> },
  { path: '/maintenance', element: <Maintenance /> },
  { path: '/audit', element: <Navigate to="/maintenance?tab=audit" replace /> },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        {protectedRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}