import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import SplashScreen from '@/components/SplashScreen';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/Login';
import RegisterPage from '@/pages/Register';
import DashboardPage from '@/pages/Dashboard';
import SignalsPage from '@/pages/Signals';
import PortfolioPage from '@/pages/Portfolio';
import ForumPage from '@/pages/Forum';
import AdminPage from '@/pages/Admin';
import AssistantPage from '@/pages/Assistant';
import PricingPage from '@/pages/Pricing';
import BillingPage from '@/pages/Billing';
import SettingsPage from '@/pages/Settings';
import Spinner from '@/components/Spinner';
import { useAuthStore } from '@/store/auth';
import { useSubscriptionStore } from '@/store/subscription';

const AuthBootstrap = () => {
  const hydrate = useAuthStore((state) => state.hydrate);
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const fetchSubscription = useSubscriptionStore((state) => state.hydrate);
  const clearSubscription = useSubscriptionStore((state) => state.clear);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (token) {
      void fetchSubscription();
    } else {
      clearSubscription();
    }
  }, [clearSubscription, fetchSubscription, hydrated, token]);

  return null;
};

const PublicOnlyRoute = ({ children }: { children: JSX.Element }) => {
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  if (!hydrated) {
    return <Spinner />;
  }
  if (token) {
    return <Navigate to="/assistant" replace />;
  }
  return children;
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
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

        <Route element={<Layout />}>
          <Route index element={<Navigate to="/assistant" replace />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/signals" element={<ProtectedRoute><SignalsPage /></ProtectedRoute>} />
          <Route path="/assistant" element={<ProtectedRoute><AssistantPage /></ProtectedRoute>} />
          <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
          <Route path="/forum" element={<ProtectedRoute><ForumPage /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/pricing" replace />} />
      </Routes>
    </>
  );
};

export default App;
