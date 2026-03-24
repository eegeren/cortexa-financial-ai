import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import useSubscriptionAccess from '@/hooks/useSubscriptionAccess';

const PREMIUM_PLANS = new Set(['premium', 'pro', 'enterprise']);
const PREMIUM_ROLES = new Set(['premium', 'admin']);

const usePremiumStatus = () => {
  const role = useAuthStore((state) => state.role);
  const token = useAuthStore((state) => state.token);
  const { plan, canAccess, initialized } = useSubscriptionAccess();

  return useMemo(() => {
    const normalizedPlan = (plan ?? '').toLowerCase();
    const normalizedRole = (role ?? '').toLowerCase();
    const isPremium = PREMIUM_ROLES.has(normalizedRole) || PREMIUM_PLANS.has(normalizedPlan) || canAccess;

    return {
      token,
      initialized,
      isPremium,
      plan: normalizedPlan || 'starter',
      badgeLabel: isPremium ? 'Premium' : 'Starter',
    };
  }, [canAccess, initialized, plan, role, token]);
};

export default usePremiumStatus;
