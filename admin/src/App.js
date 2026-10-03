import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Scans from './pages/Scans';
import DiseaseContent from './pages/DiseaseContent';
import Feedback from './pages/Feedback';
import Audit from './pages/Audit';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/"         element={<Dashboard />} />
        <Route path="/users"    element={<Users />} />
        <Route path="/scans"    element={<Scans />} />
        <Route path="/diseases" element={<DiseaseContent />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/audit"    element={<Audit />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}