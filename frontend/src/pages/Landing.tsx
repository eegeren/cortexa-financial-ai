import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';

type PreviewSignal = {
  symbol: string;
  timeframe: string;
  trend: string;
  confidence: string;
  risk: string;
  insight: string;
  support: string;
  resistance: string;
  invalidation?: string;
};

const heroSignal: PreviewSignal = {
  symbol: 'BTC / USDT',
  timeframe: '1H',
  trend: 'Bullish',
  confidence: '78/100',
  risk: 'Medium',
  insight:
    'Price is holding above reclaimed support. Momentum is expanding. Bias remains bullish unless 68,200 breaks.',
  support: '68,200',
  resistance: '70,050',
  invalidation: 'Below 68,200',
};

const liveSignal: PreviewSignal = {
  symbol: 'BTC / USDT',
  timeframe: 'Live',
  trend: 'Bullish',
  confidence: '78',
  risk: 'Medium',
  insight: 'Momentum expanding after breakout. Structure intact above 68,200.',
  support: '68,200',
  resistance: '70,050',
};

const valuePoints = [
  {
    title: 'Trend locked fast',
    body: 'Read structure, regime, and directional bias before lower-quality setups pull attention away.',
  },
  {
    title: 'Confidence with risk',
    body: 'Every signal pairs conviction with risk framing so context arrives before execution decisions.',
  },
  {
    title: 'AI that explains',
    body: 'Cortexa turns market structure into plain language without reducing everything to raw indicators.',
  },
];

const trustMetrics = [
  { label: 'Win Rate (Last 30 Days)', value: 78, suffix: '%', line: [20, 28, 24, 37, 42, 56, 61, 78] },
  { label: 'Signals Generated', value: 1200, suffix: '+', line: [14, 18, 22, 31, 39, 53, 67, 82] },
  { label: 'Avg Signal Duration', value: 4.2, suffix: 'h', line: [42, 41, 45, 48, 47, 51, 54, 58] },
];

const steps = [
  {
    icon: '01',
    title: 'Structure Detection',
    body: 'Cortexa maps trend, support, resistance, and regime before a signal is allowed to form.',
  },
  {
    icon: '02',
    title: 'Signal Generation',
    body: 'Trend, confidence, and risk are compressed into one clean read instead of ten noisy indicator calls.',
  },
  {
    icon: '03',
    title: 'AI Explanation',
    body: 'The AI layer explains what matters so the trader sees context, invalidation, and pressure immediately.',
  },
];

const mobileScreens = [
  {
    title: 'Trade without noise',
    body: 'Cortexa strips away crowded indicator stacks and surfaces only the structure that matters.',
  },
  {
    title: 'Understand market structure instantly',
    body: 'Trend, confidence, and risk land in one dense view built for fast directional reads.',
  },
  {
    title: 'AI explains what matters',
    body: 'Readable context on top of the signal keeps decision-making sharp without replacing the trader.',
  },
];

const sectionTransition = {
  duration: 0.6,
  ease: [0.22, 1, 0.36, 1] as const,
};

const linePath = (points: number[]) =>
  points
    .map((point, index) => {
      const x = 12 + index * 28;
      const y = 74 - point * 0.62;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

const ChartSurface = ({ compact = false }: { compact?: boolean }) => (
  <div
    className={`relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#08111f] ${
      compact ? 'h-40' : 'h-52 sm:h-60'
    }`}
  >
    <div
      className="pointer-events-none absolute inset-0 opacity-30"
      style={{
        backgroundImage:
          'linear-gradient(rgba(71,85,105,0.32) 1px, transparent 1px), linear-gradient(90deg, rgba(71,85,105,0.22) 1px, transparent 1px)',
        backgroundSize: '100% 48px, 48px 100%',
      }}
    />
    <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/10 to-transparent" />
    <svg viewBox="0 0 280 100" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
      <path d={linePath([28, 34, 31, 48, 44, 58, 64, 78])} stroke="url(#previewLine)" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d={`${linePath([28, 34, 31, 48, 44, 58, 64, 78])} L 208 100 L 12 100 Z`}
        fill="url(#previewArea)"
        opacity="0.85"
      />
      {[
        [44, 61, 56, 68],
        [72, 58, 43, 62],
        [100, 55, 48, 58],
        [128, 44, 36, 49],
        [156, 42, 34, 45],
        [184, 34, 24, 37],
      ].map(([x, open, close, wick], index) => {
        const bullish = close < open;
        const bodyY = Math.min(open, close);
        const bodyHeight = Math.max(Math.abs(close - open), 5);
        return (
          <g key={index}>
            <line x1={x} x2={x} y1={wick} y2={bodyY + bodyHeight + 8} stroke={bullish ? '#34d399' : '#fb7185'} strokeWidth="1.8" />
            <rect x={x - 4} y={bodyY} width="8" height={bodyHeight} rx="2" fill={bullish ? '#34d399' : '#fb7185'} />
          </g>
        );
      })}
      <defs>
        <linearGradient id="previewLine" x1="12" y1="70" x2="208" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="previewArea" x1="120" y1="20" x2="120" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(34, 211, 238, 0.24)" />
          <stop offset="1" stopColor="rgba(8, 17, 31, 0)" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const SignalCard = ({
  signal,
  compact = false,
  interactive = false,
}: {
  signal: PreviewSignal;
  compact?: boolean;
  interactive?: boolean;
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={sectionTransition}
      whileHover={
        interactive && !reduceMotion
          ? { y: -4, boxShadow: '0 28px 70px rgba(56,189,248,0.12), 0 12px 24px rgba(15,23,42,0.55)' }
          : undefined
      }
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(9,14,26,0.92))] ${
        compact ? 'p-5 sm:p-6' : 'p-5 sm:p-6 lg:p-7'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_30%)]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Signal Console</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{signal.symbol}</h3>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
            {signal.timeframe}
          </div>
        </div>

        <div className="mt-4">
          <ChartSurface compact={compact} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Trend', value: signal.trend, tone: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100' },
            { label: 'Confidence', value: signal.confidence, tone: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-50' },
            { label: 'Risk', value: signal.risk, tone: 'border-amber-400/25 bg-amber-500/10 text-amber-100' },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl border p-4 ${stat.tone}`}>
              <p className="text-[11px] uppercase tracking-[0.24em] opacity-80">{stat.label}</p>
              <p className="mt-2 text-lg font-semibold text-white sm:text-xl">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/6 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/80">AI Insight</p>
          <p className="mt-3 text-sm leading-7 text-slate-100">{signal.insight}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Support</p>
            <p className="mt-2 text-base font-semibold text-white sm:text-lg">{signal.support}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Resistance</p>
            <p className="mt-2 text-base font-semibold text-white sm:text-lg">{signal.resistance}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Invalidation</p>
            <p className="mt-2 text-base font-semibold text-white sm:text-lg">{signal.invalidation ?? `Above ${signal.support}`}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CountMetric = ({ value, suffix, decimals = 0 }: { value: number; suffix: string; decimals?: number }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!inView) {
      return;
    }
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 1100;

    const update = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(update);
      }
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduceMotion, value]);

  return (
    <span ref={ref}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
};

const LoadingSignal = () => (
  <div className="flex min-h-[29rem] items-center justify-center rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,26,0.94))] p-6">
    <div className="relative text-center">
      <div className="landing-loader-shimmer absolute inset-x-0 top-1/2 h-12 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-xl" />
      <div className="relative flex items-center justify-center gap-4">
        <div className="landing-loader-ring h-12 w-12 rounded-full border border-cyan-300/20 border-t-cyan-200/90" />
        <div className="text-left">
          <p className="text-lg font-semibold text-white">Loading signal...</p>
          <p className="mt-1 text-sm text-slate-400">Syncing structure, risk, and AI context</p>
        </div>
      </div>
    </div>
  </div>
);

const MobileOnboarding = () => {
  const [index, setIndex] = useState(0);

  return (
    <section className="md:hidden">
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,29,0.92),rgba(7,11,20,0.96))] p-4 sm:p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="min-h-[12.5rem] sm:min-h-[14rem]"
          >
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/70">Mobile Onboarding</p>
            <h2 className="mt-4 text-[1.85rem] font-semibold leading-tight text-white sm:text-3xl">{mobileScreens[index].title}</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300 sm:leading-7">{mobileScreens[index].body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {mobileScreens.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-2 rounded-full transition-all ${dotIndex === index ? 'w-7 bg-cyan-300' : 'w-2 bg-slate-700'}`}
                aria-label={`Go to slide ${dotIndex + 1}`}
              />
            ))}
          </div>

          {index < mobileScreens.length - 1 ? (
            <button
              type="button"
              onClick={() => setIndex((current) => Math.min(current + 1, mobileScreens.length - 1))}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
            >
              Next
            </button>
          ) : (
            <Link
              to="/register"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Get Started
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

const LandingPage = () => {
  const [isLoadingSignal, setIsLoadingSignal] = useState(false);
  const liveDemoRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let timer: number | undefined;
    if (isLoadingSignal) {
      timer = window.setTimeout(() => setIsLoadingSignal(false), 1200);
    }
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [isLoadingSignal]);

  const handleViewSignal = () => {
    setIsLoadingSignal(true);
    liveDemoRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const trustCards = useMemo(() => trustMetrics, []);

  return (
    <div className="space-y-6 py-2 sm:space-y-10 sm:py-4 lg:space-y-12 lg:py-6">
      <MobileOnboarding />

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,29,0.92),rgba(6,10,19,0.98))] px-4 py-5 shadow-[0_30px_90px_rgba(2,8,23,0.45)] sm:px-7 sm:py-8 lg:min-h-[calc(100dvh-4.5rem)] lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_22%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.12),transparent_24%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(71,85,105,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(71,85,105,0.18) 1px, transparent 1px)',
            backgroundSize: '100% 72px, 72px 100%',
          }}
        />

        <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,0.92fr)_minmax(420px,560px)] lg:gap-12">
          <div className="space-y-6 lg:space-y-7">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={sectionTransition}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-cyan-100/80"
            >
              Cortexa
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...sectionTransition, delay: 0.08 }}>
              <h1 className="max-w-3xl text-[2.35rem] font-semibold leading-[0.96] tracking-[-0.05em] text-white sm:text-5xl lg:text-[5rem]">
                See the market before it moves.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                One screen. Trend, confidence, risk, and AI insight.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...sectionTransition, delay: 0.16 }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <button
                type="button"
                onClick={handleViewSignal}
                disabled={isLoadingSignal}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoadingSignal ? 'Loading signal...' : 'View Live Signal'}
              </button>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Get Started
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...sectionTransition, delay: 0.24 }}
              className="grid gap-3 sm:grid-cols-3"
            >
              {valuePoints.map((card) => (
                <div key={card.title} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold text-white">{card.title}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-400">{card.body}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...sectionTransition, delay: 0.12 }}
            whileHover={reduceMotion ? undefined : { y: -4 }}
            className="hidden md:block"
          >
            <motion.div animate={reduceMotion ? undefined : { y: [0, -6, 0] }} transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}>
              <SignalCard signal={heroSignal} />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section ref={liveDemoRef} className="scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={sectionTransition}
          className="space-y-5"
        >
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/70">Live Demo</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Live Signal Preview</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
              A read-only signal view that shows exactly how Cortexa compresses structure, confidence, risk, and AI explanation.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {isLoadingSignal ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <LoadingSignal />
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                <SignalCard signal={liveSignal} interactive compact />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      <section>
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={sectionTransition}
          className="space-y-5"
        >
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/70">Trust Metrics</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Built to earn conviction fast.</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {trustCards.map((metric) => (
              <motion.div
                key={metric.label}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                className="rounded-[1.8rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{metric.label}</p>
                <div className="mt-4 text-3xl font-semibold text-white">
                  <CountMetric value={metric.value} suffix={metric.suffix} decimals={metric.value % 1 ? 1 : 0} />
                </div>
                <svg viewBox="0 0 220 90" className="mt-5 h-20 w-full" fill="none" aria-hidden>
                  <path d={linePath(metric.line)} stroke="url(#metricLine)" strokeWidth="3" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="metricLine" x1="12" y1="70" x2="208" y2="22" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#38bdf8" />
                      <stop offset="1" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section>
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={sectionTransition}
          className="space-y-5"
        >
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/70">How It Works</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Three steps from noise to signal.</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ ...sectionTransition, delay: index * 0.08 }}
                className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/12 bg-cyan-300/8 text-sm font-semibold text-cyan-100">
                  {step.icon}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section>
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={sectionTransition}
          className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-center"
        >
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/70">Why Cortexa</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Not another indicator tool.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">
              Cortexa is designed for traders who need direction and risk framing immediately, not more fragmented dashboards.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.8rem] border border-rose-400/15 bg-rose-500/[0.05] p-5">
              <p className="text-sm font-semibold text-rose-100">Messy indicators</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>Too many signals</li>
                <li>No clarity</li>
                <li>Direction gets buried</li>
              </ul>
            </div>
            <div className="rounded-[1.8rem] border border-emerald-400/15 bg-emerald-500/[0.05] p-5">
              <p className="text-sm font-semibold text-emerald-100">Cortexa</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>Structured signals</li>
                <li>Clear direction</li>
                <li>Risk included</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,29,0.88),rgba(7,11,20,0.96))] px-6 py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_42%)]" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={sectionTransition}
          className="relative text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/70">Final CTA</p>
          <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Trade with clarity, not noise.</h2>
          <Link
            to="/register"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
          >
            Start Using Cortexa
          </Link>
        </motion.div>
      </section>
    </div>
  );
};

export default LandingPage;
