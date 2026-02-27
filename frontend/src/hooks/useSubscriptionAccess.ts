import { useMemo } from 'react';
import { useSubscriptionStore } from '@/store/subscription';

const useSubscriptionAccess = () => {
  const { loading, access, data, error } = useSubscriptionStore((state) => ({
    loading: state.loading,
    access: state.access,
    data: state.data,
    error: state.error,
  }));

  const canAccess = access?.can_access ?? false;
  const trialDays = access?.trial_days_remaining ?? 0;
  const status = access?.status ?? data?.status ?? 'unknown';
  const plan = access?.plan ?? data?.plan_code ?? 'starter';
  const initialized = access !== null || data !== null;

  return useMemo(
    () => ({
      loading,
      canAccess,
      trialDays,
      status,
      plan,
      access,
      subscription: data,
      error,
      initialized,
    }),
    [access, canAccess, data, error, initialized, loading, plan, status, trialDays]
  );
};

export default useSubscriptionAccess;
