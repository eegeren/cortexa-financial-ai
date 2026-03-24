import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import usePremiumStatus from '@/hooks/usePremiumStatus';
import { useAuthStore } from '@/store/auth';

const PREMIUM_FEATURES = [
  'Full signal access',
  'Advanced AI explanations',
  'Access to all coins',
  'Community participation',
  'Priority updates',
];

const LOCKED_PREVIEWS = [
  {
    title: 'Advanced explanation',
    body: 'AI structure notes, invalidation logic, and cleaner context stay behind Premium.',
  },
  {
    title: 'Full signal stream',
    body: 'Starter users see selective access while Premium unlocks the entire market universe.',
  },
  {
    title: 'Community write access',
    body: 'Read the forum freely, then upgrade to post, vote, and participate in desk discussion.',
  },
];

const PricingPage = () => {
  const token = useAuthStore((state) => state.token);
  const { isPremium, badgeLabel } = usePremiumStatus();
  const [ctaState, setCtaState] = useState<'idle' | 'clicked'>('idle');

  const handleUpgrade = () => {
    setCtaState('clicked');
    window.location.href = token ? '/billing' : '/register';
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      <PageHeader
        title="Pricing"
        description="One clean subscription. Full market coverage, richer AI context, and premium participation."
      />

      <section className="mx-auto max-w-3xl">
        <Card className="rounded-[2rem] border border-primary/25 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/90">
                {isPremium ? 'Active premium' : 'Premium plan'}
              </span>
              <h2 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">CORTEXA PREMIUM</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                The full intelligence layer for traders who want clear structure, complete coverage, and richer context without clutter.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/55 px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Price</p>
              <p className="mt-2 text-4xl font-semibold text-white">$9.99</p>
              <p className="mt-1 text-sm text-slate-400">/ month</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {PREMIUM_FEATURES.map((feature) => (
              <div key={feature} className="rounded-2xl border border-outline/30 bg-slate-950/35 px-4 py-4 text-sm text-slate-200">
                <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[11px] text-primary">
                  ✓
                </span>
                {feature}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-outline/25 bg-slate-950/30 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current access</p>
              <p className="mt-2 text-sm text-slate-200">{badgeLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleUpgrade}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-slate-200"
            >
              {isPremium ? 'Manage Premium' : ctaState === 'clicked' ? 'Redirecting…' : 'Upgrade to Premium'}
            </button>
          </div>
        </Card>
      </section>

      {!isPremium && (
        <section className="grid gap-4 lg:grid-cols-3">
          {LOCKED_PREVIEWS.map((item) => (
            <Card key={item.title} className="relative rounded-3xl border border-outline/25 bg-slate-950/50 p-5">
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-transparent to-slate-950/30" />
              <div className="absolute right-4 top-4 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary/90">
                Locked
              </div>
              <div className="blur-[2px] select-none">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
              </div>
              <p className="mt-6 text-sm font-medium text-slate-100">Upgrade to access full features</p>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
};

export default PricingPage;
