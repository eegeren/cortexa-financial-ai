import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const FEATURE_BULLETS = [
  {
    title: 'Signals that move',
    description: 'Multi-horizon AI scoring tuned on live flows and intraday regimes.'
  },
  {
    title: 'Automation locked in',
    description: 'Guardrails and webhooks keep execution disciplined across desks.'
  },
  {
    title: 'Assistant on-call',
    description: 'Summaries, playbooks, and risk sweeps delivered in seconds.'
  }
];

const INFO_POINTS = [
  {
    label: '99.9%',
    sub: 'Signal uptime'
  },
  {
    label: '24h',
    sub: 'Desk onboarding'
  },
  {
    label: '45+',
    sub: 'Markets covered'
  }
];

const SparklineGraphic = () => (
  <svg
    className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full opacity-70"
    viewBox="0 0 600 200"
    preserveAspectRatio="none"
    aria-hidden
  >
    <defs>
      <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#4ade80" stopOpacity="0.2" />
        <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
      </linearGradient>
    </defs>
    <path
      d="M0 150 C 80 120, 120 40, 200 70 C 280 100, 320 40, 400 80 C 470 118, 520 40, 600 70 L 600 200 L 0 200 Z"
      fill="url(#sparklineGradient)"
    />
    <path
      d="M0 150 C 80 120, 120 40, 200 70 C 280 100, 320 40, 400 80 C 470 118, 520 40, 600 70"
      stroke="#38bdf8"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
      opacity="0.9"
    />
  </svg>
);

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

  const mapAuthError = (err: string | null): string | null => {
    if (!err) return null;
    const e = err.toLowerCase();
    if (e.includes('no rows in result set')) {
      return 'No account was found for that email address.';
    }
    // Common alternatives
    if (e.includes('user not found')) {
      return 'No account was found for that email address.';
    }
    if (e.includes('invalid credentials') || e.includes('wrong password')) {
      return 'Incorrect email or password.';
    }
    return 'We couldn’t sign you in. Please try again.';
  };

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
    window.location.href = `mailto:info@cortexaai.net?subject=${subject}&body=${body}`;
    setResetSuccess(true);
  };

  return (
    <div className="relative min-h-screen bg-canvas text-ink">
      <video
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-40"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        src="/videoplayback.mp4"
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 bg-black/35" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-12 sm:px-6">
        <div className="relative grid w-full items-center gap-10 lg:grid-cols-[1.25fr_1fr]">
          <section className="space-y-10">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-outline/30 p-10 shadow-inner-glow">
              <video
                className="absolute inset-0 h-full w-full object-cover opacity-60"
                src="/videoplayback.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                aria-hidden
              />
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/70 via-slate-900/70 to-emerald-700/60" />
              <div className="relative space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.35em] text-slate-200">
                  Cortexa Trade
                </span>
                <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                  Sign in. Unlock signal intelligence in minutes.
                </h1>
                <p className="max-w-xl text-sm text-slate-200/80">
                  Live signals, disciplined automation, and a trading assistant that speaks your desk’s language.
                </p>
              </div>
              <SparklineGraphic />
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_BULLETS.map((item) => (
                <div key={item.title} className="rounded-3xl border border-outline/30 bg-surface/70 p-5 text-sm text-slate-300 shadow-elevation-soft">
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-xs text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              {INFO_POINTS.map((stat) => (
                <div key={stat.label} className="flex min-w-[120px] flex-col rounded-2xl border border-outline/30 bg-surface/60 px-5 py-4 text-center text-slate-200">
                  <span className="text-2xl font-semibold text-white">{stat.label}</span>
                  <span className="mt-1 text-xs uppercase tracking-wide text-slate-400">{stat.sub}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-outline/40 bg-surface/85 p-8 shadow-elevation-soft">
            <header className="mb-6 space-y-2 text-left">
              <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
              <p className="text-sm text-slate-400">Use your workspace credentials to continue.</p>
            </header>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mapAuthError(error) && (
                <p className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-sm text-rose-300">
                  {mapAuthError(error)}
                </p>
              )}
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
                  className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-3 text-sm text-ink outline-none transition focus:border-outline focus:ring-1 focus:ring-primary"
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
                  className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-3 text-sm text-ink outline-none transition focus:border-outline focus:ring-1 focus:ring-primary"
                />
              </label>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="size-4 rounded border-outline/40 bg-canvas" />
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
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
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

            <footer className="mt-8 space-y-2 text-xs text-slate-500">
              <p>
                Working with an enterprise desk?{' '}
                <a href="mailto:info@cortexaai.net" className="text-slate-300 hover:text-white">
                  info@cortexaai.net
                </a>
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span>© {new Date().getFullYear()} Cortexa Labs</span>
                <span>•</span>
                <button type="button" className="hover:text-white">Terms</button>
                <span>•</span>
                <button type="button" className="hover:text-white">Privacy</button>
              </div>
            </footer>
          </section>
        </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
          <div className="relative w-full max-w-md rounded-2xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
            <button
              type="button"
              onClick={closeResetModal}
              className="absolute right-4 top-4 text-sm text-slate-400 transition hover:text-white"
            >
              Close
            </button>
            <h3 className="text-lg font-semibold text-white">Reset your password</h3>
            <p className="mt-2 text-sm text-slate-400">
              Enter the email linked to your Cortexa account. We’ll open a draft to{' '}
              <span className="text-slate-200">info@cortexaai.net</span> so the desk can assist you.
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
                  className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-3 text-sm text-ink outline-none transition focus:border-outline focus:ring-1 focus:ring-primary"
                />
              </label>
              {resetError && <p className="text-xs text-red-400">{resetError}</p>}
              {resetSuccess && (
                <p className="rounded border border-primary/40 bg-primary/20 p-2 text-xs text-primary">
                  A mail draft has been opened. If it didn’t appear, you can reach out directly at{' '}
                  <a href="mailto:info@cortexaai.net" className="font-semibold text-white underline">
                    info@cortexaai.net
                  </a>
                  .
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
                >
                  Contact support
                </button>
                <button
                  type="button"
                  onClick={closeResetModal}
                  className="rounded-xl border border-outline/50 px-4 py-3 text-sm text-slate-300 transition hover:border-outline hover:text-white"
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
