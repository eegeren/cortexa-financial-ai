import { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Spinner from '@/components/Spinner';
import { useAuthStore } from '@/store/auth';

const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const location = useLocation();

  if (!hydrated) {
    return <Spinner />;
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
