import { MarketSummaryItem } from '@/services/api';

type MarketStripProps = {
  items: MarketSummaryItem[];
  loading?: boolean;
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onViewAll: () => void;
};

const formatPrice = (value?: number | null) =>
  value == null ? '--' : value.toLocaleString(undefined, { maximumFractionDigits: value >= 1000 ? 2 : 4 });

const formatChange = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
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

const MarketStrip = ({ items, loading = false, activeSymbol, onSelectSymbol, onViewAll }: MarketStripProps) => (
  <div className="sticky top-20 z-20 rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 shadow-[0_18px_50px_rgba(2,6,23,0.28)] backdrop-blur-md">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Markets</p>
      <button
        type="button"
        onClick={onViewAll}
        className="rounded-full border border-outline/30 bg-slate-900/45 px-3 py-1.5 text-xs text-slate-200 transition hover:border-outline/50 hover:text-white"
      >
        View all
      </button>
    </div>

    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {loading
        ? Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-16 min-w-[170px] animate-pulse rounded-2xl border border-outline/20 bg-slate-900/45" />
          ))
        : items.map((item) => {
            const positive = (item.price_change_percent ?? 0) >= 0;
            const tone =
              item.price_change_percent == null ? 'text-slate-400' : positive ? 'text-emerald-300' : 'text-rose-300';
            const isActive = item.symbol === activeSymbol;
            return (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelectSymbol(item.symbol)}
                className={`min-w-[170px] rounded-2xl border px-3 py-3 text-left transition ${
                  isActive
                    ? 'border-cyan-400/35 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_16px_40px_rgba(8,47,73,0.22)]'
                    : 'border-outline/25 bg-slate-900/42 hover:border-outline/45 hover:bg-slate-900/58'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-[0.16em] text-slate-100">{item.symbol}</p>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs ${tone}`}>{trendArrow(item.price_change_percent)}</span>
                    <span className={`text-xs font-medium ${tone}`}>{formatChange(item.price_change_percent)}</span>
                  </div>
                </div>
                <p className="mt-2 text-lg font-semibold text-white">{formatPrice(item.last_price)}</p>
              </button>
            );
          })}
    </div>
  </div>
);

export default MarketStrip;
