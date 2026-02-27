import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
}

const PROGRESS_DURATION = 2400; // ms the bar takes to fill
const EXIT_DELAY       = 2300; // ms before fade-out starts
const DONE_DELAY       = 2800; // ms before component unmounts

const FEATURES = ['Signal Engine', 'AI Assistant', 'Portfolio Analytics'];

const SplashScreen = ({ onDone }: SplashScreenProps) => {
  const [progress, setProgress]   = useState(0);
  const [exiting, setExiting]     = useState(false);
  const [visible, setVisible]     = useState(false); // slight delay so CSS transition fires

  useEffect(() => {
    // tiny RAF delay lets CSS transition register from 0 → 100
    const kickProgress = requestAnimationFrame(() =>
      setTimeout(() => { setProgress(100); setVisible(true); }, 80)
    );
    const exitTimer = setTimeout(() => setExiting(true), EXIT_DELAY);
    const doneTimer = setTimeout(onDone, DONE_DELAY);

    return () => {
      cancelAnimationFrame(kickProgress);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden bg-[#0d0d0d] transition-opacity duration-500 ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* ── Ambient orbs ─────────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute -left-32 top-1/4 rounded-full blur-[140px]"
        style={{ width: 560, height: 560, background: 'rgba(16,163,127,0.18)', animation: 'orbPulse 10s ease-in-out infinite' }}
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-1/4 rounded-full blur-[140px]"
        style={{ width: 480, height: 480, background: 'rgba(43,124,255,0.13)', animation: 'orbPulse 12s ease-in-out infinite 3s' }}
      />

      {/* ── Scan line ────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        <div className="scan-line h-full w-full" />
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div
        className={`relative z-10 flex flex-col items-center gap-8 text-center transition-all duration-700 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Logo icon */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-[22px]"
            style={{ background: 'rgba(16,163,127,0.08)', boxShadow: '0 0 0 1px rgba(16,163,127,0.2), 0 0 40px rgba(16,163,127,0.12)' }}
          />
          <svg viewBox="0 0 40 40" fill="none" className="relative h-10 w-10 text-[#10A37F]" aria-hidden>
            <circle cx="20" cy="20" r="13.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 12v8.5l5 3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            {/* Decorative arc */}
            <path d="M9 24a13 13 0 009.5 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 3" opacity="0.5" />
          </svg>
        </div>

        {/* Brand */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.65em] text-slate-500">
            Cortexa
          </div>
          <h1 className="mt-1.5 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
            Trade
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            AI-powered trading signals &amp; portfolio intelligence
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {FEATURES.map((feature, i) => (
            <span
              key={feature}
              className="rounded-full border border-slate-800/80 bg-slate-900/60 px-3.5 py-1 text-xs text-slate-400 backdrop-blur"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {feature}
            </span>
          ))}
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-slate-800/60">
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #10A37F, #2B7CFF)',
            transition: `width ${PROGRESS_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          }}
        />
      </div>

      {/* ── Loading dots ─────────────────────────────────────────────── */}
      <div className="absolute bottom-6 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 w-1 rounded-full bg-slate-600"
            style={{ animation: `dotBlink 1.2s ease-in-out infinite ${i * 0.2}s` }}
          />
        ))}
      </div>

      {/* Inline keyframe for loading dots */}
      <style>{`
        @keyframes dotBlink {
          0%, 80%, 100% { opacity: 0.2; transform: scale(1); }
          40% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
