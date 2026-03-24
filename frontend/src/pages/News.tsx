import { useEffect, useMemo, useState } from 'react';
import NewsCard from '@/components/NewsCard';
import { fetchNews, type NewsItem } from '@/services/api';

const RELATIVE_TIME = (value: string) => {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${mins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${Math.floor(diffHours / 24)}d ago`;
};

const NewsPage = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchNews({ currency: 'BTC', limit: 20 });
        if (!cancelled) {
          setItems(response.items);
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(err instanceof Error ? err.message : 'Unable to load news');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        publishedLabel: item.published_at ? RELATIVE_TIME(item.published_at) : 'Recently',
      })),
    [items]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-outline/30 bg-surface px-5 py-6 shadow-elevation-soft sm:px-6">
        <span className="text-xs uppercase tracking-[0.38em] text-slate-500">News</span>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Crypto news, trimmed to the market pulse.</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-400">
          A lightweight feed of market-relevant headlines to keep the signal desk connected to broader sentiment.
        </p>
      </section>

      <section className="rounded-3xl border border-outline/40 bg-surface p-5 shadow-elevation-soft sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Latest headlines</h2>
            <p className="mt-1 text-sm text-slate-400">Related to market sentiment</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-3xl border border-outline/20 bg-muted/60" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
            {error}
          </div>
        ) : cards.length ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {cards.map((item) => (
              <NewsCard
                key={`${item.url}-${item.title}`}
                title={item.title}
                source={item.source}
                publishedLabel={item.publishedLabel}
                url={item.url}
                sentiment={item.sentiment}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-outline/20 bg-muted/50 px-4 py-4 text-sm text-slate-400">
            No news available.
          </div>
        )}
      </section>
    </div>
  );
};

export default NewsPage;
