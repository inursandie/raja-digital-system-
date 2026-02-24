import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Toaster } from 'sonner';
import Login from '@/pages/Login';
import AdminDashboard from '@/pages/AdminDashboard';
import SuperAdminDashboard from '@/pages/SuperAdminDashboard';
import SIJInput from '@/pages/SIJInput';
import SIJList from '@/pages/SIJList';
import Drivers from '@/pages/Drivers';
import AuditLog from '@/pages/AuditLog';
import RitaseList from '@/pages/RitaseList';
import UserManagement from '@/pages/UserManagement';
import LaporanMingguan from '@/pages/LaporanMingguan';
import Layout from '@/components/Layout';

const PrivateRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-zinc-950">
      <div className="text-amber-500 font-mono text-sm animate-pulse">Memuat RAJA System...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const DashboardPage = () => {
  const { user } = useAuth();
  if (user?.role === 'superadmin') return <SuperAdminDashboard />;
  return <AdminDashboard />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/sij" element={<SIJInput />} />
              <Route path="/sij-list" element={<SIJList />} />
              <Route path="/ritase" element={<RitaseList />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/user-management" element={<UserManagement />} />
              <Route path="/laporan-mingguan" element={<LaporanMingguan />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
