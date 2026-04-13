import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import useSubscriptionAccess from '@/hooks/useSubscriptionAccess';

const PREMIUM_PLANS = new Set(['premium', 'pro', 'enterprise']);
const PREMIUM_ROLES = new Set(['premium', 'admin']);

const usePremiumStatus = () => {
  const role = useAuthStore((state) => state.role);
  const token = useAuthStore((state) => state.token);
  const { plan, status, initialized } = useSubscriptionAccess();

  return useMemo(() => {
    const normalizedPlan = (plan ?? '').toLowerCase();
    const normalizedRole = (role ?? '').toLowerCase();
    const normalizedStatus = (status ?? '').toLowerCase();
    const isPremium =
      PREMIUM_ROLES.has(normalizedRole) ||
      (PREMIUM_PLANS.has(normalizedPlan) && normalizedStatus === 'active');

    return {
      token,
      initialized,
      isPremium,
      plan: normalizedPlan || 'starter',
      badgeLabel: isPremium ? 'Premium' : 'Starter',
    };
  }, [initialized, plan, role, status, token]);
};

export default usePremiumStatus;
