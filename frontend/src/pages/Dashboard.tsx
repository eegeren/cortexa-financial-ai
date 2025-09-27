import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Spinner from '@/components/Spinner';
import { fetchPortfolio, PortfolioResponse, fetchSignal, SignalResponse } from '@/services/api';
import { Link } from 'react-router-dom';
import MarketWidget from '@/components/MarketWidget';
import MetricCard from '@/components/MetricCard';
import TrendChart from '@/components/TrendChart';
import HeatmapMatrix from '@/components/HeatmapMatrix';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/context/I18nContext';
import SubscriptionCallout from '@/components/SubscriptionCallout';

const DashboardPage = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestSignal, setLatestSignal] = useState<SignalResponse | null>(null);
  const [signalLoading, setSignalLoading] = useState(true);
  const { t } = useI18n();
  const { pushToast } = useToast();

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
        const message = err instanceof Error ? err.message : 'Sinyal okuması başarısız';
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
      exposures.push(running);
    });
    const netExposure = running;
    const lastTrade = trades.length ? trades[trades.length - 1] : undefined;
    const realised = trades.reduce((acc, trade) => acc + trade.qty * trade.price, 0);
    const avgTradeValue = tradeCount ? realised / tradeCount : 0;
    return { tradeCount, netExposure, lastTrade, exposures, realised, avgTradeValue };
  }, [portfolio]);

  const snapshotSignalMeta = useMemo(() => {
    if (!latestSignal) {
      return null;
    }
    const side = latestSignal.side;
    if (side === 'BUY') {
      return {
        badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
        label: 'Al sinyali'
      };
    }
    if (side === 'SELL') {
      return {
        badge: 'bg-rose-500/10 border-rose-500/30 text-rose-200',
        label: 'Sat sinyali'
      };
    }
    return {
      badge: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
      label: 'Nötr'
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
            className="rounded-full bg-primary/80 px-4 py-2 text-sm font-medium text-slate-50 shadow hover:bg-primary"
          >
            {t('view_signals')}
          </Link>
        }
      />

      <SubscriptionCallout />

      <Card className="border border-slate-800/70 bg-slate-900/60 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Son sinyal</p>
            {signalLoading ? (
              <p className="mt-2 text-sm text-slate-500">Yükleniyor…</p>
            ) : latestSignal ? (
              <div className="mt-2 flex items-baseline gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    snapshotSignalMeta?.badge ?? 'border-slate-700 text-slate-200'
                  }`}
                >
                  {latestSignal.symbol} · {snapshotSignalMeta?.label}
                </span>
                <span className="text-2xl font-semibold text-accent">
                  {latestSignal.score.toFixed(2)}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Henüz sinyal alınamadı.</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Son işlem</p>
            {stats?.lastTrade ? (
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
              <p className="mt-2 text-sm text-slate-500">Kayıtlı işlem bulunmuyor.</p>
            )}
          </div>
          <div className="space-y-1 text-xs text-slate-400">
            <p>Toplam işlem: <span className="font-semibold text-slate-100">{stats?.tradeCount ?? 0}</span></p>
            <p>
              Net pozisyon:{' '}
              <span className="font-semibold text-slate-100">
                {(stats?.netExposure ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
              </span>
            </p>
            <p>
              Ortalama işlem hacmi:{' '}
              <span className="font-semibold text-slate-100">
                {(stats?.avgTradeValue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
              </span>
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/signals"
            className="rounded-full bg-primary/80 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:bg-primary"
          >
            Sinyallere git
          </Link>
          <Link
            to="/portfolio"
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-primary hover:text-white"
          >
            Portföyü görüntüle
          </Link>
          <button
            type="button"
            onClick={() => pushToast('Alarm otomasyonu yakında eklenecek.', 'info')}
            className="rounded-full border border-accent/60 px-4 py-2 text-xs font-semibold text-accent transition hover:border-accent hover:text-white"
          >
            Alarm planla
          </button>
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
                  className="rounded-full border border-primary/60 px-4 py-2 text-xs text-primary transition hover:border-primary hover:text-slate-50"
                >
                  Smart Rebalance
                </button>
                <Link
                  to="/signals"
                  className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300 transition hover:border-primary hover:text-white"
                >
                  {t('view_signals')}
                </Link>
              </div>
            </header>
            {loading && <Spinner />}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {!loading && !error && stats && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Total trades" value={stats.tradeCount} accent="emerald" />
                  <MetricCard
                    label="Net exposure"
                    value={`${stats.netExposure.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`}
                    accent="blue"
                  />
                  <MetricCard
                    label="Avg trade size"
                    value={`${stats.avgTradeValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`}
                    accent="amber"
                  />
                  <MetricCard
                    label="Realised turnover"
                    value={`${stats.realised.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`}
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <Card className="border border-slate-800/70 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Exposure trend</p>
                    <TrendChart values={stats.exposures.length ? stats.exposures : [0]} height={80} />
                  </Card>
                  <Card className="border border-slate-800/70 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Last trade</p>
                    {stats.lastTrade ? (
                      <div className="mt-2 text-sm text-slate-200">
                        <p>
                          {stats.lastTrade.side} {stats.lastTrade.qty} {stats.lastTrade.symbol}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          @{stats.lastTrade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No trades yet.</p>
                    )}
                  </Card>
                </div>
              </>
            )}
          </div>
        </Card>

        <div className="relative z-0 space-y-6">
          <MarketWidget />
        </div>
      </div>

      <Card className="relative z-10 border border-slate-800/70 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-400">Regime heatmap</p>
        <div className="mt-4">
          <HeatmapMatrix
            rows={['Low Vol', 'Mid Vol', 'High Vol']}
            cols={['Bull', 'Neutral', 'Bear']}
            data={{
              'Low Vol': {
                Bull: { label: '+1.4%', value: 0.14 },
                Neutral: { label: '+0.8%', value: 0.08 },
                Bear: { label: '-0.5%', value: -0.05 }
              },
              'Mid Vol': {
                Bull: { label: '+2.3%', value: 0.23 },
                Neutral: { label: '+1.1%', value: 0.11 },
                Bear: { label: '-1.0%', value: -0.1 }
              },
              'High Vol': {
                Bull: { label: '+3.8%', value: 0.38 },
                Neutral: { label: '+0.5%', value: 0.05 },
                Bear: { label: '-2.4%', value: -0.24 }
              }
            }}
          />
        </div>
      </Card>

      <div className="relative z-10 grid gap-6 lg:grid-cols-3">
        <Card className="bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Signal Engine</h3>
          <p className="mt-2 text-sm text-slate-400">
            Signals are generated from multi-timeframe trend and momentum reads. Visit the signal panel to pull the
            latest score or trigger an auto-trade when confidence exceeds your threshold.
          </p>
          <Link to="/signals" className="mt-4 inline-flex items-center text-sm text-accent hover:underline">
            {t('explore_signals')} →
          </Link>
        </Card>
        <Card className="bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Auto Trade</h3>
          <p className="mt-2 text-sm text-slate-400">
            Configure quick automations per symbol using the threshold and quantity inputs. Trades execute instantly via
            your connected Binance credentials (if supplied) or are stored for manual execution.
          </p>
          <Link to="/portfolio" className="mt-4 inline-flex items-center text-sm text-accent hover:underline">
            {t('review_portfolio')} →
          </Link>
        </Card>
        <Card className="bg-slate-900/70 p-5">
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
