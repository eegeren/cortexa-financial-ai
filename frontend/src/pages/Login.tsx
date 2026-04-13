import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import BrandWordmark from '@/components/BrandWordmark';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

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
  const { login, googleLogin, loading, token, error, clearError } = useAuthStore((state) => ({
    login: state.login,
    googleLogin: state.googleLogin,
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
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleCredential = useCallback(async (resp: { credential: string }) => {
    try {
      await googleLogin(resp.credential);
      navigate('/overview', { replace: true });
    } catch {
      // error shown via store
    }
  }, [googleLogin, navigate]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'filled_black', size: 'large', width: googleBtnRef.current.offsetWidth || 300, text: 'continue_with', shape: 'pill' });
  }, [handleGoogleCredential]);

  useEffect(() => {
    if (token) {
      navigate('/overview', { replace: true });
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
      navigate('/overview', { replace: true });
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
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#020617] text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.09),transparent_32%),linear-gradient(180deg,#020617_0%,#06101f_48%,#020617_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-[-80px] h-72 w-72 rounded-full bg-cyan-400/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 bottom-[-60px] h-80 w-80 rounded-full bg-indigo-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl items-start justify-center px-4 py-6 sm:px-6 sm:py-10 lg:items-center lg:py-12">
        <div className="relative grid w-full items-start gap-6 sm:gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-10">
          <section className="order-2 space-y-5 sm:space-y-8 lg:order-1 lg:space-y-10">
            <div className="relative overflow-hidden rounded-[2rem] border border-outline/30 bg-slate-950/45 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-sm sm:rounded-[2.25rem] sm:p-8 lg:rounded-[2.5rem] lg:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.08),transparent_36%)]" />
              <div className="relative space-y-3 sm:space-y-4">
                <BrandWordmark className="text-sm" />
                <h1 className="max-w-xl text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
                  Sign in. Unlock signal intelligence in minutes.
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-200/80 sm:text-[15px]">
                  Live signals, disciplined automation, and a trading assistant that speaks your desk’s language.
                </p>
                <div className="pt-2">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Perspective</p>
                  <p className="mt-2 max-w-md text-base leading-7 text-slate-200">
                    Understand the market, not just the signal.
                  </p>
                </div>
              </div>
              <SparklineGraphic />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-6">
              {FEATURE_BULLETS.map((item) => (
                <div key={item.title} className="rounded-2xl border border-outline/30 bg-surface/70 p-4 text-sm text-slate-300 shadow-elevation-soft sm:rounded-3xl sm:p-5">
                  <h3 className="text-sm font-semibold text-white sm:text-base">{item.title}</h3>
                  <p className="mt-2 text-xs text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:gap-4">
              {INFO_POINTS.map((stat) => (
                <div key={stat.label} className="flex min-w-0 flex-col rounded-2xl border border-outline/30 bg-surface/60 px-3 py-3 text-center text-slate-200 sm:min-w-[120px] sm:px-5 sm:py-4">
                  <span className="text-lg font-semibold text-white sm:text-2xl">{stat.label}</span>
                  <span className="mt-1 text-[10px] uppercase tracking-wide text-slate-400 sm:text-xs">{stat.sub}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="order-1 mx-auto w-full max-w-md rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:p-6 lg:order-2 lg:max-w-none lg:rounded-3xl lg:p-8">
            <header className="mb-5 space-y-2 text-left sm:mb-6">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">Welcome back</h2>
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
              <div className="flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
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

            {GOOGLE_CLIENT_ID && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-outline/30" />
                  <span className="text-xs text-slate-500">or</span>
                  <div className="h-px flex-1 bg-outline/30" />
                </div>
                <div ref={googleBtnRef} className="w-full" />
              </div>
            )}

            <div className="mt-6 text-center text-xs text-slate-400">
              Need an account?{' '}
              <Link to="/register" className="text-accent hover:underline">
                Join Cortexa
              </Link>
            </div>

            <footer className="mt-6 space-y-2 text-xs text-slate-500 sm:mt-8">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
          <div className="relative w-full max-w-md rounded-2xl border border-outline/40 bg-surface p-5 shadow-elevation-soft sm:p-6">
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
              <div className="flex flex-col gap-2 sm:flex-row">
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
