import { Routes, Route, Navigate } from 'react-router-dom';
import SuperLayout from './components/SuperLayout';
import Login from './pages/Login';
import SuperAdmin from './pages/SuperAdmin';

export default function App() {
  return (
    <Routes>
      <Route path='/login' element={<Login />} />
      <Route element={<SuperLayout />}>
        <Route path='/' element={<SuperAdmin />} />
      </Route>
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  );
}
