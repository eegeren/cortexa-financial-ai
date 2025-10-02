import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const FEATURE_BULLETS = [
  'AI-tuned signals mapped across every horizon you trade',
  'Automation guardrails that execute with discipline',
  'Backtests, assistant, and portfolio analytics in one pane'
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
      <div className="pointer-events-none fixed inset-0 bg-black/30" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-outline/50 bg-surface px-4 py-2 text-xs uppercase tracking-[0.4em] text-slate-400">
            Cortexa Trade
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Sign in and stay ahead of the market curve.
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Your workspace for signals, automation, and the Cortexa assistant.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <section className="space-y-8">
            <div className="space-y-4 text-slate-300">
              <p className="text-base text-slate-200">
                Cortexa keeps your desk synced with AI-calibrated signals, execution guardrails, and instant research support.
              </p>
              <ul className="space-y-3 text-sm">
                {FEATURE_BULLETS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
                      ●
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 text-xs text-slate-500 sm:grid-cols-2">
              <div className="rounded-2xl border border-outline/40 bg-surface px-4 py-3">
                <p className="text-sm font-semibold text-white">Healthy automation</p>
                <p className="mt-1">Latency monitoring, webhook status, and auto-trade audit trail.</p>
              </div>
              <div className="rounded-2xl border border-outline/40 bg-surface px-4 py-3">
                <p className="text-sm font-semibold text-white">Assistant insights</p>
                <p className="mt-1">Summaries, prompts, and backtests delivered in seconds.</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-outline/40 bg-surface p-8 shadow-elevation-soft">
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
