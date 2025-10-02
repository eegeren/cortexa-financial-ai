import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import PageHeader from '@/components/PageHeader';
import { createCheckoutSession } from '@/services/api';
import { useSubscriptionStore } from '@/store/subscription';
import { useAuthStore } from '@/store/auth';
import Skeleton from '@/components/Skeleton';
import clsx from 'clsx';

type BillingInterval = 'monthly' | 'annual';

const formatPrice = (amountCents: number, currency: string, billingInterval: BillingInterval) => {
  const amount = amountCents / 100;
  const yearlyAmount = billingInterval === 'annual' ? amount * 10 : amount; // 2 ay hediye
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency?.toUpperCase() ?? 'USD',
    minimumFractionDigits: 0,
  }).format(yearlyAmount);
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
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');

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
    if (billingInterval === 'annual') {
      window.location.href = `mailto:finance@cortexaai.net?subject=Cortexa%20annual%20plan%20request%20(${planCode.toUpperCase()})`;
      return;
    }
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
        <>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setBillingInterval('monthly')}
              className={clsx(
                'rounded-full border px-4 py-1 text-xs font-semibold transition',
                billingInterval === 'monthly'
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-primary/40 hover:text-white'
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval('annual')}
              className={clsx(
                'rounded-full border px-4 py-1 text-xs font-semibold transition',
                billingInterval === 'annual'
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-primary/40 hover:text-white'
              )}
            >
              Annual (2 months free)
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {orderedPlans.map((plan) => {
              const highlight = planHighlights[plan.code] ?? {
                tier: plan.name,
                description: plan.description,
                extra: plan.features,
              };
              const isPopular = plan.code === 'pro';
              const badge = billingInterval === 'annual' ? 'per year' : 'per month';
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
                      <span className="text-3xl font-bold text-white">
                        {formatPrice(plan.amount_cents, plan.currency, billingInterval)}
                      </span>
                      <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">/{badge}</span>
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
        </>
      )}

      <Card className="border border-slate-800/60 bg-slate-900/80 p-6 text-sm text-slate-300">
        <h4 className="text-lg font-semibold text-white">Regulatory note</h4>
        <p className="mt-3">
          Cortexa Trade AI provides analytics and automation tooling. Nothing here constitutes investment advice. Plans
          can be cancelled anytime via the customer portal. Enterprise desks receive bespoke compliance reviews and
          deployment options.
        </p>
      </Card>

      <Card className="border border-slate-800/60 bg-slate-900/80 p-6 text-sm text-slate-300">
        <h4 className="text-lg font-semibold text-white">Compare plans</h4>
        <table className="mt-4 w-full text-xs text-left">
          <thead className="uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Capability</th>
              <th className="px-3 py-2">Starter</th>
              <th className="px-3 py-2">Pro</th>
              <th className="px-3 py-2">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'AI chat messages', starter: '50 / mo', pro: 'Unlimited', enterprise: 'Unlimited + private workspace' },
              { label: 'Market coverage', starter: 'Top 5 pairs', pro: 'Full universe', enterprise: 'Custom universe & OTC' },
              { label: 'Backtests & sweeps', starter: 'Snapshots', pro: 'Full analytics', enterprise: 'Fine-tuned & export API' },
              { label: 'Automations', starter: 'Manual triggers', pro: 'Auto execute', enterprise: 'Custom routing + SLAs' },
              { label: 'Support', starter: 'Community', pro: 'Priority desk', enterprise: 'Dedicated success manager' },
            ].map((row) => (
              <tr key={row.label} className="border-t border-slate-800/70 text-slate-200">
                <td className="px-3 py-2 font-medium text-slate-300">{row.label}</td>
                <td className="px-3 py-2">{row.starter}</td>
                <td className="px-3 py-2">{row.pro}</td>
                <td className="px-3 py-2">{row.enterprise}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="border border-slate-800/60 bg-slate-900/80 p-6 text-sm text-slate-300">
        <h4 className="text-lg font-semibold text-white">Frequently asked questions</h4>
        <div className="mt-4 space-y-4">
          {[
            {
              q: 'Which payment provider powers checkout?',
              a: 'Depending on the PAYMENT_PROVIDER value we route through Stripe, Paddle, Lemon Squeezy, or Iyzico with full PCI compliance.',
            },
            {
              q: 'Will upgrading affect my existing data?',
              a: 'No. Portfolio history, signals, and automations stay intact and new features unlock instantly.',
            },
            {
              q: 'Do you offer bespoke integrations for Enterprise?',
              a: 'Yes. Enterprise desks get custom models, private data feeds, and seat management. Reach us at finance@cortexaai.net.',
            },
          ].map((item) => (
            <div key={item.q} className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-4">
              <p className="text-sm font-semibold text-white">{item.q}</p>
              <p className="mt-2 text-xs text-slate-300">{item.a}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default PricingPage;
