import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import AnalyticsPage from '@/pages/Analytics';
import WhaleAlertsTicker from '@/components/WhaleAlertsTicker';
import { fetchPublicMarketSummary, fetchPublicNews, type MarketSummaryItem, type NewsItem } from '@/services/api';

const formatCompactCurrency = (value?: number | null) => {
  if (typeof value !== 'number') return '--';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const relativeTime = (value: string) => {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return `${Math.floor(diffMinutes / 1440)}d ago`;
};

const PulsePage = () => {
  const [summary, setSummary] = useState<MarketSummaryItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchPublicMarketSummary({ limit: 8 }),
      fetchPublicNews({ currency: 'BTC', limit: 4 }),
    ])
      .then(([summaryData, newsData]) => {
        if (!alive) return;
        setSummary(summaryData);
        setNews(newsData.items ?? []);
      })
      .catch(() => {
        if (!alive) return;
        setSummary([]);
        setNews([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const winners = useMemo(
    () =>
      [...summary]
        .filter((item) => typeof item.price_change_percent === 'number')
        .sort((a, b) => (b.price_change_percent ?? 0) - (a.price_change_percent ?? 0))
        .slice(0, 4),
    [summary]
  );

  const marketSnapshot = useMemo(() => {
    const positive = summary.filter((item) => (item.price_change_percent ?? 0) > 0).length;
    const totalVolume = summary.reduce((sum, item) => sum + (item.quote_volume ?? 0), 0);
    const averageMove =
      summary.length > 0
        ? summary.reduce((sum, item) => sum + (item.price_change_percent ?? 0), 0) / summary.length
        : 0;

    return [
      { label: 'Tracked Pairs', value: summary.length ? String(summary.length) : '--' },
      { label: 'Advancing', value: summary.length ? `${positive}/${summary.length}` : '--' },
      { label: 'Avg Move', value: summary.length ? `${averageMove >= 0 ? '+' : ''}${averageMove.toFixed(2)}%` : '--' },
      { label: 'Quote Volume', value: summary.length ? formatCompactCurrency(totalVolume) : '--' },
    ];
  }, [summary]);

  return (
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_35%),linear-gradient(135deg,#071424_0%,#0b1220_48%,#07111d_100%)] px-6 py-8 shadow-[0_30px_100px_rgba(3,7,18,0.45)] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Public Pulse Terminal
            </span>
            <span className="text-xs text-slate-400">Live market context without signup</span>
          </div>

          <div className="grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-5">
              <div className="space-y-3">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Free crypto intelligence terminal with live market structure, whale flow, and volatility context.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Cortexa Pulse turns the product into something people can trust before they ever register:
                  real market breadth, fresh headlines, live whale movement, liquidation pressure, and on-chain context in one public workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
                >
                  Unlock AI Bot
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center rounded-full border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-emerald-500/40 hover:text-white"
                >
                  Compare Plans
                </Link>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[1.75rem] border border-slate-800/80 bg-slate-950/70 p-5 backdrop-blur"
            >
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Market Snapshot</p>
              <div className="mt-5 grid grid-cols-2 gap-4">
                {marketSnapshot.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                {loading ? 'Loading live market snapshot...' : 'Streaming public market context from Cortexa backend endpoints.'}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <WhaleAlertsTicker />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-slate-800/70 bg-slate-950/55 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Top Movers</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Public market leaderboard</h2>
            </div>
            <Link to="/register" className="text-xs font-semibold text-emerald-300 transition hover:text-emerald-200">
              Trade with AI
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(winners.length ? winners : Array.from({ length: 4 }).map((_, index) => ({ symbol: `Pair ${index + 1}`, price_change_percent: null, last_price: null, quote_volume: null }))).map((item) => (
              <div key={item.symbol} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100">{item.symbol}</p>
                  <span className={`text-sm font-semibold ${(item.price_change_percent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {typeof item.price_change_percent === 'number' ? `${item.price_change_percent >= 0 ? '+' : ''}${item.price_change_percent.toFixed(2)}%` : '--'}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-semibold text-white">{formatCompactCurrency(item.last_price ?? undefined)}</p>
                <p className="mt-1 text-xs text-slate-500">Quote volume {formatCompactCurrency(item.quote_volume ?? undefined)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-800/70 bg-slate-950/55 p-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">News Feed</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Recent crypto headlines</h2>
          <div className="mt-5 space-y-3">
            {(news.length ? news : Array.from({ length: 4 }).map((_, index) => ({ title: `Loading headline ${index + 1}`, source: 'Feed', url: '#', published_at: new Date().toISOString(), sentiment: 'neutral' }))).map((item) => (
              <a
                key={`${item.url}-${item.title}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 transition hover:border-emerald-500/25 hover:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">{item.source}</span>
                  <span className="text-[11px] text-slate-600">{relativeTime(item.published_at)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-200">{item.title}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-800/70 bg-slate-950/35 p-4 sm:p-6">
        <AnalyticsPage compact />
      </section>

      <section className="rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-950 to-cyan-500/10 p-6 text-center sm:p-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">From terminal to execution</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Public intelligence outside, automated trading inside.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-300">
          This is the right product shape for competing with crypto terminals: let visitors verify the data quality for free, then convert them into AI-assisted and fully automated traders.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400">
            Create Free Account
          </Link>
          <Link to="/" className="rounded-full border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:text-white">
            Back to Landing
          </Link>
        </div>
      </section>
    </div>
  );
};

export default PulsePage;
