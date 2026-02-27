import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPortfolio, fetchSignal, PortfolioResponse, SignalResponse } from '@/services/api';
import { ASSISTANT_QUICK_PROMPTS } from '@/constants/assistantPrompts';
import { useToast } from '@/components/ToastProvider';

const MarketWidget = lazy(() => import('@/components/MarketWidget'));
const HeatmapMatrix = lazy(() => import('@/components/HeatmapMatrix'));

const SUGGESTIONS = [
  { label: 'Review risk allocation across my portfolio', href: '/portfolio' },
  { label: 'Summarize this week BTC signal trend', href: '/signals' },
  { label: 'Design a new automation playbook', href: '/signals' },
  { label: 'Evaluate the performance of my last 10 trades', href: '/portfolio' },
  { label: 'Draft a hedge idea with options', href: '/assistant' },
  { label: 'Explain the current volatility regime for ETH', href: '/assistant' },
  { label: 'Build an execution checklist with the assistant', href: '/assistant' },
  { label: 'Highlight macro events I should watch', href: '/forum' },
];

const DashboardPage = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [signal, setSignal] = useState<SignalResponse | null>(null);
  const [signalLoading, setSignalLoading] = useState(true);
  const { pushToast } = useToast();

  const heatmapRows = useMemo(() => ['Low Vol', 'Mid Vol', 'High Vol'], []);
  const heatmapCols = useMemo(() => ['Bull', 'Neutral', 'Bear'], []);
  const heatmapData = useMemo(
    () => ({
      'Low Vol': {
        Bull: { label: '+1.4%', value: 0.14 },
        Neutral: { label: '+0.8%', value: 0.08 },
        Bear: { label: '-0.5%', value: -0.05 },
      },
      'Mid Vol': {
        Bull: { label: '+2.3%', value: 0.23 },
        Neutral: { label: '+1.1%', value: 0.11 },
        Bear: { label: '-1.0%', value: -0.1 },
      },
      'High Vol': {
        Bull: { label: '+3.8%', value: 0.38 },
        Neutral: { label: '+0.5%', value: 0.05 },
        Bear: { label: '-2.4%', value: -0.24 },
      },
    }),
    []
  );

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

    void loadPortfolio();
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

  const metrics = useMemo(() => {
    if (!portfolio || portfolioLoading) {
      return null;
    }

    const trades = (portfolio.trades ?? []).slice().sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
    const tradeCount = trades.length;
    const netExposure = trades.reduce((acc, trade) => {
      const direction = trade.side === 'BUY' ? 1 : -1;
      return acc + direction * trade.qty * trade.price;
    }, 0);
    const realized = trades.reduce((acc, trade) => acc + trade.qty * trade.price, 0);

    return {
      tradeCount,
      netExposure,
      realized,
      lastTrade: trades[trades.length - 1],
    };
  }, [portfolio, portfolioLoading]);

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="animate-fade-up ui-surface rounded-3xl px-6 py-8 text-center sm:px-8">
        <header className="space-y-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.45em] text-slate-400">Cortexa Trade</span>
          <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl lg:text-5xl">
            Act on signals, manage automation, keep your desk sharp.
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-300">
            Your command center for signals, automation runway, and rapid research support from the Cortexa assistant.
          </p>
        </header>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/signals" className="btn btn-primary">
            Get started
          </Link>
          <Link to="/assistant" className="btn btn-ghost">
            Open assistant
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-left text-[10px] font-medium uppercase tracking-[0.4em] text-slate-500">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          {SUGGESTIONS.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="ui-surface card-glow min-w-[220px] flex-1 rounded-2xl px-4 py-3 text-left text-sm text-slate-300 transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ASSISTANT_QUICK_PROMPTS.map((prompt) => (
            <Link
              key={prompt}
              to={`/assistant?prompt=${encodeURIComponent(prompt)}`}
              className="ui-surface card-glow rounded-2xl px-4 py-3 text-left text-sm text-slate-300 transition hover:text-white"
            >
              {prompt}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="ui-surface rounded-3xl p-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Portfolio snapshot</h3>
              <p className="text-sm text-slate-300">Portfolio data synchronized with your signal and automation workflow.</p>
            </div>
            {portfolioError && (
              <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                {portfolioError}
              </span>
            )}
          </header>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {portfolioLoading || !metrics ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 rounded-2xl border border-slate-700/40 bg-slate-900/45 animate-pulse" />
              ))
            ) : (
              <>
                <div className="rounded-2xl border border-slate-700/40 bg-slate-900/45 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Total trades</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-100">{metrics.tradeCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-700/40 bg-slate-900/45 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Net exposure</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-100">
                    {metrics.netExposure.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-700/40 bg-slate-900/45 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Realized volume</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-100">
                    {metrics.realized.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-700/40 bg-slate-900/45 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Last trade</p>
                  <p className="mt-3 text-sm text-slate-300">
                    {metrics.lastTrade
                      ? `${metrics.lastTrade.symbol} | ${metrics.lastTrade.side} | ${new Date(metrics.lastTrade.created_at ?? '').toLocaleString()}`
                      : 'No trades yet'}
                  </p>
                </div>
              </>
            )}
          </div>
        </article>

        <aside className="ui-surface rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-slate-100">BTC signal snapshot</h3>
          <p className="mt-1 text-sm text-slate-300">Latest data from the signal engine.</p>
          {signalLoading ? (
            <div className="mt-6 h-40 rounded-2xl border border-slate-700/40 bg-slate-900/45 animate-pulse" />
          ) : signal ? (
            <div className="mt-6 space-y-4 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.28em] text-slate-500">Direction</span>
                <span className="rounded-full border border-slate-600/50 px-3 py-1 text-xs text-slate-100">{signal.side}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Score</span>
                <span className="text-slate-100">{signal.score.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Confidence</span>
                <span className="text-slate-100">{signal.confidence ? `${Math.round(signal.confidence * 100)}%` : '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Targets</span>
                <span className="text-slate-100">
                  {signal.take_profit?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '-'} / {signal.stop_loss?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '-'}
                </span>
              </div>
              <Link to="/signals" className="inline-flex items-center gap-2 text-xs text-accent transition hover:text-white">
                View signals
              </Link>
            </div>
          ) : (
            <p className="mt-6 text-xs text-slate-400">No signal available right now. Check back shortly.</p>
          )}
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Suspense fallback={<div className="ui-surface h-full rounded-3xl p-6 text-sm text-slate-300">Loading market watch...</div>}>
          <MarketWidget />
        </Suspense>
        <Suspense fallback={<div className="ui-surface h-full rounded-3xl p-6 text-sm text-slate-300">Loading regime matrix...</div>}>
          <div className="ui-surface rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-slate-100">Regime matrix</h3>
            <p className="mt-1 text-sm text-slate-300">Performance overview across volatility and trend regimes.</p>
            <div className="mt-4">
              <HeatmapMatrix rows={heatmapRows} cols={heatmapCols} data={heatmapData} />
            </div>
          </div>
        </Suspense>
      </section>
    </div>
  );
};

export default DashboardPage;
