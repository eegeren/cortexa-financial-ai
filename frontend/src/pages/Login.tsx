import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const FEATURE_BULLETS = [
  'AI-powered multi-timeframe signals tuned to market volatility',
  'Automated execution with granular risk guardrails',
  'Instant backtesting to validate every idea in seconds'
];

const STAT_CARDS = [
  { label: 'Avg. win rate', value: '64%', description: '12-month walk-forward tests' },
  { label: 'Integrations', value: 'Binance', description: 'Spot & futures connectivity' }
];

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, loading, token, error, clearError } = useAuthStore((state) => ({
    login: state.login,
    loading: state.loading,
    token: state.token,
    error: state.error,
    clearError: state.clearError
  }));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => () => clearError(), [clearError]);

  const closeResetModal = () => {
    setForgotOpen(false);
    setResetEmail('');
    setResetError(null);
    setResetSuccess(false);
  };

  useEffect(() => {
    if (!forgotOpen) {
      setResetEmail('');
      setResetError(null);
      setResetSuccess(false);
    }
  }, [forgotOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleForgotSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetError(null);
    const trimmed = resetEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setResetError('Please enter a valid email address.');
      return;
    }
    const subject = encodeURIComponent('Cortexa password reset request');
    const body = encodeURIComponent(`Hello Cortexa team,\n\nPlease help me reset the password for the account associated with ${trimmed}.\n\nThanks.`);
    window.location.href = `mailto:yusufegeeren@cortexaai.net?subject=${subject}&body=${body}`;
    setResetSuccess(true);
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        {/* --- Dynamic background: subtle trading video + animated charts --- */}
       <video
        className="absolute inset-0 h-full w-full object-cover opacity-10"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        src="/videoplayback.mp4"
        aria-hidden
        />

        <svg
          className="absolute inset-0 h-full w-full opacity-25"
          viewBox="0 0 1200 600"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="gradBull" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.0" />
              <stop offset="25%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="75%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradAcc" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.0" />
              <stop offset="25%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="75%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Rising primary line */}
          <polyline
            points="0,520 80,500 160,480 240,490 320,460 400,430 480,445 560,410 640,390 720,360 800,372 880,340 960,320 1040,300 1120,280 1200,260"
            fill="none"
            stroke="url(#gradBull)"
            strokeWidth="3"
            filter="url(#glow)"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ strokeDasharray: 1600, strokeDashoffset: 1600, animation: 'dash 8s ease-in-out infinite' }}
          />

          {/* Acceleration overlay */}
          <polyline
            points="0,560 100,555 200,545 300,540 400,525 500,515 600,505 700,490 800,470 900,455 1000,440 1100,430 1200,420"
            fill="none"
            stroke="url(#gradAcc)"
            strokeWidth="2"
            style={{ strokeDasharray: 1400, strokeDashoffset: 1400, animation: 'dash 10s ease-in-out infinite 0.6s' }}
          />

          {/* Subtle grid */}
          <g stroke="#0f172a" strokeOpacity="0.6" strokeWidth="1">
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={600} />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 60} x2={1200} y2={i * 60} />
            ))}
          </g>

          <style>
            {`
              @keyframes dash {
                0% { stroke-dashoffset: 1600; opacity: .0; }
                10% { opacity: .75; }
                60% { stroke-dashoffset: 0; opacity: .85; }
                100% { stroke-dashoffset: 0; opacity: .2; }
              }
            `}
          </style>
        </svg>
        <div className="absolute -top-40 right-[-20%] h-[520px] w-[520px] rounded-full bg-primary/30 blur-3xl"></div>
        <div className="absolute left-[-10%] bottom-[-20%] h-[420px] w-[420px] rounded-full bg-accent/20 blur-3xl"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.08),_transparent_60%)]"></div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center lg:gap-20">
        <section className="w-full text-center lg:w-1/2 lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-primary/80">
            Cortexa Trade AI
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Trust your crypto strategy in seconds with AI-calibrated signals.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-300">
            Cortexa scans across multiple timeframes and volatility regimes to deliver high-confidence trade ideas. Validate every signal via auto-trade and the built-in backtesting engine.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURE_BULLETS.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
                <span className="mt-1 inline-flex size-6 items-center justify-center rounded-full bg-primary/20 text-sm text-primary">◆</span>
                <p className="text-sm text-slate-200">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-400">
            {STAT_CARDS.map((stat) => (
              <div key={stat.label} className="rounded-full border border-slate-800/60 bg-slate-900/40 px-5 py-2">
                <span className="font-semibold text-slate-200">{stat.value}</span>
                <span className="ml-2 text-slate-400">{stat.label}</span>
                <span className="ml-2 text-xs text-slate-500">{stat.description}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full lg:w-5/12">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-8 shadow-2xl shadow-primary/10 backdrop-blur">
            <header className="mb-6 space-y-2 text-center lg:text-left">
              <h2 className="text-2xl font-semibold text-white">Sign in to your workspace</h2>
              <p className="text-sm text-slate-400">
                Access the Cortexa control center to monitor signals and orchestrate automated trades.
              </p>
            </header>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="rounded border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">{error}</p>}
              <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="email">
                Email address
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    if (error) {
                      clearError();
                    }
                    setEmail(event.target.value);
                  }}
                  required
                  autoComplete="email"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/80 focus:ring-1 focus:ring-primary/50"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="password">
                Password
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    if (error) {
                      clearError();
                    }
                    setPassword(event.target.value);
                  }}
                  required
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/80 focus:ring-1 focus:ring-primary/50"
                />
              </label>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="size-4 rounded border-slate-700 bg-slate-900" />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-accent hover:underline"
                >
                  Forgot password
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
              Need an account?{' '}
              <Link to="/register" className="text-accent hover:underline">
                Join Cortexa
              </Link>
            </div>

            <footer className="mt-8 space-y-3 text-xs text-slate-500">
              <p>Working with an enterprise team? <span className="text-slate-300">yusufegeeren@cortexaai.net</span></p>
              <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500">
                <span>© {new Date().getFullYear()} Cortexa Labs</span>
                <span>•</span>
                <button type="button" className="hover:text-slate-300">Terms</button>
                <span>•</span>
                <button type="button" className="hover:text-slate-300">Privacy</button>
              </div>
            </footer>
          </div>
        </section>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800/70 bg-slate-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeResetModal}
              className="absolute right-4 top-4 text-sm text-slate-400 transition hover:text-slate-200"
            >
              Close
            </button>
            <h3 className="text-lg font-semibold text-white">Reset your password</h3>
            <p className="mt-2 text-sm text-slate-400">
              Enter the email linked to your Cortexa account. We’ll open a mail draft to{' '}
              <span className="text-slate-200">yusufegeeren@cortexaai.net</span> so the desk can assist you.
            </p>
            <form onSubmit={handleForgotSubmit} className="mt-4 space-y-4">
              <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="reset-email">
                Account email
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/80 focus:ring-1 focus:ring-primary/50"
                />
              </label>
              {resetError && <p className="text-xs text-red-400">{resetError}</p>}
              {resetSuccess && (
                <p className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-200">
                  A mail draft has been opened. If it didn’t appear, you can reach out directly at
                  {' '}
                  <a href="mailto:yusufegeeren@cortexaai.net" className="font-semibold text-emerald-100 underline">
                    yusufegeeren@cortexaai.net
                  </a>
                  .
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/80"
                >
                  Contact support
                </button>
                <button
                  type="button"
                  onClick={closeResetModal}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 transition hover:border-primary hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
