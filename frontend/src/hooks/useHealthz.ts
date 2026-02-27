import { useCallback, useEffect, useState } from 'react';
import { fetchHealthz } from '@/services/api';

interface HealthState {
  healthy: boolean;
  checking: boolean;
  lastChecked: number | null;
}

const useHealthz = (intervalMs = 45000): HealthState => {
  const [state, setState] = useState<HealthState>({ healthy: true, checking: true, lastChecked: null });

  const check = useCallback(async () => {
    try {
      await fetchHealthz();
      setState({ healthy: true, checking: false, lastChecked: Date.now() });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Health check failed', error);
      }
      setState({ healthy: false, checking: false, lastChecked: Date.now() });
    }
  }, []);

  useEffect(() => {
    void check();
    const interval = window.setInterval(() => {
      void check();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [check, intervalMs]);

  return state;
};

export default useHealthz;
