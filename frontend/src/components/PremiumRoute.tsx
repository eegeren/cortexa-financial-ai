import { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import usePremiumStatus from '@/hooks/usePremiumStatus';

const PremiumRoute = ({ children }: PropsWithChildren) => {
  const location = useLocation();
  const { initialized, token } = usePremiumStatus();

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!initialized) {
    return <div className="flex min-h-screen items-center justify-center text-slate-300">Yükleniyor…</div>;
  }

  return <>{children}</>;
};

export default PremiumRoute;
