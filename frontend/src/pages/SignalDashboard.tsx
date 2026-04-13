import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSignals } from '@/api';
import { EdgeBadge, RegimeLabel, ScoreBar, timeAgo } from '@/components/signals/SignalBadges';
import PageHeader from '@/components/PageHeader';
import type { EdgeType, Signal, SignalFilters, SignalListResponse, Timeframe } from '@/types/signal';

const PAGE_SIZE = 8;

type SortKey = NonNullable<SignalFilters['sortBy']>;
type SortOrder = NonNullable<SignalFilters['sortOrder']>;

const formatNumber = (value: number, digits = 2) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
  }).format(value);

const edgeOptions: Array<{ label: string; value: EdgeType | 'all' }> = [
  { label: 'All edges', value: 'all' },
  { label: 'Long', value: 'long' },
  { label: 'Short', value: 'short' },
  { label: 'Limited', value: 'limited' },
  { label: 'None', value: 'none' },
];

const timeframeOptions: Array<{ label: string; value: Timeframe | 'all' }> = [
  { label: 'Default timeframe', value: 'all' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
];

const SignalDashboard = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<SignalFilters>({ edge: 'all', timeframe: 'all', search: '' });
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [response, setResponse] = useState<SignalListResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [filters.edge, filters.timeframe, filters.search]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const next = await fetchSignals({
          ...filters,
          page,
          pageSize: PAGE_SIZE,
          sortBy,
          sortOrder,
        });

        if (!cancelled) {
          setResponse(next);
        }
      } catch (loadError) {
        if (!cancelled) {
          setResponse({
            items: [],
            total: 0,
            page,
            pageSize: PAGE_SIZE,
            hasMore: false,
          });
          setError(loadError instanceof Error ? loadError.message : 'Canlı sinyaller alınamadı.');
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
  }, [filters, page, sortBy, sortOrder]);

  const metrics = useMemo(() => {
    const items = response.items;
    const directionalCount = items.filter((item) => item.edge === 'long' || item.edge === 'short').length;
    const averageScore = items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 0;
    const activePairs = new Set(items.map((item) => item.pair)).size;

    return [
      { label: 'Toplam sinyal', value: response.total.toString(), hint: 'Filtreye göre sonuçlar' },
      {
        label: 'Directional edge',
        value: `${directionalCount}`,
        hint: items.length ? `${Math.round((directionalCount / items.length) * 100)}% of visible list` : 'No signal yet',
      },
      { label: 'Ort. skor', value: `${Math.round(averageScore)}%`, hint: 'Görünen sinyallerin ortalaması' },
      { label: 'Aktif parite', value: activePairs.toString(), hint: 'Unique pairs in current page' },
    ];
  }, [response]);

  const totalPages = Math.max(1, Math.ceil(response.total / PAGE_SIZE));

  const toggleSort = (nextKey: SortKey) => {
    if (sortBy === nextKey) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(nextKey);
    setSortOrder(nextKey === 'pair' ? 'asc' : 'desc');
  };

  const renderSortLabel = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)] transition hover:text-white"
    >
      <span>{label}</span>
      {sortBy === key && <span className="text-white">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Signal Dashboard"
        description="Kripto sinyallerini edge, zaman dilimi ve skor bazında tara. Sıralayıp detay sayfasına geçebilirsin."
        actions={
          loading ? (
            <div
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-[color:var(--text-muted)]"
              style={{ backgroundColor: 'var(--surface)' }}
            >
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
              Sinyaller yükleniyor...
            </div>
          ) : null
        }
      />

      {error && (
        <div
          className="rounded-2xl border border-rose-500/20 px-4 py-3 text-sm text-rose-200"
          style={{ backgroundColor: 'rgba(244, 63, 94, 0.08)' }}
        >
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-3xl border border-white/10 p-5 shadow-elevation-soft"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">{metric.hint}</p>
          </div>
        ))}
      </section>

      <section
        className="rounded-3xl border border-white/10 p-5 shadow-elevation-soft sm:p-6"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <div className="grid gap-4 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
          <label className="space-y-2 text-sm">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Edge</span>
            <select
              value={filters.edge ?? 'all'}
              onChange={(event) => setFilters((current) => ({ ...current, edge: event.target.value as EdgeType | 'all' }))}
              className="input-base"
            >
              {edgeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Timeframe</span>
            <select
              value={filters.timeframe ?? 'all'}
              onChange={(event) => setFilters((current) => ({ ...current, timeframe: event.target.value as Timeframe | 'all' }))}
              className="input-base"
            >
              {timeframeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Arama</span>
            <input
              value={filters.search ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="BTC, ETH, trend, breakout..."
              className="input-base"
            />
          </label>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
          <div className="hidden grid-cols-[1.3fr_0.6fr_0.7fr_0.75fr_1fr_0.9fr] gap-4 border-b border-white/10 px-5 py-4 md:grid">
            <div>{renderSortLabel('pair', 'Pair')}</div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Edge</div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Regime</div>
            <div>{renderSortLabel('score', 'Score')}</div>
            <div>{renderSortLabel('price', 'Price')}</div>
            <div>{renderSortLabel('updatedAt', 'Updated')}</div>
          </div>

          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            {loading ? (
              <div className="space-y-3 px-4 py-4 sm:px-5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : response.items.length ? (
              response.items.map((signal: Signal) => (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() => navigate(`/signals/${signal.id}?timeframe=${encodeURIComponent(signal.timeframe)}`)}
                  className="grid w-full gap-3 border-b border-white/5 px-4 py-4 text-left transition hover:bg-white/5 md:grid-cols-[1.3fr_0.6fr_0.7fr_0.75fr_1fr_0.9fr] md:items-center md:px-5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-white">{signal.pair}</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                        {signal.timeframe}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-[color:var(--text-muted)]">{signal.summary}</p>
                  </div>

                  <div className="md:justify-self-start">
                    <EdgeBadge edge={signal.edge} />
                  </div>

                  <div className="md:justify-self-start">
                    <RegimeLabel regime={signal.regime} />
                  </div>

                  <ScoreBar score={signal.score} />

                  <div>
                    <p className="text-base font-semibold text-white">${formatNumber(signal.price, signal.price < 10 ? 4 : 2)}</p>
                    {typeof signal.change24h === 'number' && (
                      <p className={`mt-1 text-xs ${signal.change24h >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {signal.change24h >= 0 ? '+' : ''}
                        {signal.change24h.toFixed(2)}% / 24h
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-white">{timeAgo(signal.updatedAt)}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">Satıra tıkla</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-sm text-[color:var(--text-muted)]">
                Bu filtrelerde gösterilecek sinyal yok.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[color:var(--text-muted)]">
            Sayfa {Math.min(page, totalPages)} / {totalPages} • {response.total} sonuç
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
            >
              Önceki
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || !response.hasMore}
              className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SignalDashboard;
