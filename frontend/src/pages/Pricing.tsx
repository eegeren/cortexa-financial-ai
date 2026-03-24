import { useState } from 'react';
import Card from '@/components/Card';
import usePremiumStatus from '@/hooks/usePremiumStatus';
import { useAuthStore } from '@/store/auth';

const PREMIUM_FEATURES = [
  'Full signal access',
  'Advanced AI explanations',
  'Access to all markets',
  'Community participation',
  'Early features',
];

const COMPARISON_ROWS = [
  { label: 'Signals', free: 'Limited access', premium: 'Full signal access' },
  { label: 'AI Explanation', free: 'Basic context', premium: 'Advanced AI explanations' },
  { label: 'Coins', free: 'Core pairs only', premium: 'All markets' },
  { label: 'Community', free: 'Read only', premium: 'Vote and participate' },
  { label: 'Insights', free: 'Starter view', premium: 'Richer intelligence layer' },
];

const PricingPage = () => {
  const token = useAuthStore((state) => state.token);
  const { isPremium, badgeLabel } = usePremiumStatus();
  const [ctaState, setCtaState] = useState<'idle' | 'clicked'>('idle');

  const handleUpgrade = () => {
    setCtaState('clicked');
    window.location.href = token ? '/billing' : '/register';
  };

  const ctaLabel = isPremium ? 'Manage Premium' : ctaState === 'clicked' ? 'Redirecting…' : 'Upgrade to Premium';
  const bottomLabel = isPremium ? 'Manage your Premium plan' : 'Start Premium — $9.99/month';

  return (
    <div className="space-y-8 sm:space-y-10 lg:space-y-12">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-outline/25 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.96))] px-6 py-10 text-center sm:px-8 sm:py-12 lg:px-12 lg:py-14">
        <div className="pointer-events-none absolute -left-20 top-[-60px] h-56 w-56 rounded-full bg-cyan-400/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-24 bottom-[-100px] h-72 w-72 rounded-full bg-indigo-500/10 blur-[140px]" />
        <div className="relative mx-auto max-w-3xl">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/90">
            {isPremium ? 'Premium active' : 'Premium upgrade'}
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Upgrade your edge</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-300">
            Understand the market, not just the signal.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl">
        <Card className="rounded-[2rem] border border-primary/25 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.96))] p-6 shadow-[0_30px_120px_rgba(8,47,73,0.2)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/90">
                  CORTEXA PREMIUM
                </span>
                <span className="rounded-full border border-outline/25 bg-slate-950/35 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  {badgeLabel}
                </span>
              </div>

              <div className="mt-6 flex items-end gap-3">
                <p className="text-5xl font-semibold tracking-tight text-white">$9.99</p>
                <p className="pb-1 text-sm text-slate-400">/ month</p>
              </div>

              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                One clean upgrade for traders who want the full signal layer, better AI context, broader market access, and stronger participation inside the product.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {PREMIUM_FEATURES.map((feature) => (
                  <div key={feature} className="rounded-2xl border border-outline/25 bg-slate-950/35 px-4 py-4 text-sm text-slate-200">
                    <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[11px] text-primary">
                      ✓
                    </span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Why upgrade</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-outline/25 bg-slate-950/45 p-4">
                  <p className="text-sm font-medium text-white">Cleaner decisions</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    See the full structure, not just a limited snapshot.
                  </p>
                </div>
                <div className="rounded-2xl border border-outline/25 bg-slate-950/45 p-4">
                  <p className="text-sm font-medium text-white">Richer explanations</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Unlock the deeper AI explanation layer across supported markets.
                  </p>
                </div>
                <div className="rounded-2xl border border-outline/25 bg-slate-950/45 p-4">
                  <p className="text-sm font-medium text-white">More participation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Join community voting and conversation instead of staying read-only.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpgrade}
                className="mt-6 w-full rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-slate-200"
              >
                {ctaLabel}
              </button>
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-5xl">
        <Card className="rounded-[2rem] border border-outline/25 bg-slate-950/55 p-6 sm:p-8">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Comparison</p>
            <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">Free vs Premium</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              A simple side-by-side view of what changes when you move from the starter experience to the full product.
            </p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[620px] rounded-3xl border border-outline/20 bg-slate-950/40">
              <div className="grid grid-cols-[1.15fr_0.85fr_0.85fr] border-b border-outline/20 px-5 py-4 text-sm font-semibold text-white">
                <div>Feature</div>
                <div className="text-slate-400">Free</div>
                <div className="text-primary">Premium</div>
              </div>

              {COMPARISON_ROWS.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.15fr_0.85fr_0.85fr] items-center border-b border-outline/10 px-5 py-4 text-sm last:border-b-0"
                >
                  <div className="font-medium text-slate-200">{row.label}</div>
                  <div className="text-slate-400">{row.free}</div>
                  <div className="text-slate-100">{row.premium}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-4xl">
        <Card className="rounded-[2rem] border border-outline/25 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.95))] px-6 py-8 text-center sm:px-8 sm:py-10">
          <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Ready to unlock full access?</p>
          <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">Move from limited access to full market intelligence.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            Keep the same workflow and unlock the rest of the product without changing how you already use Cortexa.
          </p>
          <button
            type="button"
            onClick={handleUpgrade}
            className="mt-6 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-slate-200"
          >
            {bottomLabel}
          </button>
        </Card>
      </section>
    </div>
  );
};

export default PricingPage;
