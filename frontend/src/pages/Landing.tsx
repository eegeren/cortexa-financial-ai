import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const valuePoints = [
  {
    title: 'Trend with context',
    description: 'Structure, momentum, and market regime line up before you ever look at a trade idea.',
  },
  {
    title: 'Confidence and risk',
    description: 'Every read comes with conviction and risk framing, so you know what is clean and what is noisy.',
  },
  {
    title: 'AI explains the tape',
    description: 'Cortexa adds plain-English market intelligence on top of the model instead of dumping raw indicators.',
  },
];

const metricCards = [
  { label: 'Trend', value: 'Bullish', tone: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' },
  { label: 'Confidence', value: '78/100', tone: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-50' },
  { label: 'Risk', value: 'Medium', tone: 'border-amber-400/25 bg-amber-500/10 text-amber-100' },
];

const LandingPage = () => {
  const [reduceEffects, setReduceEffects] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce)');
    const syncEffects = () => setReduceEffects(mediaQuery.matches);

    syncEffects();
    mediaQuery.addEventListener('change', syncEffects);
    return () => mediaQuery.removeEventListener('change', syncEffects);
  }, []);

  return (
    <div className="space-y-8 pb-8 pt-2 sm:space-y-10 lg:space-y-12">
      <section className={`relative overflow-hidden rounded-[2rem] border border-outline/25 px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-14 ${
        reduceEffects
          ? 'bg-slate-950'
          : 'bg-gradient-to-br from-slate-950 via-surface to-slate-950 shadow-elevation-soft'
      }`}>
        {!reduceEffects && <div className="pointer-events-none absolute inset-0 bg-grid-glow opacity-25" />}
        {!reduceEffects && <div className="pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full bg-cyan-400/8 blur-3xl" />}
        {!reduceEffects && <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-emerald-400/8 blur-3xl" />}

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,420px)] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-300 sm:px-4 sm:text-xs">
              Cortexa Trade
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                Crypto market intelligence built for decision-making, not blind execution.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Cortexa reads trend, confidence, risk, and AI explanation in one view so you can assess structure fast without trading off context.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {valuePoints.map((point) => (
                <div key={point.title} className="rounded-2xl border border-outline/25 bg-slate-900/65 p-4">
                  <h2 className="text-sm font-semibold text-white">{point.title}</h2>
                  <p className="mt-2 text-xs leading-6 text-slate-400 sm:text-sm">{point.description}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-slate-200"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-outline/50 bg-slate-900/50 px-6 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-outline hover:bg-slate-900/70"
              >
                Sign in
              </Link>
            </div>
          </div>

          <aside className={`rounded-[1.75rem] border border-outline/30 bg-slate-950/90 p-5 sm:p-6 ${
            reduceEffects ? '' : 'shadow-inner-glow'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Example Signal</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">BTC / USDT</h2>
                <p className="mt-1 text-sm text-slate-400">1h structure snapshot</p>
              </div>
              <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
                Trend intact
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {metricCards.map((card) => (
                <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
                  <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">{card.label}</p>
                  <p className="mt-2 text-xl font-semibold text-white">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">AI Insight</p>
              <p className="mt-3 text-sm leading-7 text-slate-100">
                Price is holding above reclaimed intraday support while momentum stays constructive. Bias remains higher as long as pullbacks keep defending the demand zone under 68,200.
              </p>
            </div>

            <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div className="rounded-2xl border border-outline/20 bg-slate-900/45 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Support</p>
                <p className="mt-2 text-lg font-semibold text-white">68,200</p>
              </div>
              <div className="rounded-2xl border border-outline/20 bg-slate-900/45 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Resistance</p>
                <p className="mt-2 text-lg font-semibold text-white">70,050</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
