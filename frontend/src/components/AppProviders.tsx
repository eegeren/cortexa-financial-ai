import { ReactNode } from 'react';
import GlobalErrorBoundary from './GlobalErrorBoundary';
import HealthBanner from './HealthBanner';
import useHealthz from '@/hooks/useHealthz';

interface Props {
  children: ReactNode;
}

const AppProviders = ({ children }: Props) => {
  const { healthy } = useHealthz();

  return (
    <GlobalErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <HealthBanner healthy={healthy} />
        <div className={healthy ? '' : 'pt-12 md:pt-14'}>
          {children}
        </div>
      </div>
    </GlobalErrorBoundary>
  );
};

export default AppProviders;
