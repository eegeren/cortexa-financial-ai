import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/Card';
import NewsCard from '@/components/NewsCard';
import { useToast } from '@/components/ToastProvider';
import SignalSentimentPoll from '@/components/SignalSentimentPoll';
import { fetchNews, fetchPortfolio, fetchSignal, NewsResponse, PortfolioResponse, SignalResponse } from '@/services/api';

const MarketWidget = lazy(() => import('@/components/MarketWidget'));
const HeatmapMatrix = lazy(() => import('@/components/HeatmapMatrix'));

const heatmapRows = ['Low Vol', 'Mid Vol', 'High Vol'];
const heatmapCols = ['Bull', 'Neutral', 'Bear'];
const heatmapData = {
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
};

const formatPercent = (value?: number) => {
  if (value == null) {
    return '-';
  }
  return `${Math.round(value * 100)}%`;
};

const formatNumber = (value?: number) => {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const formatRelativeTime = (iso?: string) => {
  if (!iso) {
    return 'Recently';
  }

  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return 'Recently';
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${Math.max(diffMinutes, 1)}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const statTone = (label: string) => {
  if (label === 'Low') {
    return 'text-emerald-200';
  }
  if (label === 'High') {
    return 'text-rose-200';
  }
  if (label === 'Trending') {
    return 'text-cyan-200';
  }
  return 'text-slate-100';
};

const DashboardPage = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [signal, setSignal] = useState<SignalResponse | null>(null);
  const [signalLoading, setSignalLoading] = useState(true);
  const [newsItems, setNewsItems] = useState<NewsResponse['items']>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
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

  useEffect(() => {
    let alive = true;

    const loadNews = async () => {
      try {
        const response = await fetchNews({ currency: 'BTC', limit: 3 });
        if (!alive) {
          return;
        }
        setNewsItems(response.items ?? []);
      } catch (error) {
        if (alive) {
          const message = error instanceof Error ? error.message : 'Unable to load news';
          setNewsError(message);
        }
      } finally {
        if (alive) {
          setNewsLoading(false);
        }
      }
    };

    void loadNews();

    return () => {
      alive = false;
    };
  }, []);

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

  const heroSummary = useMemo(() => {
    if (!signal) {
      return 'Signal snapshot is loading.';
    }

    if (signal.scenario) {
      return signal.scenario;
    }

    if (signal.side === 'HOLD') {
      return 'Low confidence, no clear edge.';
    }

    return `${signal.trend ?? 'Market structure'} with ${formatPercent(signal.confidence)} confidence.`;
  }, [signal]);

  const indicatorRows = useMemo(
    () => [
      { label: 'RSI', value: formatNumber(signal?.indicators?.rsi ?? signal?.rsi) },
      {
        label: 'MACD',
        value:
          signal?.indicators?.macd?.macd != null && signal?.indicators?.macd?.signal != null
            ? `${formatNumber(signal.indicators.macd.macd)} / ${formatNumber(signal.indicators.macd.signal)}`
            : '-',
      },
      {
        label: 'EMA',
        value:
          signal?.indicators?.ema20 != null && signal?.indicators?.ema50 != null && signal?.indicators?.ema200 != null
            ? `${formatNumber(signal.indicators.ema20)} / ${formatNumber(signal.indicators.ema50)} / ${formatNumber(signal.indicators.ema200)}`
            : '-',
      },
    ],
    [signal]
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="rounded-3xl p-5 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.36em] text-slate-500">Overview</p>
              <div className="mt-4 flex items-end gap-3">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  {signalLoading ? '...' : signal?.side ?? 'HOLD'}
                </h1>
                <span className="mb-1 rounded-full border border-outline/35 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
                  {signal?.symbol ?? 'BTCUSDT'} {signal?.timeframe ? `• ${signal.timeframe}` : ''}
                </span>
              </div>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{heroSummary}</p>
            </div>

            <div className="rounded-2xl border border-outline/35 bg-muted/45 px-4 py-3 text-right">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Action state</p>
              <p className="mt-2 text-sm text-slate-200">
                {signal?.side === 'HOLD' ? 'Conditions are not favorable for action.' : 'Directional structure is actionable.'}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Confidence', value: formatPercent(signal?.confidence) },
              { label: 'Risk', value: signal?.risk ?? '-' },
              { label: 'Market Regime', value: signal?.market_regime ?? '-' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-outline/30 bg-slate-950/35 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{item.label}</p>
                <p className={`mt-3 text-xl font-semibold ${statTone(item.value)}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Key Levels</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Support / Resistance</h2>
            </div>
            <Link to="/signals" className="text-xs text-accent transition hover:text-white">
              Full signal →
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/6 p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-emerald-200/70">Support</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(signal?.levels?.support)}</p>
            </div>
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/6 p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-rose-200/70">Resistance</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(signal?.levels?.resistance)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIndicatorsOpen((value) => !value)}
            className="mt-5 flex w-full items-center justify-between rounded-2xl border border-outline/30 bg-slate-950/35 px-4 py-3 text-left transition hover:border-outline/55"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Indicators</p>
              <p className="mt-1 text-sm text-slate-300">RSI, MACD, EMA</p>
            </div>
            <span className="text-sm text-slate-300">{indicatorsOpen ? 'Hide' : 'Show'}</span>
          </button>

          {indicatorsOpen ? (
            <div className="mt-3 grid gap-3">
              {indicatorRows.map((item) => (
                <div key={item.label} className="rounded-2xl border border-outline/25 bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm text-slate-200">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-3xl p-5 sm:p-6 lg:p-7">
          <p className="text-[11px] uppercase tracking-[0.36em] text-slate-500">What&apos;s Happening</p>
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-outline/30 bg-slate-950/35 p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Scenario</p>
              <p className="mt-3 text-lg leading-8 text-white">
                {signalLoading ? 'Loading market structure...' : signal?.scenario ?? 'No explanation available yet.'}
              </p>
            </div>
            <div className="rounded-2xl border border-outline/30 bg-muted/35 p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Insight</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {signalLoading
                  ? 'Pulling the latest context from the signal engine.'
                  : signal?.insight ?? signal?.explanation ?? 'The engine has not produced a richer insight for this snapshot.'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Latest News</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Market sentiment check</h2>
            </div>
            <Link to="/news" className="text-xs text-accent transition hover:text-white">
              View all →
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {newsLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-3xl border border-outline/25 bg-slate-900/45" />
              ))
            ) : newsItems.length > 0 ? (
              newsItems.map((item) => (
                <NewsCard
                  key={`${item.url}-${item.published_at}`}
                  title={item.title}
                  source={item.source}
                  publishedLabel={formatRelativeTime(item.published_at)}
                  url={item.url}
                  sentiment={item.sentiment}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-outline/30 bg-slate-950/35 px-4 py-5 text-sm text-slate-400">
                {newsError ?? 'No news available right now.'}
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Community</p>
              <h2 className="mt-3 text-xl font-semibold text-white">What do you think?</h2>
            </div>
            <span className="rounded-full border border-outline/35 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
              BTCUSDT
            </span>
          </div>
          <div className="mt-5">
            <SignalSentimentPoll symbol={signal?.symbol ?? 'BTCUSDT'} />
          </div>
        </Card>

        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Portfolio Snapshot</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Execution context</h2>
            </div>
            {portfolioError ? (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-100">
                {portfolioError}
              </span>
            ) : null}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {portfolioLoading || !metrics ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl border border-outline/25 bg-slate-900/45" />
              ))
            ) : (
              <>
                <div className="rounded-2xl border border-outline/25 bg-slate-950/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Total trades</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{metrics.tradeCount}</p>
                </div>
                <div className="rounded-2xl border border-outline/25 bg-slate-950/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Net exposure</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(metrics.netExposure)} USDT</p>
                </div>
                <div className="rounded-2xl border border-outline/25 bg-slate-950/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Realized volume</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(metrics.realized)} USDT</p>
                </div>
                <div className="rounded-2xl border border-outline/25 bg-slate-950/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Last trade</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {metrics.lastTrade
                      ? `${metrics.lastTrade.symbol} | ${metrics.lastTrade.side} | ${new Date(metrics.lastTrade.created_at ?? '').toLocaleString()}`
                      : 'No trades yet'}
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Suspense fallback={<Card className="rounded-3xl p-6 text-sm text-slate-300">Loading market watch...</Card>}>
          <MarketWidget />
        </Suspense>
        <Suspense fallback={<Card className="rounded-3xl p-6 text-sm text-slate-300">Loading regime matrix...</Card>}>
          <Card className="rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-slate-100">Regime matrix</h3>
            <p className="mt-1 text-sm text-slate-300">Performance overview across volatility and trend regimes.</p>
            <div className="mt-4">
              <HeatmapMatrix rows={heatmapRows} cols={heatmapCols} data={heatmapData} />
            </div>
          </Card>
        </Suspense>
      </section>
    </div>
  );
};

export default DashboardPage;
