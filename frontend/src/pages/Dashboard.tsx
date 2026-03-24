import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/Card';
import MarketStrip from '@/components/MarketStrip';
import MarketsDrawer from '@/components/MarketsDrawer';
import NewsCard from '@/components/NewsCard';
import SignalSentimentPoll from '@/components/SignalSentimentPoll';
import PremiumLock from '@/components/PremiumLock';
import usePremiumStatus from '@/hooks/usePremiumStatus';
import { useAuthStore } from '@/store/auth';
import { useMarketStore } from '@/store/market';
import { fetchForumThreads, fetchMarketSummary, fetchNews, fetchPortfolio, NewsResponse, PortfolioResponse, type ForumThread, type MarketSummaryItem } from '@/services/api';

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

const normalizeConfidence = (value?: number) => {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, normalized));
};

const formatPercent = (value?: number) => {
  const normalized = normalizeConfidence(value);
  if (normalized == null) {
    return '-';
  }
  return `${Math.round(normalized)}%`;
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

const aggregateCommunitySentiment = (threads: ForumThread[]) => {
  const votes = threads.reduce(
    (acc, thread) => {
      acc.bullish += thread.votes.bullish;
      acc.bearish += thread.votes.bearish;
      acc.chop += thread.votes.chop;
      return acc;
    },
    { bullish: 0, bearish: 0, chop: 0 }
  );

  if (votes.bullish === 0 && votes.bearish === 0 && votes.chop === 0) {
    return 'Neutral';
  }
  if (votes.bearish > votes.bullish && votes.bearish >= votes.chop) {
    return 'Bearish';
  }
  if (votes.bullish > votes.bearish && votes.bullish >= votes.chop) {
    return 'Bullish';
  }
  return 'Neutral';
};

const TOP_MARKET_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];

const DashboardPage = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [newsItems, setNewsItems] = useState<NewsResponse['items']>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [marketItems, setMarketItems] = useState<MarketSummaryItem[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [communitySentiment, setCommunitySentiment] = useState<'Bullish' | 'Bearish' | 'Neutral'>('Neutral');
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const { isPremium } = usePremiumStatus();
  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
  const cachedSignals = useMarketStore((state) => state.cachedSignals);
  const setSelectedSymbol = useMarketStore((state) => state.setSelectedSymbol);
  const { firstName, lastName, email } = useAuthStore((state) => ({
    firstName: state.firstName,
    lastName: state.lastName,
    email: state.email,
  }));
  const greetingName = firstName?.trim() || lastName?.trim() || email?.split('@')[0] || 'there';
  const signal = cachedSignals[selectedSymbol] ?? null;

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

  useEffect(() => {
    let alive = true;

    const loadMarkets = async () => {
      try {
        const items = await fetchMarketSummary({ limit: 120 });
        if (!alive) {
          return;
        }
        setMarketItems(items);
      } catch {
        if (alive) {
          setMarketItems([]);
        }
      } finally {
        if (alive) {
          setMarketLoading(false);
        }
      }
    };

    void loadMarkets();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const loadCommunity = async () => {
      try {
        const rows = await fetchForumThreads();
        if (!alive) {
          return;
        }
        setCommunitySentiment(aggregateCommunitySentiment(rows) as 'Bullish' | 'Bearish' | 'Neutral');
      } catch {
        if (alive) {
          setCommunitySentiment('Neutral');
        }
      }
    };

    void loadCommunity();
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
      return 'No analysis has been loaded for this market yet. Select a coin here, then open Signals and click Load signal when you want a fresh analysis.';
    }

    if (signal.edge === 'No Clear Edge' || signal.side === 'HOLD') {
      return signal.edge_reason || 'No clear directional bias. Conditions are not favorable for action.';
    }
    if (signal.scenario) {
      return signal.scenario;
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

  const stripItems = useMemo(() => {
    const bySymbol = new Map(marketItems.map((item) => [item.symbol, item]));
    return TOP_MARKET_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter(Boolean) as MarketSummaryItem[];
  }, [marketItems]);

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setMarketsOpen(false);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <MarketStrip
        items={stripItems}
        loading={marketLoading}
        activeSymbol={selectedSymbol}
        onSelectSymbol={handleSelectSymbol}
        onViewAll={() => setMarketsOpen(true)}
      />

      <section>
        <Card className="rounded-3xl p-5 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.36em] text-slate-500">Overview</p>
              <p className="mt-3 text-sm font-medium text-slate-300">Welcome back, {greetingName}</p>
              <div className="mt-4 flex items-end gap-3">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  {signal?.side ?? 'HOLD'}
                </h1>
                <span className="mb-1 rounded-full border border-outline/35 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
                  {signal?.symbol ?? 'BTCUSDT'} {signal?.timeframe ? `• ${signal.timeframe}` : ''}
                </span>
              </div>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{heroSummary}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="relative rounded-3xl p-5 sm:p-6 lg:p-7">
          <p className="text-[11px] uppercase tracking-[0.36em] text-slate-500">Market Context</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Structure', value: signal?.trend ?? 'Neutral' },
              { label: 'Momentum', value: signal?.momentum ?? '-' },
              { label: 'Sentiment', value: signal?.sentiment ?? 'Neutral' },
              { label: 'Edge', value: signal?.edge ?? 'No Clear Edge' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-outline/25 bg-slate-950/35 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{item.label}</p>
                <p className={`mt-3 text-base font-semibold ${statTone(item.value)}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-outline/25 bg-slate-950/30 px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Community sentiment</p>
            <p className="mt-3 text-sm text-slate-200">Community sentiment: {communitySentiment}</p>
          </div>
        </Card>

        <Card className="relative rounded-3xl p-5 sm:p-6 lg:p-7">
          <p className="text-[11px] uppercase tracking-[0.36em] text-slate-500">What&apos;s Happening</p>
          <div className={`mt-5 space-y-5 ${!isPremium ? 'blur-[2px]' : ''}`}>
            <div className="rounded-2xl border border-outline/30 bg-slate-950/35 p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Scenario</p>
              <p className="mt-3 text-lg leading-8 text-white">
                {signal?.scenario ?? 'No explanation available yet. Run a signal analysis when you want fresh market context for this symbol.'}
              </p>
            </div>
            <div className="rounded-2xl border border-outline/30 bg-muted/35 p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Insight</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {signal?.insight ?? signal?.explanation ?? 'Load a signal explicitly from the Signals page to populate the richer market insight layer here.'}
              </p>
            </div>
          </div>
          {!isPremium && <PremiumLock message="Upgrade to access full features" />}
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Quick Stats</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
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
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Key Levels</p>
                  <h2 className="mt-3 text-xl font-semibold text-white">Support / Resistance</h2>
                </div>
                <Link to="/signals" className="text-xs text-accent transition hover:text-white">
                  Full market insight →
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
            </div>
          </Card>
        </div>
      </section>

      <section>
        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Latest News</p>
              <h2 className="mt-3 text-lg font-semibold text-white">Market sentiment check</h2>
            </div>
            <Link to="/news" className="text-xs text-accent transition hover:text-white">
              View all →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {newsLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-3xl border border-outline/25 bg-slate-900/45" />
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
          <button
            type="button"
            onClick={() => setIndicatorsOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-2xl border border-outline/30 bg-slate-950/35 px-4 py-3 text-left transition hover:border-outline/55"
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

        <Card className="relative rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Community</p>
              <h2 className="mt-3 text-xl font-semibold text-white">What do you think?</h2>
            </div>
            <span className="rounded-full border border-outline/35 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
              BTCUSDT
            </span>
          </div>
          <div className={`mt-5 ${!isPremium ? 'blur-[2px]' : ''}`}>
            <SignalSentimentPoll symbol={signal?.symbol ?? 'BTCUSDT'} />
          </div>
          {!isPremium && <PremiumLock message="Upgrade to access full features" />}
        </Card>
      </section>

      <section>
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

      <section>
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

      <MarketsDrawer
        open={marketsOpen}
        items={marketItems}
        activeSymbol={selectedSymbol}
        onClose={() => setMarketsOpen(false)}
        onSelectSymbol={handleSelectSymbol}
      />
    </div>
  );
};

export default DashboardPage;
