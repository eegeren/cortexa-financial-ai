import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/Login';
import RegisterPage from '@/pages/Register';
import DashboardPage from '@/pages/Dashboard';
import SignalsPage from '@/pages/Signals';
import PortfolioPage from '@/pages/Portfolio';
import AdminPage from '@/pages/Admin';
import Spinner from '@/components/Spinner';
import { useAuthStore } from '@/store/auth';

const AuthBootstrap = () => {
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return null;
};

const PublicOnlyRoute = ({ children }: { children: JSX.Element }) => {
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  if (!hydrated) {
    return <Spinner />;
  }
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const App = () => {
  return (
    <>
      <AuthBootstrap />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
};

export default App;
