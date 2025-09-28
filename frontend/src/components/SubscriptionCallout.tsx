import { useMemo } from 'react';
import Card from '@/components/Card';
import { useAuthStore } from '@/store/auth';
import { Link } from 'react-router-dom';

const tiers = [
  {
    label: 'Starter',
    price: 'Free',
    perks: ['Core AI signals', 'Manual trade logging', 'Community updates']
  },
  {
    label: 'Premium',
    price: '$299/mo',
    perks: ['Real-time signal stream', 'Full backtesting suite', 'Priority desk support']
  }
];

const SubscriptionCallout = () => {
  const { role, hydrated, email } = useAuthStore((state) => ({
    role: state.role,
    hydrated: state.hydrated,
    email: state.email
  }));

  const visible = useMemo(() => {
    if (!hydrated) {
      return false;
    }
    if (!role) {
      return true;
    }
    return role !== 'premium' && role !== 'admin';
  }, [hydrated, role]);

  if (!visible) {
    return null;
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-slate-900/70">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-10%] h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 left-[-5%] h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-primary/80">
            Upgrade access
          </span>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Unlock live execution and deep analytics with Cortexa Premium.
          </h2>
          <p className="text-sm text-slate-300">
            Premium members gain real-time streaming signals, full backtesting exports, and 24/5 desk coverage. Stay on
            the free tier as long as you need—you can upgrade in minutes when the desk is ready.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>Account:</span>
            <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-slate-200">
              {email ?? 'guest@cortexa.ai'}
            </span>
            <span className="text-slate-500">•</span>
            <span>No card required for the starter tier.</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:info@cortexaai.net"
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary/80"
            >
              Talk to the desk
            </a>
            <Link
              to="/signals"
              className="rounded-full border border-slate-700 px-5 py-2 text-sm text-slate-200 transition hover:border-primary hover:text-white"
            >
              See signal quality
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {tiers.map((tier) => (
            <div
              key={tier.label}
              className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 text-sm text-slate-200 shadow-inner shadow-slate-950/40"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{tier.label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{tier.price}</p>
              <ul className="mt-3 space-y-1 text-xs">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-slate-300">
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] text-primary">✓</span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default SubscriptionCallout;
