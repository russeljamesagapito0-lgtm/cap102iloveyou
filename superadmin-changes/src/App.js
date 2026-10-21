import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import SuperLayout from './components/SuperLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Scans from './pages/Scans';
import Maintenance from './pages/Maintenance';
import Models from './pages/Models';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import SuperAdmin from './pages/SuperAdmin';

const protectedRoutes = [
  { path: '/',      element: <Dashboard /> },
  { path: '/users', element: <Users /> },
  { path: '/scans', element: <Scans /> },
  { path: '/analytics', element: <Analytics /> },
  { path: '/reports', element: <Reports /> },
  { path: '/models', element: <Models /> },
  { path: '/maintenance', element: <Maintenance /> },
  // Audit Log now lives inside Maintenance; keep old links working.
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
      <Route element={<SuperLayout />}>
        <Route path="/superadmin" element={<SuperAdmin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}