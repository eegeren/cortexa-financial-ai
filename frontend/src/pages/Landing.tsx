import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView } from 'framer-motion';

const MARKET_TICKER = [
  { symbol: 'BTC/USDT', price: '$64,250', change: '+1.4%', up: true },
  { symbol: 'ETH/USDT', price: '$3,140', change: '-0.6%', up: false },
  { symbol: 'SOL/USDT', price: '$142.80', change: '+2.1%', up: true },
  { symbol: 'LINK/USDT', price: '$18.94', change: '+0.9%', up: true },
  { symbol: 'AVAX/USDT', price: '$38.44', change: '-1.1%', up: false },
  { symbol: 'BNB/USDT', price: '$611.30', change: '+0.5%', up: true },
];

const PIPELINE = [
  {
    step: '01',
    title: 'Market data',
    description: 'Price action, momentum, volatility, and volume are monitored across supported markets.',
  },
  {
    step: '02',
    title: 'Indicator analysis',
    description: 'Trend structure, moving averages, and breakout conditions are evaluated in context.',
  },
  {
    step: '03',
    title: 'Filtering',
    description: 'Low-quality setups are excluded to reduce noise and avoid overtrading.',
  },
  {
    step: '04',
    title: 'AI validation',
    description: 'An AI layer reviews whether the setup is coherent enough to become a tradable idea.',
  },
  {
    step: '05',
    title: 'Final signal',
    description: 'Each signal includes direction, entry, stop-loss, take-profit, confidence, and a plain-language rationale.',
  },
];

const RECENT_SIGNALS = [
  {
    asset: 'BTC/USD',
    direction: 'LONG',
    entry: '64,250',
    takeProfit: '65,780',
    stopLoss: '63,620',
    result: 'TP hit',
    confidence: 'High',
    reasons: [
      'EMA alignment confirmed the broader uptrend.',
      'Volume breakout showed strong participation above resistance.',
      'ADX trend strength supported continuation rather than chop.',
      'RSI structure remained constructive without showing exhaustion.',
    ],
  },
  {
    asset: 'ETH/USD',
    direction: 'SHORT',
    entry: '3,140',
    takeProfit: '3,045',
    stopLoss: '3,195',
    result: 'Running',
    confidence: 'Medium',
    reasons: [
      'Price rejected a key resistance zone on retest.',
      'Short-term EMA structure rolled over.',
      'Volume increased on the move down.',
      'RSI lost strength after failing to reclaim momentum.',
    ],
  },
  {
    asset: 'SOL/USD',
    direction: 'LONG',
    entry: '142.80',
    takeProfit: '147.20',
    stopLoss: '140.90',
    result: 'SL hit',
    confidence: 'Medium',
    reasons: [
      'EMA alignment supported trend continuation at entry.',
      'Volume expanded through the breakout level.',
      'ADX showed a tradable trend environment.',
      'RSI structure remained supportive before reversal.',
    ],
  },
  {
    asset: 'BTC/USD',
    direction: 'SHORT',
    entry: '66,120',
    takeProfit: '64,980',
    stopLoss: '66,780',
    result: 'TP hit',
    confidence: 'High',
    reasons: [
      'Support broke with expanding sell-side volume.',
      'Lower-timeframe EMA alignment turned bearish.',
      'ADX indicated directional strength after the breakdown.',
      'RSI structure stayed weak on the retest.',
    ],
  },
] as const;

const PERFORMANCE_METRICS = [
  { label: 'Typical win rate', value: '55–65%' },
  { label: 'Typical risk/reward', value: '1.5R–2.0R' },
  { label: 'Max drawdown', value: '8–12%' },
  { label: 'Trades analyzed', value: '1,200+' },
];

const CORE_FEATURES = [
  {
    title: 'High-quality signal filtering',
    description: 'Most alerts are noise. Cortexa focuses on fewer setups that meet structured technical conditions.',
  },
  {
    title: 'Risk-defined trade setups',
    description: 'Every signal includes entry, stop-loss, and take-profit levels so risk is visible before execution.',
  },
  {
    title: 'AI-powered explanations',
    description: 'Signals are not black boxes. Each setup includes a concise explanation of why it qualified.',
  },
];

const DIFFERENTIATION = [
  {
    label: 'Most platforms',
    points: ['High alert volume', 'Minimal filtering', 'Weak trade context'],
    highlight: false,
  },
  {
    label: 'Cortexa AI',
    points: ['Fewer signals', 'Higher confidence', 'Structured trade plans'],
    highlight: true,
  },
];

const FAQS = [
  {
    q: 'Is Cortexa AI an automated trading bot?',
    a: 'No. Cortexa AI is a decision-support product. It provides structured trade intelligence, but users remain in control of execution and risk.',
  },
  {
    q: 'What does a signal include?',
    a: 'Each signal includes direction, entry, stop-loss, take-profit, confidence, and structured reasoning so you can see why the setup exists.',
  },
  {
    q: 'Do all signals win?',
    a: 'No. Losses are part of trading. Cortexa is designed to improve consistency and structure, not to eliminate risk or guarantee profits.',
  },
  {
    q: 'How should I evaluate performance?',
    a: 'Focus on risk/reward, drawdown, selectivity, and execution discipline over short-term streaks. Performance varies with market conditions and user behavior.',
  },
];

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

const FadeIn = ({ children, delay = 0, className = '' }: FadeInProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ─── Unified colour tokens ───────────────────────────────────────────────────
// BASE    #080c14   → every page background (no alternating sections)
// SURFACE #0d1422   → cards / panels
// DEEP    #0a1019   → inset card areas
// BORDER  #162030   → all borders
// TEXT1   #e8edf4   → primary text
// TEXT2   #7a93ad   → secondary / label text
// TEXT3   #3a5068   → muted / caption text
// ACCENT  #10b981   → emerald — CTAs, highlights only
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  base:        '#0b1220',
  surface:     '#101c30',
  deep:        '#0d1628',
  border:      '#1c2d44',
  t1:          '#e8edf4',
  t2:          '#7a93ad',
  t3:          '#3a5068',
  accent:      '#10b981',
  accentDim:   'rgba(16,185,129,0.08)',
  accentBorder:'rgba(16,185,129,0.2)',
} as const;

// Full-page layered gradient — rendered once, fills the whole scroll height
const PAGE_BG = [
  'radial-gradient(ellipse 65% 55% at -8% 45%, rgba(16,185,129,0.13) 0%, transparent 62%)',   // left green glow
  'radial-gradient(ellipse 55% 45% at 108% 8%, rgba(6,182,212,0.10) 0%, transparent 58%)',    // top-right cyan glow
  'radial-gradient(ellipse 50% 40% at 50% 102%, rgba(16,185,129,0.06) 0%, transparent 65%)',  // bottom center soft echo
  '#0b1220',
].join(', ');

const LandingPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Walk up the DOM to find the actual overflow-y:auto scroll container
    // (Layout.tsx renders Landing inside <main className="overflow-y-auto">)
    const findScrollContainer = (el: HTMLElement | null): HTMLElement | null => {
      let node = el?.parentElement ?? null;
      while (node && node !== document.body) {
        const { overflowY } = window.getComputedStyle(node);
        if (overflowY === 'auto' || overflowY === 'scroll') return node;
        node = node.parentElement;
      }
      return null;
    };

    const container = findScrollContainer(rootRef.current);
    if (!container) return;

    const onScroll = () => setScrolled(container.scrollTop > 60);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    // Scroll inside the same container, not window
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const b = `1px solid ${C.border}`;

  return (
    <div ref={rootRef} className="min-h-screen antialiased" style={{ background: PAGE_BG, color: C.t1 }}>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ borderBottom: b }}>
        {/* Hero-local accent: brighten the green glow just behind the headline */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 55% 70% at 20% 50%, rgba(16,185,129,0.07) 0%, transparent 60%)',
          }}
        />
        {/* Subtle dot grid — gives depth without texture noise */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(148,163,184,0.08) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-14 sm:pb-24 sm:pt-16 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1fr_480px] lg:items-start lg:gap-16">

            {/* Left column */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.07)', color: '#6ee7b7' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                AI-powered trading intelligence
              </div>

              {/* Headline */}
              <div className="space-y-5">
                <h1 className="text-[2.6rem] font-semibold leading-[1.12] tracking-[-0.02em] text-white sm:text-5xl lg:text-[3.25rem]">
                  Fewer signals.
                  <br />
                  <span style={{ color: '#34d399' }}>Higher conviction.</span>
                </h1>
                <p className="max-w-lg text-[1.0625rem] leading-[1.75] text-slate-400">
                  Cortexa AI helps traders evaluate setups with clear entry, stop-loss, and take-profit levels — before a trade is placed.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => scrollTo('recent-signals')}
                  className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110"
                  style={{ background: C.accent }}
                >
                  View Live Signals
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo('how-it-works')}
                  className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:text-white"
                  style={{ border: `1px solid ${C.border}`, color: '#94a3b8', background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}
                >
                  See How It Works
                </button>
              </div>

              {/* Proof chips */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Positioning', value: 'Decision support, not automation' },
                  { label: 'Signal format', value: 'Entry · TP · SL · Confidence · Rationale' },
                  { label: 'Focus', value: 'Consistency over volume' },
                ].map((chip) => (
                  <div
                    key={chip.label}
                    className="rounded-xl p-4"
                    style={{ border: `1px solid ${C.border}`, background: C.surface }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: C.t3 }}>
                      {chip.label}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{chip.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right column — signal card */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="rounded-2xl p-6"
                style={{
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 24px 64px rgba(0,0,0,0.5)',
                }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: C.t3 }}>
                      Recent setup
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white tracking-tight">BTC/USD LONG</h2>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ border: '1px solid rgba(16,185,129,0.22)', background: 'rgba(16,185,129,0.08)', color: '#6ee7b7' }}
                  >
                    High confidence
                  </span>
                </div>

                {/* Price levels */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Entry', value: '64,250', color: '#e2e8f0' },
                    { label: 'Take Profit', value: '65,780', color: '#34d399' },
                    { label: 'Stop Loss', value: '63,620', color: '#f87171' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl p-4"
                      style={{ border: `1px solid ${C.border}`, background: C.deep }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.t3 }}>
                        {item.label}
                      </p>
                      <p className="mt-2 text-base font-semibold" style={{ color: item.color }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Reasoning */}
                <div
                  className="mt-4 rounded-xl p-4"
                  style={{ border: `1px solid ${C.border}`, background: C.deep }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: C.t3 }}>
                    Why this trade?
                  </p>
                  <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
                    {[
                      'EMA alignment confirmed the primary trend.',
                      'Volume breakout showed participation above resistance.',
                      'ADX trend strength supported continuation.',
                      'RSI structure remained constructive through entry.',
                    ].map((line) => (
                      <div key={line} className="flex items-start gap-2.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: C.accent }} />
                        <span style={{ color: '#94a3b8' }}>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signals */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {['EMA alignment', 'Volume breakout', 'ADX trend strength', 'RSI structure'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2.5 py-1 text-xs"
                      style={{ border: `1px solid ${C.border}`, color: C.t2, background: C.deep }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#34d399' }}>
                    AI validation: confirmed
                  </p>
                </div>

                <p className="mt-4 text-xs leading-relaxed" style={{ color: C.t3 }}>
                  We do not trade for you. We help you trade with more structure, more context, and clearer risk definition.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-50 overflow-hidden backdrop-blur-md"
        style={{
          borderBottom: b,
          borderTop: b,
          background: 'rgba(11,18,32,0.85)',
          boxShadow: scrolled ? '0 6px 32px rgba(0,0,0,0.45)' : '0 2px 12px rgba(0,0,0,0.25)',
          padding: scrolled ? '4px 0' : '10px 0',
          transition: 'padding 300ms ease, box-shadow 300ms ease',
        }}
      >
        <style>{`
          @keyframes landingTicker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .landing-ticker-track {
            animation: landingTicker 36s linear infinite;
            display: flex;
            width: max-content;
          }
          .landing-ticker-track:hover { animation-play-state: paused; }
        `}</style>
        <div className="landing-ticker-track">
          {[...MARKET_TICKER, ...MARKET_TICKER].map((item, index) => (
            <div
              key={`${item.symbol}-${index}`}
              className="whitespace-nowrap"
              style={{
                padding: scrolled ? '0 20px' : '0 28px',
                transition: 'padding 300ms ease',
              }}
            >
              <span
                className="font-semibold"
                style={{
                  color: '#94a3b8',
                  fontSize: scrolled ? '11px' : '13px',
                  transition: 'font-size 300ms ease',
                }}
              >
                {item.symbol}
              </span>
              <span
                className="ml-1.5"
                style={{
                  color: C.t3,
                  fontSize: scrolled ? '11px' : '13px',
                  transition: 'font-size 300ms ease',
                }}
              >
                {item.price}
              </span>
              <span
                className="ml-1.5 font-medium"
                style={{
                  color: item.up ? '#34d399' : '#f87171',
                  fontSize: scrolled ? '11px' : '13px',
                  transition: 'font-size 300ms ease',
                }}
              >
                {item.change}
              </span>
              <span className="mx-2.5" style={{ color: C.border }}>·</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── DISCLAIMER STRIP ─────────────────────────────────────────── */}
      <div className="py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="mx-auto max-w-4xl px-6">
          <div
            className="rounded-xl px-5 py-4 text-center"
            style={{ border: '1px solid rgba(251,191,36,0.14)', background: 'rgba(251,191,36,0.05)' }}
          >
            <p className="text-sm leading-relaxed" style={{ color: '#d4a843' }}>
              Not every trade wins. Cortexa is designed to improve consistency, not guarantee profits.
            </p>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: C.accent }}>How It Works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              From market noise to structured trade setups
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: C.t2 }}>
              Cortexa uses a deliberate pipeline to turn raw market movement into filtered, explainable trade ideas.
            </p>
          </FadeIn>

          <div className="mt-14 grid gap-4 lg:grid-cols-5">
            {PIPELINE.map((item, index) => (
              <FadeIn key={item.title} delay={index * 0.06}>
                <div
                  className="h-full rounded-2xl p-5"
                  style={{ border: `1px solid ${C.border}`, background: C.surface }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.26em]"
                    style={{ color: C.accent }}
                  >
                    {item.step}
                  </p>
                  <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: C.t2 }}>
                    {item.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── RECENT SIGNALS ───────────────────────────────────────────── */}
      <section id="recent-signals" className="py-24" style={{ borderTop: `1px solid ${C.border}`, background: C.base }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: C.accent }}>Recent Signals</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Clear levels. Clear reasoning. Clear outcomes.
              </h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: C.t2 }}>
                Each setup is presented with direction, price levels, confidence, and the reasoning behind it.
              </p>
            </div>
            <div
              className="shrink-0 rounded-xl px-4 py-3"
              style={{ border: `1px solid ${C.border}`, background: C.surface }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: C.t3 }}>
                Operating principle
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-200">Fewer signals, better filtering</p>
            </div>
          </FadeIn>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {RECENT_SIGNALS.map((signal, index) => (
              <FadeIn key={`${signal.asset}-${signal.entry}-${signal.direction}`} delay={index * 0.06}>
                <div
                  className="rounded-2xl p-5"
                  style={{ border: `1px solid ${C.border}`, background: C.surface }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: C.t3 }}>
                        {signal.asset}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">{signal.direction}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={
                          signal.direction === 'LONG'
                            ? { border: '1px solid rgba(52,211,153,0.22)', background: 'rgba(16,185,129,0.08)', color: '#6ee7b7' }
                            : { border: '1px solid rgba(248,113,113,0.22)', background: 'rgba(248,113,113,0.08)', color: '#fca5a5' }
                        }
                      >
                        {signal.result}
                      </span>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ border: `1px solid ${C.border}`, background: C.deep, color: '#94a3b8' }}
                      >
                        {signal.confidence} conf.
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Entry', value: signal.entry, color: '#e2e8f0' },
                      { label: 'Take Profit', value: signal.takeProfit, color: '#34d399' },
                      { label: 'Stop Loss', value: signal.stopLoss, color: '#f87171' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl p-4"
                        style={{ border: `1px solid ${C.border}`, background: C.deep }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.t3 }}>
                          {item.label}
                        </p>
                        <p className="mt-2 text-base font-semibold" style={{ color: item.color }}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div
                    className="mt-4 rounded-xl p-4"
                    style={{ border: `1px solid ${C.border}`, background: C.deep }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: C.t3 }}>
                      Why this trade?
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                      {signal.reasons.map((reason) => (
                        <li key={reason} className="flex items-start gap-2.5">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: C.accent }} />
                          <span style={{ color: '#94a3b8' }}>{reason}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#34d399' }}>
                        AI validation: confirmed
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="mt-8 rounded-2xl px-6 py-5" style={{ border: `1px solid ${C.border}`, background: C.surface }}>
            <p className="text-sm leading-relaxed" style={{ color: C.t3 }}>
              Every setup includes defined levels, structured reasoning, and a clear outcome. Some trades reach target. Some do not. The goal is disciplined, repeatable decision support — not black-box signal delivery.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── PERFORMANCE ──────────────────────────────────────────────── */}
      <section className="py-24" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-8">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: C.accent }}>
              Strategy Performance
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Data-backed expectations,<br />not cherry-picked numbers
            </h2>
            <p className="mt-5 text-base leading-relaxed" style={{ color: C.t2 }}>
              Cortexa is designed around consistency, selectivity, and risk-defined execution. The goal is steady decision quality over time — not short-term perfection.
            </p>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: C.t3 }}>
              Performance varies based on market conditions. Equity curve focus: measured growth over time with controlled downside, not isolated winning streaks.
            </p>
          </FadeIn>

          <div className="grid gap-4 sm:grid-cols-2">
            {PERFORMANCE_METRICS.map((metric, index) => (
              <FadeIn key={metric.label} delay={index * 0.06}>
                <div
                  className="h-full rounded-2xl p-6"
                  style={{ border: `1px solid ${C.border}`, background: C.surface }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: C.t3 }}>
                    {metric.label}
                  </p>
                  <p className="mt-5 text-3xl font-semibold text-white">{metric.value}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES ────────────────────────────────────────────── */}
      <section className="py-24" style={{ borderTop: `1px solid ${C.border}`, background: C.base }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: C.accent }}>Core Features</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Simple product shape. Practical trade support.
            </h2>
          </FadeIn>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {CORE_FEATURES.map((feature, index) => (
              <FadeIn key={feature.title} delay={index * 0.06}>
                <div
                  className="h-full rounded-2xl p-6"
                  style={{ border: `1px solid ${C.border}`, background: C.surface }}
                >
                  <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed" style={{ color: C.t2 }}>
                    {feature.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── NOT A BLACK BOX ──────────────────────────────────────────── */}
      <section className="py-24" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: C.accent }}>
              Not A Black Box
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Structured logic first. AI validation second.
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: C.t2 }}>
              Signals are built from indicators, filters, and validation layers. AI validates trade setups and adds reasoning — it does not blindly predict the market.
            </p>
          </FadeIn>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                title: 'Indicators',
                body: 'EMA alignment, RSI structure, ADX trend strength, and volume behavior create the initial setup logic.',
              },
              {
                title: 'Filters',
                body: 'Low-quality conditions are filtered out so the system stays selective instead of pushing every possible alert.',
              },
              {
                title: 'Validation',
                body: 'AI is used to validate whether the setup is coherent in context and to explain why the trade exists before you act on it.',
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.06}>
                <div
                  className="h-full rounded-2xl p-6"
                  style={{ border: `1px solid ${C.border}`, background: C.surface }}
                >
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed" style={{ color: C.t2 }}>{item.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn
            className="mt-8 rounded-2xl p-5 text-center"
            style={{ border: '1px solid rgba(16,185,129,0.16)', background: 'rgba(16,185,129,0.04)' }}
          >
            <p className="text-base font-medium" style={{ color: '#a7f3d0' }}>
              You always know why a trade exists.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── DIFFERENTIATION ──────────────────────────────────────────── */}
      <section className="py-24" style={{ borderTop: `1px solid ${C.border}`, background: C.base }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: C.accent }}>Why Cortexa AI</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Selectivity over signal spam
            </h2>
          </FadeIn>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {DIFFERENTIATION.map((column, index) => (
              <FadeIn key={column.label} delay={index * 0.08}>
                <div
                  className="rounded-2xl p-6"
                  style={
                    column.highlight
                      ? { border: '1px solid rgba(16,185,129,0.22)', background: C.surface }
                      : { border: `1px solid ${C.border}`, background: C.surface }
                  }
                >
                  <div className="flex items-center gap-2.5 mb-5">
                    {column.highlight && (
                      <span className="h-2 w-2 rounded-full" style={{ background: C.accent }} />
                    )}
                    <h3
                      className="text-base font-semibold"
                      style={{ color: column.highlight ? '#6ee7b7' : C.t2 }}
                    >
                      {column.label}
                    </h3>
                  </div>
                  <div className="space-y-2.5">
                    {column.points.map((point) => (
                      <div
                        key={point}
                        className="rounded-xl px-4 py-3 text-sm"
                        style={
                          column.highlight
                            ? { border: '1px solid rgba(16,185,129,0.1)', background: C.deep, color: '#94a3b8' }
                            : { border: `1px solid ${C.border}`, background: C.deep, color: C.t3 }
                        }
                      >
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="mt-8 rounded-2xl px-6 py-5" style={{ border: `1px solid ${C.border}`, background: C.surface }}>
            <p className="text-sm leading-relaxed" style={{ color: C.t3 }}>
              Cortexa AI is not an automated trading bot. It is a trading intelligence layer for people who want sharper decisions, better filtering, and clearer execution plans.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="py-24" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="mx-auto max-w-2xl px-6 lg:px-8">
          <FadeIn className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: C.accent }}>FAQ</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Transparent by design
            </h2>
          </FadeIn>

          <div className="space-y-2">
            {FAQS.map((faq, index) => (
              <FadeIn key={faq.q} delay={index * 0.04}>
                <div
                  className="rounded-2xl transition-all duration-300"
                  style={
                    openFaq === index
                      ? { border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.04)' }
                      : { border: `1px solid ${C.border}`, background: C.surface }
                  }
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  >
                    <span className="text-sm font-semibold text-slate-100">{faq.q}</span>
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4 shrink-0 transition-transform duration-300"
                      style={{
                        color: C.accent,
                        transform: openFaq === index ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === index && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-5 text-sm leading-relaxed" style={{ color: C.t2 }}>{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ──────────────────────────────────────────────── */}
      <section className="py-24" style={{ borderTop: `1px solid ${C.border}`, background: C.base }}>
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <FadeIn>
            <div
              className="relative overflow-hidden rounded-2xl p-10"
              style={{
                border: `1px solid ${C.border}`,
                background: C.surface,
                boxShadow: '0 0 80px -20px rgba(16,185,129,0.08)',
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.06) 0%, transparent 70%)',
                }}
              />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: C.accent }}>
                  Explore Cortexa AI
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  See how a structured signal should look
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: C.t2 }}>
                  Explore recent setups, understand the logic behind them, and evaluate the system with realistic expectations.
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => scrollTo('recent-signals')}
                    className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110"
                    style={{ background: C.accent }}
                  >
                    Explore Signals
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollTo('how-it-works')}
                    className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200 hover:text-white"
                    style={{ border: `1px solid ${C.border}`, color: '#94a3b8', background: 'transparent' }}
                  >
                    Understand the System
                  </button>
                </div>

                <p className="mt-6 text-xs leading-relaxed" style={{ color: C.border }}>
                  Trading involves risk. Cortexa AI provides decision-support tools for educational and analytical use. Users remain responsible for execution and risk management.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="py-10" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: C.accent }}
            >
              C
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Cortexa AI</p>
              <p className="text-xs" style={{ color: C.t3 }}>Trading intelligence, not false certainty.</p>
            </div>
          </div>

          <p className="max-w-md text-sm leading-relaxed" style={{ color: C.t3 }}>
            Not financial advice. Performance varies based on market conditions. Disciplined risk management matters more than any signal.
          </p>

          <div className="flex gap-5 text-sm" style={{ color: C.t3 }}>
            <Link to="/pulse" className="transition-colors duration-200 hover:text-slate-300">Pulse</Link>
            <Link to="/register" className="transition-colors duration-200 hover:text-slate-300">Register</Link>
            <Link to="/login" className="transition-colors duration-200 hover:text-slate-300">Log In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
