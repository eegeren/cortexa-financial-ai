import { useMemo, useState } from 'react';
import { MarketSummaryItem } from '@/services/api';

type AllMarketsModalProps = {
  open: boolean;
  items: MarketSummaryItem[];
  activeSymbol?: string;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
};

const formatPrice = (value?: number | null) =>
  value == null ? '--' : value.toLocaleString(undefined, { maximumFractionDigits: value >= 1000 ? 2 : 4 });

const formatChange = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
};

const formatVolume = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const trendArrow = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return '→';
  }
  if (value > 0.15) {
    return '↑';
  }
  if (value < -0.15) {
    return '↓';
  }
  return '→';
};

const AllMarketsModal = ({ open, items, activeSymbol, onClose, onSelectSymbol }: AllMarketsModalProps) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const value = query.trim().toUpperCase();
    if (!value) {
      return items;
    }
    return items.filter((item) => item.symbol.includes(value));
  }, [items, query]);

  const topGainers = useMemo(
    () =>
      items
        .filter((item) => item.price_change_percent != null)
        .slice()
        .sort((a, b) => (b.price_change_percent ?? 0) - (a.price_change_percent ?? 0))
        .slice(0, 3),
    [items]
  );

  const topLosers = useMemo(
    () =>
      items
        .filter((item) => item.price_change_percent != null)
        .slice()
        .sort((a, b) => (a.price_change_percent ?? 0) - (b.price_change_percent ?? 0))
        .slice(0, 3),
    [items]
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
      <div className="ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-white/10 bg-[#07101d] shadow-[-24px_0_80px_rgba(2,6,23,0.55)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">All Markets</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Browse market prices</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-outline/30 px-3 py-1.5 text-sm text-slate-300 transition hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search symbols..."
            className="w-full rounded-full border border-outline/30 bg-slate-900/45 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/70">Top Movers</p>
              <div className="mt-3 space-y-2">
                {topGainers.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-100">{item.symbol}</span>
                    <span className="text-emerald-300">{formatChange(item.price_change_percent)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-400/15 bg-rose-500/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-rose-200/70">Top Losers</p>
              <div className="mt-3 space-y-2">
                {topLosers.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-100">{item.symbol}</span>
                    <span className="text-rose-300">{formatChange(item.price_change_percent)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          <div className="space-y-2">
            {filtered.map((item) => {
              const positive = (item.price_change_percent ?? 0) >= 0;
              const isActive = item.symbol === activeSymbol;
              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => onSelectSymbol(item.symbol)}
                  className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-cyan-400/35 bg-cyan-500/10'
                      : 'border-outline/25 bg-slate-900/38 hover:border-outline/45 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{item.symbol}</p>
                      <span className={`text-xs ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {trendArrow(item.price_change_percent)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Volume {formatVolume(item.quote_volume ?? item.volume)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-white">{formatPrice(item.last_price)}</p>
                    <p className={`mt-1 text-xs ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {formatChange(item.price_change_percent)}
                    </p>
                  </div>
                </button>
              );
            })}
            {!filtered.length && (
              <div className="rounded-2xl border border-outline/25 bg-slate-900/35 px-4 py-6 text-center text-sm text-slate-400">
                No markets match your search.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllMarketsModal;
