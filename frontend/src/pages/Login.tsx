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

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => () => clearError(), [clearError]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
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
                  onChange={(event) => setEmail(event.target.value)}
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
                  onChange={(event) => setPassword(event.target.value)}
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
                <button type="button" className="text-accent hover:underline">
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
              <p>Working with an enterprise team? <span className="text-slate-300">enterprise@cortexa.ai</span></p>
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
    </div>
  );
};

export default LoginPage;
