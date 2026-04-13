import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/Card';
import MarketStrip from '@/components/MarketStrip';
import MarketsDrawer from '@/components/MarketsDrawer';
import NewsCard from '@/components/NewsCard';
import PageHeader from '@/components/PageHeader';
import SignalSentimentPoll from '@/components/SignalSentimentPoll';
import PremiumLock from '@/components/PremiumLock';
import usePremiumStatus from '@/hooks/usePremiumStatus';
import { useAuthStore } from '@/store/auth';
import { useMarketStore } from '@/store/market';
import {
  fetchForumThreads,
  fetchMarketSummary,
  fetchNews,
  fetchPortfolio,
  NewsResponse,
  PortfolioResponse,
  type ForumThread,
  type MarketSummaryItem,
} from '@/services/api';

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

const toneClass = (value?: string) => {
  const normalized = value?.toLowerCase() ?? '';
  if (normalized.includes('bull') || normalized === 'low' || normalized === 'buy' || normalized === 'long') {
    return 'text-emerald-200';
  }
  if (normalized.includes('bear') || normalized === 'high' || normalized === 'sell' || normalized === 'short') {
    return 'text-rose-200';
  }
  if (normalized.includes('trend')) {
    return 'text-cyan-200';
  }
  return 'text-slate-100';
};

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

  const stripItems = useMemo(() => {
    const bySymbol = new Map(marketItems.map((item) => [item.symbol, item]));
    return TOP_MARKET_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter(Boolean) as MarketSummaryItem[];
  }, [marketItems]);

  const selectedMarket = useMemo(
    () => marketItems.find((item) => item.symbol === selectedSymbol) ?? null,
    [marketItems, selectedSymbol]
  );

  const heroSummary = useMemo(() => {
    if (!signal) {
      return 'Bu market için henüz canlı signal yüklenmedi. Signals sayfasına geçip seçili coin için analiz çektiğinde overview otomatik olarak dolacak.';
    }

    if (signal.edge === 'No Clear Edge' || signal.side === 'HOLD') {
      return signal.edge_reason || 'Şu an net yönsel üstünlük görünmüyor. Koşullar izlemeye değer ama acele ettirmiyor.';
    }

    return signal.scenario || signal.insight || `${signal.trend ?? 'Market structure'} with ${formatPercent(signal.confidence)} confidence.`;
  }, [signal]);

  const overviewCards = useMemo(
    () => [
      { label: 'Signal side', value: signal?.side ?? 'HOLD', tone: toneClass(signal?.side) },
      { label: 'Confidence', value: formatPercent(signal?.confidence), tone: 'text-white' },
      { label: 'Market regime', value: signal?.market_regime ?? '-', tone: toneClass(signal?.market_regime) },
      { label: 'Community', value: communitySentiment, tone: toneClass(communitySentiment) },
    ],
    [communitySentiment, signal]
  );

  const contextCards = useMemo(
    () => [
      { label: 'Structure', value: signal?.trend ?? 'Neutral' },
      { label: 'Momentum', value: signal?.momentum ?? '-' },
      { label: 'Edge', value: signal?.edge ?? 'No Clear Edge' },
      { label: 'Risk', value: signal?.risk ?? '-' },
    ],
    [signal]
  );

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
      { label: 'ADX', value: formatNumber(signal?.indicators?.adx) },
      { label: 'ATR', value: formatNumber(signal?.indicators?.atr ?? signal?.atr) },
      {
        label: 'EMA stack',
        value:
          signal?.indicators?.ema20 != null && signal?.indicators?.ema50 != null && signal?.indicators?.ema200 != null
            ? `${formatNumber(signal.indicators.ema20)} / ${formatNumber(signal.indicators.ema50)} / ${formatNumber(signal.indicators.ema200)}`
            : '-',
      },
      { label: 'Volume ratio', value: formatNumber(signal?.indicators?.volume_ratio) },
    ],
    [signal]
  );

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setMarketsOpen(false);
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      <MarketStrip
        items={stripItems}
        loading={marketLoading}
        activeSymbol={selectedSymbol}
        onSelectSymbol={handleSelectSymbol}
        onViewAll={() => setMarketsOpen(true)}
      />

      <PageHeader
        title={`Welcome back, ${greetingName}`}
        description="Overview artık seçili market, güncel portfolio bağlamı, haber akışı ve topluluk hissini daha derli toplu gösteriyor."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to={`/signals?symbol=${selectedSymbol}`} className="btn btn-primary">
              Signals'a git
            </Link>
            <button type="button" onClick={() => setMarketsOpen(true)} className="btn btn-ghost">
              Market seç
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-outline/35 bg-muted/50 px-3 py-1 uppercase tracking-[0.22em]">
            {selectedSymbol}
          </span>
          <span>
            {selectedMarket?.last_price != null ? `$${formatNumber(selectedMarket.last_price)}` : 'Price unavailable'}
          </span>
          {selectedMarket?.price_change_percent != null && (
            <span className={selectedMarket.price_change_percent >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {selectedMarket.price_change_percent >= 0 ? '+' : ''}
              {selectedMarket.price_change_percent.toFixed(2)}%
            </span>
          )}
        </div>
      </PageHeader>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <Card className="rounded-3xl p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.36em] text-slate-500">Overview</p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">{signal?.side ?? 'HOLD'}</h1>
                <span className="mb-1 rounded-full border border-outline/35 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
                  {signal?.symbol ?? selectedSymbol} {signal?.timeframe ? `• ${signal.timeframe}` : ''}
                </span>
              </div>
              <p className="mt-5 text-base leading-8 text-slate-300">{heroSummary}</p>
            </div>

            <div className="grid min-w-[260px] gap-3 sm:grid-cols-2">
              {overviewCards.map((item) => (
                <div key={item.label} className="rounded-2xl border border-outline/25 bg-slate-950/35 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className={`mt-3 text-xl font-semibold ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Selected Market</p>
              <h2 className="mt-3 text-xl font-semibold text-white">{selectedSymbol}</h2>
            </div>
            <Link to={`/signals?symbol=${selectedSymbol}`} className="text-xs text-accent transition hover:text-white">
              Signal yükle →
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-outline/25 bg-slate-950/35 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Last price</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {selectedMarket?.last_price != null ? `$${formatNumber(selectedMarket.last_price)}` : '-'}
              </p>
            </div>
            <div className="rounded-2xl border border-outline/25 bg-slate-950/35 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">24h change</p>
              <p className={`mt-3 text-2xl font-semibold ${selectedMarket?.price_change_percent != null && selectedMarket.price_change_percent >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                {selectedMarket?.price_change_percent != null
                  ? `${selectedMarket.price_change_percent >= 0 ? '+' : ''}${selectedMarket.price_change_percent.toFixed(2)}%`
                  : '-'}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/6 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/70">Support</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(signal?.levels?.support)}</p>
            </div>
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/6 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-rose-200/70">Resistance</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(signal?.levels?.resistance)}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,420px)]">
        <Card className="relative rounded-3xl p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Market Thesis</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Context and explanation</h2>
            </div>
            <Link to={`/signals?symbol=${selectedSymbol}`} className="text-xs text-accent transition hover:text-white">
              Full analysis →
            </Link>
          </div>

          <div className={`mt-5 space-y-4 ${!isPremium ? 'blur-[2px]' : ''}`}>
            <div className="rounded-2xl border border-outline/30 bg-slate-950/35 p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Scenario</p>
              <p className="mt-3 text-lg leading-8 text-white">
                {signal?.scenario ?? 'Henüz bu market için senaryo yüklenmedi. Signals sayfasından analiz çektiğinde burada okunabilir özet belirecek.'}
              </p>
            </div>
            <div className="rounded-2xl border border-outline/30 bg-muted/35 p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Insight</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {signal?.insight ?? signal?.explanation ?? 'Bu blok artık boş bir köşe değil. Sinyal geldiğinde daha uzun içgörü metni burada akacak.'}
              </p>
            </div>
          </div>
          {!isPremium && <PremiumLock message="Upgrade to access full features" />}
        </Card>

        <Card className="rounded-3xl p-6">
          <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Quick Context</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {contextCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-outline/25 bg-slate-950/35 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                <p className={`mt-3 text-lg font-semibold ${toneClass(item.value)}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-outline/25 bg-slate-950/35 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Last update</p>
            <p className="mt-3 text-sm text-slate-300">{formatRelativeTime(signal?.usage?.reset_at ?? portfolio?.trades?.[0]?.created_at)}</p>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="rounded-3xl p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Indicators</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Technical snapshot</h2>
            </div>
            <span className="rounded-full border border-outline/35 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
              {signal?.timeframe ?? '1h'}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {indicatorRows.map((item) => (
              <div key={item.label} className="rounded-2xl border border-outline/25 bg-muted/35 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="relative rounded-3xl p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Community</p>
              <h2 className="mt-3 text-xl font-semibold text-white">What do you think?</h2>
            </div>
            <span className="rounded-full border border-outline/35 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
              {signal?.symbol ?? selectedSymbol}
            </span>
          </div>
          <div className={`mt-5 ${!isPremium ? 'blur-[2px]' : ''}`}>
            <SignalSentimentPoll symbol={signal?.symbol ?? selectedSymbol} />
          </div>
          {!isPremium && <PremiumLock message="Upgrade to access full features" />}
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Latest News</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Market sentiment check</h2>
            </div>
            <Link to="/news" className="text-xs text-accent transition hover:text-white">
              View all →
            </Link>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3 xl:grid-cols-1">
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

        <Card className="rounded-3xl p-6">
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
