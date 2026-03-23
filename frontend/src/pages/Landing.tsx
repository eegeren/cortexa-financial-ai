import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const valueCards = [
  {
    title: 'Structured signals',
    body: 'Trend, confidence, and risk aligned in one view instead of scattered indicator panels.',
  },
  {
    title: 'AI with context',
    body: 'Readable market explanation layered on top of the model, built for clarity over noise.',
  },
  {
    title: 'Desk-ready workflow',
    body: 'Fast reads for traders who need structure, levels, and invalidation without the fluff.',
  },
];

const statCards = [
  { label: 'Trend', value: 'Bullish', tone: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100' },
  { label: 'Confidence', value: '78/100', tone: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-50' },
  { label: 'Risk', value: 'Medium', tone: 'border-amber-400/25 bg-amber-500/10 text-amber-100' },
];

const priceRows = [
  { label: 'Support', value: '68,200' },
  { label: 'Resistance', value: '70,050' },
  { label: 'Regime', value: 'Trend Day' },
];

const workflowSteps = [
  {
    label: 'Structure first',
    body: 'Start from regime, trend, and levels before noise from disconnected indicators creeps in.',
  },
  {
    label: 'Risk framed fast',
    body: 'Confidence and risk are surfaced together so every read comes with context, not just direction.',
  },
  {
    label: 'Explanation attached',
    body: 'AI summarizes what matters in plain language without replacing your own execution process.',
  },
];

const surfaceCards = [
  { title: 'Trend', value: 'Higher highs still intact' },
  { title: 'Invalidation', value: 'Lose 68,200 and momentum fades' },
  { title: 'Use case', value: 'Fast directional context before execution' },
];

const ChartMock = () => (
  <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-800/90 bg-[#07111f]">
    <div
      className="pointer-events-none absolute inset-0 opacity-40"
      style={{
        backgroundImage:
          'linear-gradient(rgba(51,65,85,0.26) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.2) 1px, transparent 1px)',
        backgroundSize: '100% 52px, 56px 100%',
      }}
    />
    <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/8 to-transparent" />
    <div className="relative h-48 sm:h-56">
      <svg viewBox="0 0 520 240" className="h-full w-full" fill="none" aria-hidden>
        <path
          d="M18 173 C 54 164, 74 128, 112 132 C 152 136, 176 110, 210 96 C 245 82, 275 101, 306 92 C 344 81, 361 48, 404 58 C 438 67, 465 41, 502 27"
          stroke="url(#cortexaLine)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M18 173 C 54 164, 74 128, 112 132 C 152 136, 176 110, 210 96 C 245 82, 275 101, 306 92 C 344 81, 361 48, 404 58 C 438 67, 465 41, 502 27 L 502 240 L 18 240 Z"
          fill="url(#cortexaArea)"
          opacity="0.9"
        />

        {[
          [52, 162, 145, 178],
          [86, 148, 120, 164],
          [121, 118, 152, 136],
          [157, 126, 112, 140],
          [194, 106, 92, 118],
          [228, 118, 80, 124],
          [262, 94, 66, 101],
          [298, 102, 73, 110],
          [334, 88, 60, 96],
          [372, 68, 48, 76],
          [409, 74, 42, 80],
          [446, 58, 34, 66],
        ].map(([x, open, close, wick], index) => {
          const bullish = close < open;
          const bodyTop = Math.min(open, close);
          const bodyHeight = Math.max(Math.abs(close - open), 8);
          return (
            <g key={index}>
              <line x1={x} x2={x} y1={wick} y2={bodyTop + bodyHeight + 10} stroke={bullish ? '#34d399' : '#fb7185'} strokeWidth="2" opacity="0.9" />
              <rect
                x={x - 7}
                y={bodyTop}
                width="14"
                height={bodyHeight}
                rx="4"
                fill={bullish ? '#34d399' : '#fb7185'}
                opacity="0.95"
              />
            </g>
          );
        })}

        <defs>
          <linearGradient id="cortexaLine" x1="18" y1="173" x2="502" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34d399" />
            <stop offset="0.55" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#a5f3fc" />
          </linearGradient>
          <linearGradient id="cortexaArea" x1="260" y1="20" x2="260" y2="240" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(56, 189, 248, 0.22)" />
            <stop offset="1" stopColor="rgba(8, 15, 28, 0)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
);

const LandingPage = () => {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!nodes.length || typeof window === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -10% 0px' }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-6 py-2 sm:space-y-8 sm:py-4 lg:space-y-10 lg:py-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-800/90 bg-[#050b14] px-5 py-6 shadow-[0_24px_70px_rgba(2,8,23,0.45)] sm:px-7 sm:py-7 lg:min-h-[calc(100dvh-4.5rem)] lg:px-10 lg:py-9">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.85),rgba(5,11,20,0.96))]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(51,65,85,0.34) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.22) 1px, transparent 1px)',
            backgroundSize: '100% 72px, 72px 100%',
          }}
        />
        <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />

        <div className="relative grid gap-8 lg:h-full lg:grid-cols-[minmax(0,0.96fr)_minmax(420px,560px)] lg:items-center lg:gap-10">
          <div className="space-y-6 lg:space-y-7">
            <div className="hero-fade-in inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/6 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-cyan-100/85">
              Cortexa Trade
            </div>

            <div className="space-y-4">
              <h1 className="hero-fade-in max-w-3xl text-[2.5rem] font-semibold leading-[0.96] tracking-[-0.04em] text-white sm:text-5xl lg:text-[4.4rem]" data-delay="1">
                Read crypto structure before the market reads you.
              </h1>
              <p className="hero-fade-in max-w-xl text-sm leading-7 text-slate-300 sm:text-base" data-delay="2">
                Cortexa gives you structured crypto market intelligence with trend, confidence, risk, and AI explanation in one dense screen built for clarity over indicator noise.
              </p>
            </div>

            <div className="hero-fade-in flex flex-col gap-3 sm:flex-row" data-delay="2">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 px-6 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-cyan-400/40 hover:bg-slate-900"
              >
                Sign in
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {valueCards.map((card) => (
                <div key={card.title} className="hero-fade-in rounded-2xl border border-slate-800 bg-slate-950/70 p-4" data-delay="2">
                  <p className="text-sm font-semibold text-white">{card.title}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-400">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="hero-fade-in hero-float rounded-[1.8rem] border border-slate-800 bg-[#07101c] p-4 shadow-[0_18px_48px_rgba(2,8,23,0.42)] sm:p-5" data-delay="1">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Signal Console</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">BTC / USDT</h2>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
                Structure intact
              </div>
            </div>

            <div className="mt-4">
              <ChartMock />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {statCards.map((card) => (
                <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
                  <p className="text-[11px] uppercase tracking-[0.24em] opacity-75">{card.label}</p>
                  <p className="mt-2 text-xl font-semibold text-white">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/6 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/80">AI Insight</p>
              <p className="mt-3 text-sm leading-7 text-slate-100">
                Price is holding above reclaimed intraday support and momentum is still expanding after the last breakout leg. Bias stays constructive while 68,200 holds; failure there would open a rotation back into range.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {priceRows.map((row) => (
                <div key={row.label} className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{row.label}</p>
                  <p className="mt-2 text-base font-semibold text-white sm:text-lg">{row.value}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section data-reveal className="reveal-on-scroll grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,360px)]">
        <div className="rounded-[1.8rem] border border-slate-800 bg-slate-950/80 p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">How Cortexa Reads the Tape</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {workflowSteps.map((step) => (
              <div key={step.label} className="rounded-2xl border border-slate-800 bg-[#08101c] p-4">
                <p className="text-sm font-semibold text-white">{step.label}</p>
                <p className="mt-2 text-xs leading-6 text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-slate-800 bg-slate-950/80 p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Built for Clarity</p>
          <div className="mt-4 space-y-3">
            {surfaceCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-800 bg-[#08101c] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{card.title}</p>
                <p className="mt-2 text-sm font-medium text-white">{card.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-reveal className="reveal-on-scroll rounded-[1.8rem] border border-slate-800 bg-[#060d18] px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Why Traders Use It</p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
              Direction, risk, and explanation on one screen.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
              Cortexa is not an execution bot and not a raw indicator dump. It is a clean read on market structure designed to shorten the path from observation to decision.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
            >
              Get started
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 px-6 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-cyan-400/40 hover:bg-slate-900"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
