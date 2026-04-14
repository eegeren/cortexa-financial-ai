import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSignals } from '@/api';
import C from '@/styles/theme';
import type { EdgeType, Signal, SignalFilters, SignalListResponse, Timeframe } from '@/types/signal';

const PAGE_SIZE = 8;

type SortKey = NonNullable<SignalFilters['sortBy']>;
type SortOrder = NonNullable<SignalFilters['sortOrder']>;

const formatNumber = (value: number, digits = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

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

const controlStyle: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: `1px solid ${C.borderStrong}`,
  background: 'rgba(255,255,255,0.03)',
  color: C.text,
  padding: '14px 16px',
  outline: 'none',
  fontSize: 14,
};

const edgeTone: Record<EdgeType, { text: string; bg: string; border: string }> = {
  long: { text: '#86efac', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.28)' },
  short: { text: '#fda4af', bg: 'rgba(244,63,94,0.14)', border: 'rgba(244,63,94,0.28)' },
  limited: { text: '#fcd34d', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.28)' },
  none: { text: C.textSub, bg: 'rgba(255,255,255,0.05)', border: C.border },
};

const regimeTone = {
  trending: { text: C.green, bg: C.greenMuted, border: 'rgba(29,158,117,0.3)', label: 'Trending' },
  range: { text: '#93c5fd', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.28)', label: 'Range' },
  low: { text: '#cbd5e1', bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.24)', label: 'Low vol' },
} as const;

const timeAgo = (isoString: string) => {
  const value = new Date(isoString).getTime();
  if (!Number.isFinite(value)) return 'just now';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - value) / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
};

function Pill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: active ? `1px solid ${C.green}` : `1px solid ${C.border}`,
        background: active ? C.greenMuted : 'rgba(255,255,255,0.02)',
        color: active ? C.text : C.textSub,
        padding: '10px 14px',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ borderRadius: 22, border: `1px solid ${C.border}`, background: C.surface, padding: 20 }}>
      <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, margin: '10px 0 8px' }}>{value}</div>
      <div style={{ color: C.textSub, fontSize: 13, lineHeight: 1.6 }}>{hint}</div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6, fontSize: 12 }}>
        <span style={{ color: C.textMuted, fontFamily: C.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Score</span>
        <span style={{ color: C.text, fontWeight: 700 }}>{clamped}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', borderRadius: 999, background: C.green }} />
      </div>
    </div>
  );
}

export default function SignalDashboard() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<SignalFilters>({ edge: 'all', timeframe: 'all', search: '' });
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [response, setResponse] = useState<SignalListResponse>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, hasMore: false });
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
        const next = await fetchSignals({ ...filters, page, pageSize: PAGE_SIZE, sortBy, sortOrder });
        if (!cancelled) setResponse(next);
      } catch (loadError) {
        if (!cancelled) {
          setResponse({ items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false });
          setError(loadError instanceof Error ? loadError.message : 'Live signals could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
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
      { label: 'Total signals', value: response.total.toString(), hint: 'Results for the current filter set' },
      { label: 'Directional edge', value: `${directionalCount}`, hint: items.length ? `${Math.round((directionalCount / items.length) * 100)}% of visible rows` : 'No signals yet' },
      { label: 'Average score', value: `${Math.round(averageScore)}%`, hint: 'Composite confidence of visible signals' },
      { label: 'Active pairs', value: activePairs.toString(), hint: 'Unique pairs on this page' },
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

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: C.sans, padding: '24px' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 24 }}>
        <section style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: C.green, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Signal dashboard</div>
            <h1 style={{ margin: '0 0 10px', fontSize: 44, lineHeight: 1.02, letterSpacing: '-0.04em' }}>Scan live setups with cleaner filters and faster reading.</h1>
            <p style={{ margin: 0, maxWidth: 720, color: C.textSub, fontSize: 15, lineHeight: 1.7 }}>Filter by edge and timeframe, search by pair, sort by signal quality or price, then jump into the full detail screen.</p>
          </div>
          {loading ? <div style={{ borderRadius: 999, border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, padding: '10px 14px', fontSize: 12 }}>Loading signals...</div> : null}
        </section>

        {error ? <div style={{ borderRadius: 18, border: '1px solid rgba(244,63,94,0.28)', background: 'rgba(244,63,94,0.12)', color: '#fecdd3', padding: '14px 16px', fontSize: 14 }}>{error}</div> : null}

        <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {metrics.map((metric) => <StatCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />)}
        </section>

        <section style={{ borderRadius: 28, border: `1px solid ${C.border}`, background: C.surface, padding: 20 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Timeframe</span>
                <select value={filters.timeframe ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, timeframe: event.target.value as Timeframe | 'all' }))} style={controlStyle}>
                  {timeframeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Search</span>
                <input value={filters.search ?? ''} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="BTC, ETH, breakout..." style={controlStyle} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {edgeOptions.map((option) => <Pill key={option.value} active={(filters.edge ?? 'all') === option.value} label={option.label} onClick={() => setFilters((current) => ({ ...current, edge: option.value }))} />)}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { key: 'updatedAt' as SortKey, label: 'Updated' },
                { key: 'score' as SortKey, label: 'Score' },
                { key: 'price' as SortKey, label: 'Price' },
                { key: 'pair' as SortKey, label: 'Pair' },
              ].map((item) => (
                <button key={item.key} type="button" onClick={() => toggleSort(item.key)} style={{ borderRadius: 999, border: sortBy === item.key ? `1px solid ${C.green}` : `1px solid ${C.border}`, background: sortBy === item.key ? C.greenMuted : 'rgba(255,255,255,0.02)', color: C.text, padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  {item.label} {sortBy === item.key ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => <div key={index} style={{ height: 112, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }} />)
              ) : response.items.length ? (
                response.items.map((signal: Signal) => {
                  const edge = edgeTone[signal.edge];
                  const regime = regimeTone[signal.regime];
                  return (
                    <button
                      key={signal.id}
                      type="button"
                      onClick={() => navigate(`/signals/${signal.id}?timeframe=${encodeURIComponent(signal.timeframe)}`)}
                      style={{ width: '100%', textAlign: 'left', borderRadius: 22, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', padding: 18, cursor: 'pointer', display: 'grid', gap: 16 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 220, flex: 1 }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                            <span style={{ fontSize: 20, fontWeight: 700 }}>{signal.pair}</span>
                            <span style={{ borderRadius: 999, border: `1px solid ${C.border}`, padding: '6px 10px', color: C.textMuted, fontFamily: C.mono, fontSize: 11 }}>{signal.timeframe}</span>
                          </div>
                          <div style={{ color: C.textSub, fontSize: 14, lineHeight: 1.7 }}>{signal.summary}</div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span style={{ borderRadius: 999, border: `1px solid ${edge.border}`, background: edge.bg, color: edge.text, padding: '7px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{signal.edge}</span>
                          <span style={{ borderRadius: 999, border: `1px solid ${regime.border}`, background: regime.bg, color: regime.text, padding: '7px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{regime.label}</span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Price</div>
                          <div style={{ fontSize: 22, fontWeight: 700 }}>${formatNumber(signal.price, signal.price < 10 ? 4 : 2)}</div>
                          {typeof signal.change24h === 'number' ? <div style={{ marginTop: 6, color: signal.change24h >= 0 ? '#86efac' : '#fda4af', fontSize: 12 }}>{signal.change24h >= 0 ? '+' : ''}{signal.change24h.toFixed(2)}% / 24h</div> : null}
                        </div>

                        <ScoreBar score={signal.score} />

                        <div>
                          <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Updated</div>
                          <div style={{ fontSize: 14, color: C.text }}>{timeAgo(signal.updatedAt)}</div>
                          <div style={{ marginTop: 6, color: C.textMuted, fontSize: 12 }}>Click row for detail</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div style={{ borderRadius: 20, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', padding: 28, textAlign: 'center', color: C.textSub }}>
                  No signals match these filters.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: C.textSub, fontSize: 14 }}>Page {Math.min(page, totalPages)} / {totalPages} • {response.total} results</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} style={{ borderRadius: 12, border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.text, padding: '12px 16px', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
                  Previous
                </button>
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || !response.hasMore} style={{ borderRadius: 12, border: 'none', background: C.green, color: C.text, padding: '12px 16px', cursor: page >= totalPages || !response.hasMore ? 'not-allowed' : 'pointer', opacity: page >= totalPages || !response.hasMore ? 0.5 : 1 }}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
