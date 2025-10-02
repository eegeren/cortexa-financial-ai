import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPortfolio, fetchSignal, PortfolioResponse, SignalResponse } from '@/services/api';
import { useToast } from '@/components/ToastProvider';

type Metric = {
  label: string;
  hint?: string;
  value: string;
};

const DashboardPage = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [signal, setSignal] = useState<SignalResponse | null>(null);
  const [signalLoading, setSignalLoading] = useState(true);
  const { pushToast } = useToast();

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        const data = await fetchPortfolio();
        setPortfolio({ ...data, trades: data.trades ?? [] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load portfolio';
        setPortfolioError(message);
      } finally {
        setPortfolioLoading(false);
      }
    };

    loadPortfolio();
  }, []);

  useEffect(() => {
    let alive = true;

    const loadSignal = async () => {
      try {
        const latest = await fetchSignal('BTCUSDT');
        if (!alive) {
          return;
        }
        setSignal(latest);
      } catch (error) {
        if (alive) {
          const message = error instanceof Error ? error.message : 'Unable to load signal snapshot';
          pushToast(message, 'warning');
        }
      } finally {
        if (alive) {
          setSignalLoading(false);
        }
      }
    };

    void loadSignal();
    const timer = window.setInterval(loadSignal, 300000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [pushToast]);

  const metrics = useMemo<Metric[]>(() => {
    if (!portfolio || portfolioLoading) {
      return [];
    }

    const trades = (portfolio.trades ?? []).slice().sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
    const tradeCount = trades.length;
    const realised = trades.reduce((acc, trade) => acc + trade.qty * trade.price, 0);
    const lastTrade = trades[trades.length - 1];
    const netExposure = trades.reduce((acc, trade) => {
      const direction = trade.side === 'BUY' ? 1 : -1;
      return acc + direction * trade.qty * trade.price;
    }, 0);

    const formatCurrency = (amount: number) =>
      `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`;

    return [
      {
        label: 'Portfolio value',
        value: formatCurrency((portfolio.total_value ?? 0) + netExposure),
        hint: 'Mark-to-market with current exposure'
      },
      {
        label: 'Open exposure',
        value: formatCurrency(netExposure),
        hint: tradeCount ? 'Net of recent executions' : 'No trades yet'
      },
      {
        label: 'Completed trades',
        value: tradeCount.toString(),
        hint: lastTrade ? `Last trade ${new Date(lastTrade.created_at ?? '').toLocaleString()}` : 'Awaiting executions'
      },
      {
        label: 'Realised turnover',
        value: formatCurrency(realised),
        hint: 'Cumulative notional volume'
      }
    ];
  }, [portfolio, portfolioLoading]);

  const signalBadge = useMemo(() => {
    if (!signal) {
      return { label: 'No data', tone: 'bg-muted text-slate-300 border-outline/50' };
    }
    if (signal.side === 'BUY') {
      return { label: 'Buy bias', tone: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40' };
    }
    if (signal.side === 'SELL') {
      return { label: 'Sell bias', tone: 'bg-rose-500/10 text-rose-200 border-rose-500/40' };
    }
    return { label: 'Neutral', tone: 'bg-amber-500/10 text-amber-200 border-amber-500/40' };
  }, [signal]);

  return (
    <div className="space-y-14">
      <section className="rounded-3xl border border-outline/40 bg-surface/70 p-8 shadow-elevation-soft backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-outline/60 bg-surface/70 px-3 py-1 text-xs uppercase tracking-[0.4em] text-slate-400">
              Cortexa overview
            </span>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Steer your trading desk with real-time AI intelligence.</h1>
            <p className="max-w-2xl text-base text-slate-300">
              Monitor portfolio posture, review the freshest signals, and deploy automation from a single pane of glass. Everything stays synced with the assistant and signal engine.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/signals"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-elevation transition hover:bg-primary/90"
              >
                View live signals
              </Link>
              <Link
                to="/assistant"
                className="inline-flex items-center gap-2 rounded-full border border-outline/50 px-4 py-2 text-sm font-medium text-ink transition hover:border-outline hover:text-white"
              >
                Talk to the assistant
              </Link>
            </div>
          </div>
          <div className="relative w-full max-w-sm self-stretch overflow-hidden rounded-2xl border border-outline/30 bg-surface/80 p-6 shadow-inner-glow">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.25),_transparent_65%)] opacity-70" />
            <div className="relative space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Desk activity</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Active automation</span>
                  <span className="text-white">{portfolio?.automation?.active_bots ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Alerts armed</span>
                  <span className="text-white">{portfolio?.alerts?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Assistant threads</span>
                  <span className="text-white">{portfolio?.assistant_threads ?? 0}</span>
                </div>
              </div>
              <Link
                to="/forum"
                className="inline-flex items-center gap-2 text-xs font-medium text-accent transition hover:text-white"
              >
                Browse desk playbooks →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Key posture metrics</h2>
            <p className="text-sm text-slate-400">Live snapshot of exposure, turnover, and execution velocity.</p>
          </div>
          {!portfolioLoading && portfolioError && (
            <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
              {portfolioError}
            </span>
          )}
        </header>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {portfolioLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-32 rounded-2xl border border-outline/30 bg-surface/60 shadow-inner-glow animate-pulse"
                />
              ))
            : metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="flex h-32 flex-col justify-between rounded-2xl border border-outline/30 bg-surface/80 p-5 shadow-inner-glow"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{metric.label}</p>
                    <p className="mt-3 text-lg font-semibold text-white">{metric.value}</p>
                  </div>
                  {metric.hint && <p className="text-xs text-slate-400">{metric.hint}</p>}
                </div>
              ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Live signal stream</h3>
              <p className="text-sm text-slate-400">Stay ahead with the freshest opportunities from the signal engine.</p>
            </div>
            <div className="flex items-center gap-2">
              {['Crypto', 'FX', 'Equities'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-outline/40 px-3 py-1 text-xs text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <div className="mt-6 flex flex-col gap-4">
            {signalLoading ? (
              <div className="h-36 rounded-2xl border border-outline/30 bg-surface/60 shadow-inner-glow animate-pulse" />
            ) : signal ? (
              <article className="rounded-2xl border border-outline/30 bg-surface/80 p-6 shadow-inner-glow">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${signalBadge.tone}`}>
                      {signalBadge.label}
                    </span>
                    <p className="text-sm text-slate-400">Confidence {Math.round(signal.confidence * 100)}%</p>
                  </div>
                  <Link to="/signals" className="text-xs font-medium text-accent transition hover:text-white">
                    View full stream →
                  </Link>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold text-white">{signal.symbol}</h4>
                    <p className="text-sm text-slate-300">Signal horizon: {signal.horizon}</p>
                    <p className="text-sm text-slate-300">Suggested allocation: {signal.suggested_allocation ?? '—'}</p>
                  </div>
                  <div className="space-y-3 text-sm text-slate-300">
                    <p>Entry: {signal.entry_price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'}</p>
                    <p>Take profit: {signal.take_profit?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'}</p>
                    <p>Stop loss: {signal.stop_loss?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'}</p>
                  </div>
                </div>
              </article>
            ) : (
              <div className="rounded-2xl border border-outline/30 bg-surface/70 p-6 text-sm text-slate-300">
                No signals available right now. Check back shortly or explore archived opportunities in the signals library.
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
            <h4 className="text-lg font-semibold text-white">Automation snapshot</h4>
            <p className="mt-2 text-sm text-slate-400">Track the health of backtests, webhooks, and live bots.</p>
            <div className="mt-5 space-y-4 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Backtests scheduled</span>
                <span className="text-white">{portfolio?.automation?.scheduled_runs ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Webhook triggers</span>
                <span className="text-white">{portfolio?.webhooks?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Auto-trade status</span>
                <span className="text-white">{portfolio?.automation?.status ?? 'Idle'}</span>
              </div>
            </div>
            <Link
              to="/signals"
              className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-accent transition hover:text-white"
            >
              Configure automation →
            </Link>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
            <h4 className="text-lg font-semibold text-white">Learning highlights</h4>
            <p className="mt-2 text-sm text-slate-400">Curated research and forum threads to sharpen your playbooks.</p>
            <ul className="mt-4 space-y-3 text-sm text-accent">
              <li>
                <Link to="/forum" className="transition hover:text-white">
                  Macro briefing: October volatility regimes →
                </Link>
              </li>
              <li>
                <Link to="/forum" className="transition hover:text-white">
                  Community playbook: BTC breakout ladder template →
                </Link>
              </li>
              <li>
                <Link to="/assistant" className="transition hover:text-white">
                  Assistant prompt pack: execution checklists →
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default DashboardPage;
