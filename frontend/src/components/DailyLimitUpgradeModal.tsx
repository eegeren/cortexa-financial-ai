import { Link } from 'react-router-dom';

const PREMIUM_FEATURES = [
  'Unlimited analyses',
  'Full AI explanations',
  'Access to all markets',
  'Community participation',
];

const DailyLimitUpgradeModal = () => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/72 px-4 backdrop-blur-sm">
    <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 text-center shadow-[0_30px_100px_rgba(2,6,23,0.65)] sm:p-7">
      <div className="pointer-events-none absolute -left-16 top-[-48px] h-36 w-36 rounded-full bg-cyan-400/10 blur-[90px]" />
      <div className="pointer-events-none absolute -right-14 bottom-[-56px] h-40 w-40 rounded-full bg-amber-300/10 blur-[100px]" />

      <div className="relative">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-[0_0_24px_rgba(34,211,238,0.12)]">
          <span className="text-lg">✦</span>
        </div>

        <h3 className="mt-5 text-2xl font-semibold text-white">Daily limit reached</h3>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          You&apos;ve used all your free analyses for today.
        </p>
        <p className="mt-1 text-sm leading-7 text-slate-400">
          Upgrade to Premium to continue analyzing the market without limits.
        </p>

        <div className="mt-6 grid gap-2 text-left">
          {PREMIUM_FEATURES.map((feature) => (
            <div key={feature} className="rounded-2xl border border-outline/20 bg-slate-900/45 px-4 py-3 text-sm text-slate-200">
              <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[11px] text-primary">
                ✓
              </span>
              {feature}
            </div>
          ))}
        </div>

        <Link
          to="/pricing"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black shadow-[0_0_24px_rgba(255,255,255,0.08)] transition hover:bg-slate-200"
        >
          Upgrade to Premium — $9.99/month
        </Link>

        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">Resets tomorrow</p>
      </div>
    </div>
  </div>
);

export default DailyLimitUpgradeModal;
