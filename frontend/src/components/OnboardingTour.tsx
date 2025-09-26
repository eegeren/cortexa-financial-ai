import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/auth';

const STORAGE_KEY = 'cortexa.onboarding.v1';

const OnboardingTour = () => {
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const role = useAuthStore((state) => state.role);

  const steps = useMemo(
    () => [
      {
        title: 'Welcome to Cortexa Trade',
        description:
          'Your dashboard surfaces curated market intelligence as soon as you log in. Use the highlights to track positions and live alpha without leaving the command center.',
        bullet: 'Dashboard shows KPIs, market context, and your recent executions at a glance.'
      },
      {
        title: 'AI Signals & Auto-Trade',
        description:
          'Navigate to Signals to pull the latest AI scoring for major pairs. Automatic SL/TP suggestions and score-based filtering help you act with conviction.',
        bullet: 'Trigger auto-trade with guardrails or inspect backtests (admin only) to validate conviction.'
      },
      {
        title: 'Portfolio Control',
        description:
          'Manage open positions and run what-if scenarios directly from Portfolio. Manual trades and historical allocations stay synced with the AI engine.',
        bullet: 'Review trade history, unrealised PnL, and rebalance in a few clicks.'
      },
      {
        title: 'Pro Tips',
        description:
          'Keep an eye on volatility regimes, tune thresholds cautiously, and lean on score calibration to decide when to size up. The system is most effective when combined with your risk plan.',
        bullet: role === 'admin'
          ? 'Admins can run parameter sweeps and share findings with the desk before going live.'
          : 'Need deeper analytics? Reach out to the desk for shared backtest insights tailored to your profile.'
      }
    ],
    [role]
  );

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hydrated || !token) {
      setVisible(false);
      setStep(0);
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const timeout = window.setTimeout(() => setVisible(true), 350);
      return () => window.clearTimeout(timeout);
    }
  }, [hydrated, token]);

  useEffect(() => {
    if (!visible) {
      setStep(0);
    }
  }, [visible]);

  const markSeen = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
  };

  const handleSkip = () => {
    markSeen();
    setVisible(false);
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    markSeen();
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  const active = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[10%] top-[15%] h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-[15%] bottom-[20%] h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
      </div>
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-700/80 bg-slate-900/95 p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.45em] text-slate-500">
            Step {step + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-medium uppercase tracking-wide text-slate-400 transition hover:text-slate-100"
          >
            Skip tutorial
          </button>
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-white">{active.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{active.description}</p>
        <div className="mt-5 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 text-sm text-slate-200">
          <span className="font-medium text-primary">• </span>
          {active.bullet}
        </div>
        <div className="mt-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-6 rounded-full transition ${
                  index <= step ? 'bg-primary' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/80"
          >
            {step === steps.length - 1 ? 'Start trading' : 'Next' }
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
