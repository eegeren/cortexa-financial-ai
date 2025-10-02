import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import { fetchPortfolio, PortfolioResponse, fetchSignal, SignalResponse } from '@/services/api';
import { Link } from 'react-router-dom';
import MetricCard from '@/components/MetricCard';
import TrendChart from '@/components/TrendChart';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/context/I18nContext';
import SubscriptionCallout from '@/components/SubscriptionCallout';
import Skeleton from '@/components/Skeleton';
import useSubscriptionAccess from '@/hooks/useSubscriptionAccess';
import LockedFeature from '@/components/LockedFeature';
import { useAuthStore } from '@/store/auth';

const MarketWidget = lazy(() => import('@/components/MarketWidget'));
const HeatmapMatrix = lazy(() => import('@/components/HeatmapMatrix'));

const DashboardPage = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestSignal, setLatestSignal] = useState<SignalResponse | null>(null);
  const [signalLoading, setSignalLoading] = useState(true);
  const { t } = useI18n();
  const { pushToast } = useToast();
  const role = useAuthStore((state) => state.role);
  const subscriptionAccess = useSubscriptionAccess();
  const premiumLocked = subscriptionAccess.initialized ? !subscriptionAccess.canAccess && role !== 'admin' : false;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchPortfolio();
        setPortfolio({ ...data, trades: data.trades ?? [] });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load portfolio';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let active = true;

    const loadSignalSnapshot = async () => {
      try {
        const data = await fetchSignal('BTCUSDT');
        if (!active) {
          return;
        }
        setLatestSignal(data);
      } catch (err) {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Signal fetch failed';
        pushToast(message, 'warning');
      } finally {
        if (active) {
          setSignalLoading(false);
        }
      }
    };

    void loadSignalSnapshot();
    const interval = window.setInterval(loadSignalSnapshot, 240000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pushToast]);

  const stats = useMemo(() => {
    if (!portfolio) {
      return null;
    }
    const trades = (portfolio.trades ?? []).slice().sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
    const tradeCount = trades.length;
    const exposures: number[] = [];
    let running = 0;
    trades.forEach((trade) => {
      const direction = trade.side === 'BUY' ? 1 : -1;
      running += direction * trade.qty * trade.price;
      exposures.push(Number.isFinite(running) ? running : 0);
    });
    const netExposure = Number.isFinite(running) ? running : 0;
    const lastTrade = trades.length ? trades[trades.length - 1] : undefined;
    const realised = trades.reduce((acc, trade) => acc + trade.qty * trade.price, 0);
    const avgTradeValue = tradeCount ? realised / tradeCount : 0;
    return { tradeCount, netExposure, lastTrade, exposures, realised, avgTradeValue };
  }, [portfolio]);

  const metricConfig = useMemo(() => {
    if (!stats) {
      return [] as Array<{
        label: string;
        value: string | number;
        accent?: 'emerald' | 'blue' | 'amber' | 'slate';
        hint?: string;
        deltaLabel?: string;
        deltaTone?: 'positive' | 'negative' | 'neutral';
      }>;
    }
    const exposureTone: 'positive' | 'negative' | 'neutral' =
      stats.netExposure > 0 ? 'positive' : stats.netExposure < 0 ? 'negative' : 'neutral';
    return [
      {
        label: 'Total trades',
        value: stats.tradeCount,
        accent: 'emerald' as const,
        hint: stats.tradeCount ? 'Completed executions' : 'No trades yet'
      },
      {
        label: 'Net exposure',
        value: `${stats.netExposure.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`,
        accent: 'blue' as const,
        deltaLabel:
          exposureTone === 'positive'
            ? 'Long skew'
            : exposureTone === 'negative'
            ? 'Short skew'
            : 'Flat',
        deltaTone: exposureTone
      },
      {
        label: 'Avg trade size',
        value: `${stats.avgTradeValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`,
        accent: 'amber' as const,
        hint: stats.tradeCount ? 'Across recent executions' : 'Awaiting executions'
      },
      {
        label: 'Realised turnover',
        value: `${stats.realised.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`,
        accent: 'slate' as const
      }
    ];
  }, [stats]);

  const isPortfolioEmpty = !loading && !error && (!stats || stats.tradeCount === 0);

  const snapshotSignalMeta = useMemo(() => {
    if (!latestSignal) {
      return null;
    }
    const side = latestSignal.side;
    if (side === 'BUY') {
      return {
        badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
        label: 'Buy bias',
        dot: 'bg-emerald-400/80'
      };
    }
    if (side === 'SELL') {
      return {
        badge: 'bg-rose-500/10 border-rose-500/30 text-rose-200',
        label: 'Sell bias',
        dot: 'bg-rose-400/80'
      };
    }
    return {
      badge: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
      label: 'Neutral',
      dot: 'bg-amber-400/80'
    };
  }, [latestSignal]);

  return (
    <div className="space-y-10">
      <PageHeader
        title={t('dashboard_overview_title')}
        description={t('dashboard_overview_description')}
        actions={
          <Link
            to="/signals"
            className="rounded-full bg-primary/80 px-4 py-2 text-sm font-medium text-slate-50 shadow-md shadow-primary/20 ring-1 ring-primary/50 transition hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            {t('view_signals')}
          </Link>
        }
      />

      <SubscriptionCallout />

      <Card className="relative overflow-hidden border border-slate-800/70 bg-slate-900/60 p-6 backdrop-blur-sm hover:border-slate-700/70 transition">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_400px_at_50%_-100px,rgba(59,130,246,0.06),transparent)]" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:w-auto">
            <p className="text-xs uppercase tracking-wide text-slate-500">Latest signal</p>
            {signalLoading ? (
              <div className="mt-3 flex items-center gap-3">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-10 w-16" />
              </div>
            ) : latestSignal ? (
              <div className="mt-2 flex items-baseline gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                    snapshotSignalMeta?.badge ?? 'border-slate-700 text-slate-200'
                  }`}
                  title={latestSignal.symbol}
                >
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${snapshotSignalMeta?.dot ?? 'bg-slate-400'}`} />
                  {latestSignal.symbol} · {snapshotSignalMeta?.label}
                </span>
                <span className="text-3xl font-semibold tracking-tight text-accent drop-shadow-sm">
                  {latestSignal.score.toFixed(2)}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No signal available yet.</p>
            )}
          </div>
          <div className="w-full lg:w-auto">
            <p className="text-xs uppercase tracking-wide text-slate-500">Most recent trade</p>
            {loading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : stats?.lastTrade ? (
              <div className="mt-2 text-sm text-slate-200">
                <p>
                  {stats.lastTrade.side} · {stats.lastTrade.symbol}
                  <span className="ml-2 text-slate-400">
                    @{stats.lastTrade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </p>
                {stats.lastTrade.created_at && (
                  <p className="text-xs text-slate-500">
                    {new Date(stats.lastTrade.created_at).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No trades recorded.</p>
            )}
          </div>
          <div className="w-full lg:w-auto">
            <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4 text-xs text-slate-300">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Playbook</p>
              <p className="mt-2 text-sm text-slate-200">
                Pair live signals with your portfolio to evaluate potential entries, then schedule automated alerts for
                thresholds you trust.
              </p>
              <button
                type="button"
                onClick={() => pushToast('Alert automation is coming soon.', 'info')}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/60 px-3 py-1 text-xs font-semibold text-accent transition hover:border-accent hover:text-white"
              >
                Schedule alert
              </button>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/signals"
            className="rounded-full bg-primary/80 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:bg-primary"
          >
            Go to signals
          </Link>
          <Link
            to="/portfolio"
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-primary hover:text-white"
          >
            View portfolio
          </Link>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card className="relative overflow-hidden border border-slate-800/70 bg-slate-900/60">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-slate-900 to-slate-950 opacity-70" />
          <div className="relative space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Portfolio snapshot</p>
                <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                  Stay on top of your positions with AI-assisted signals.
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => pushToast('Auto rebalance coming soon', 'info')}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/60 px-4 py-2 text-xs text-primary transition hover:border-primary hover:text-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-80"><path d="M4 12a8 8 0 1 1 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 12h4M4 12V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Smart Rebalance
                </button>
                <Link
                  to="/signals"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300 transition hover:border-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {t('view_signals')}
                </Link>
              </div>
            </header>
            {error && (
              <p className="text-sm text-red-400" role="status" aria-live="polite">{error}</p>
            )}
            {loading && !error && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 w-full" />
                ))}
              </div>
            )}
            {!loading && !error && stats && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {metricConfig.map((metric) => (
                    <div key={metric.label} className="transition hover:-translate-y-0.5">
                      <MetricCard
                        label={metric.label}
                        value={metric.value}
                        accent={metric.accent}
                        hint={metric.hint}
                        deltaLabel={metric.deltaLabel}
                        deltaTone={metric.deltaTone}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <Card className="border border-slate-800/70 bg-slate-900/60 p-4 backdrop-blur-sm hover:border-slate-700/70 transition">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Exposure trend</p>
                    <TrendChart values={stats.exposures.length ? stats.exposures : [0]} height={80} />
                  </Card>
                  <Card className="border border-slate-800/70 bg-slate-900/60 p-4 backdrop-blur-sm hover:border-slate-700/70 transition">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Last trade</p>
                    {stats.lastTrade ? (
                      <div className="mt-2 text-sm text-slate-200">
                        <p>
                          {stats.lastTrade.side} {stats.lastTrade.qty} {stats.lastTrade.symbol}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          @<span className="font-mono tabular-nums">{stats.lastTrade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No trades yet.</p>
                    )}
                  </Card>
                </div>
              </>
            )}
            {isPortfolioEmpty && (
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-5 text-sm text-slate-300">
                <p className="font-semibold text-slate-100">You are all set.</p>
                <p className="mt-1 text-slate-400">
                  Connect your first automated trade from the signal panel to populate portfolio analytics.
                </p>
                <Link
                  to="/signals"
                  className="mt-4 inline-flex items-center text-xs font-semibold text-primary transition hover:text-primary/80"
                >
                  Review live signals →
                </Link>
              </div>
            )}
          </div>
        </Card>

        <div className="relative z-0 space-y-6">
          {premiumLocked ? (
            <LockedFeature
              title="Live market intelligence"
              description="Upgrade to Pro to view real-time market breadth, heatmaps, and signal attributions."
            />
          ) : (
            <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
              <MarketWidget />
            </Suspense>
          )}
        </div>
      </div>

      <Card className="relative z-10 border border-slate-800/70 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-400">Regime heatmap</p>
        <div className="mt-4">
          {premiumLocked ? (
            <LockedFeature
              title="Heatmap locked"
              description="Unlock volatility and trend regime analytics with a Pro subscription."
            />
          ) : (
            <Suspense fallback={<Skeleton className="h-[260px] w-full" />}>
              <HeatmapMatrix
                rows={['Low Vol', 'Mid Vol', 'High Vol']}
                cols={['Bull', 'Neutral', 'Bear']}
                data={{
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
                }}
              />
            </Suspense>
          )}
        </div>
      </Card>

      <div className="relative z-10 grid gap-6 lg:grid-cols-3">
        <Card className="bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-slate-700/70">
          <h3 className="text-lg font-semibold text-white">Signal Engine</h3>
          <p className="mt-2 text-sm text-slate-400">
            Signals are generated from multi-timeframe trend and momentum reads. Visit the signal panel to pull the
            latest score or trigger an auto-trade when confidence exceeds your threshold.
          </p>
          <Link to="/signals" className="mt-4 inline-flex items-center text-sm text-accent hover:underline">
            {t('explore_signals')} →
          </Link>
        </Card>
        <Card className="bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-slate-700/70">
          <h3 className="text-lg font-semibold text-white">Auto Trade</h3>
          <p className="mt-2 text-sm text-slate-400">
            Configure quick automations per symbol using the threshold and quantity inputs. Trades execute instantly via
            your connected Binance credentials (if supplied) or are stored for manual execution.
          </p>
          <Link to="/portfolio" className="mt-4 inline-flex items-center text-sm text-accent hover:underline">
            {t('review_portfolio')} →
          </Link>
        </Card>
        <Card className="bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-slate-700/70">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Alerts & Actions</h3>
            <p className="text-sm text-slate-400">
              Create custom alert rules for score jumps, volatility spikes or drawdown limits.
            </p>
            <button
              type="button"
              onClick={() => pushToast('Alert workflow coming soon', 'warning')}
              className="inline-flex items-center rounded-full border border-primary/60 px-3 py-1 text-xs text-primary transition hover:border-primary hover:text-slate-50"
            >
              Configure alerts
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
