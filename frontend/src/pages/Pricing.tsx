import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import PageHeader from '@/components/PageHeader';
import { createCheckoutSession } from '@/services/api';
import { useSubscriptionStore } from '@/store/subscription';
import { useAuthStore } from '@/store/auth';
import Skeleton from '@/components/Skeleton';

const formatPrice = (amountCents: number, currency: string) => {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency?.toUpperCase() ?? 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
};

const planHighlights: Record<string, { tier: string; description: string; extra: string[] }> = {
  starter: {
    tier: 'Starter',
    description: 'Ideal for traders exploring Cortexa insights with core signals and guided chats.',
    extra: ['50 AI chat messages / month', 'Top 5 market signals', 'Portfolio analytics lite'],
  },
  pro: {
    tier: 'Pro',
    description: 'Unlock unlimited AI chat, deep signal coverage, and automation workflows.',
    extra: ['Unlimited AI assistant chats', 'Full market & backtest coverage', 'Priority strategy drops'],
  },
  enterprise: {
    tier: 'Enterprise',
    description: 'Custom integrations, dedicated success and advanced compliance tooling.',
    extra: ['Unlimited seats & workspaces', 'Custom models + private deployments', 'Dedicated success manager'],
  },
};

const PricingPage = () => {
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const token = useAuthStore((state) => state.token);
  const { plans, loadPlans } = useSubscriptionStore((state) => ({ plans: state.plans, loadPlans: state.loadPlans }));

  useEffect(() => {
    if (!plans.length) {
      void loadPlans();
    }
  }, [loadPlans, plans.length]);

  const orderedPlans = useMemo(
    () =>
      [...plans].sort((a, b) => {
        const order = ['starter', 'pro', 'enterprise'];
        return order.indexOf(a.code) - order.indexOf(b.code);
      }),
    [plans]
  );

  const handleCheckout = async (planCode: string) => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setCheckingOut(planCode);
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const session = await createCheckoutSession({
        plan_code: planCode,
        success_url: `${currentUrl}/billing`,
        cancel_url: `${currentUrl}/pricing`,
      });
      if (session.checkout_url) {
        window.location.href = session.checkout_url;
      }
    } catch (error) {
      console.error('checkout failed', error);
      alert('Checkout could not be started. Please try again or contact support.');
    } finally {
      setCheckingOut(null);
    }
  };

  return (
    <div className="space-y-12">
      <PageHeader
        title="Pricing"
        description="Choose the plan that matches your desk. Upgrade instantly and unlock premium intelligence."
      />

      {!orderedPlans.length ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[340px] w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {orderedPlans.map((plan) => {
            const highlight = planHighlights[plan.code] ?? {
              tier: plan.name,
              description: plan.description,
              extra: plan.features,
            };
            const isPopular = plan.code === 'pro';
            return (
              <Card
                key={plan.id}
                className={`relative border border-slate-800/60 bg-slate-900/70 p-6 transition hover:-translate-y-1 hover:border-primary/40 ${
                  isPopular ? 'shadow-lg shadow-primary/20' : ''
                }`}
              >
                {isPopular && (
                  <span className="absolute right-4 top-4 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                    Most popular
                  </span>
                )}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{highlight.tier}</h3>
                    <p className="mt-1 text-sm text-slate-400">{highlight.description}</p>
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-white">{formatPrice(plan.amount_cents, plan.currency)}</span>
                    <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">/{plan.billing_interval}</span>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-200">
                    {highlight.extra.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan.code)}
                    className="mt-6 w-full rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={checkingOut === plan.code}
                  >
                    {checkingOut === plan.code ? 'Redirecting…' : 'Choose plan'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border border-slate-800/60 bg-slate-900/80 p-6 text-sm text-slate-300">
        <h4 className="text-lg font-semibold text-white">Regulatory note</h4>
        <p className="mt-3">
          Cortexa Trade AI provides analytics and automation tooling. Nothing here constitutes investment advice. Plans
          can be cancelled anytime via the customer portal. Enterprise desks receive bespoke compliance reviews and
          deployment options.
        </p>
      </Card>
    </div>
  );
};

export default PricingPage;
