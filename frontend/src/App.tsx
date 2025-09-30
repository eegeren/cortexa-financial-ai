import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

function InlineSpinner() {
  return <div style={{ padding: 24, color: '#94a3b8' }}>Loading…</div>;
}

export default function ProtectedRoute() {
  const location = useLocation();
  // Be tolerant to different store shapes
  const token = useAuthStore((s: any) => s.token ?? s.accessToken ?? null);
  const initializing = useAuthStore((s: any) => (s.initializing ?? s.loading ?? false));

  if (initializing) return <InlineSpinner />;
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}