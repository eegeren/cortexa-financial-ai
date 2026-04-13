import { useEffect, useRef, useState } from 'react';
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

const MarketStrip = ({ items, loading = false, activeSymbol, onSelectSymbol, onViewAll }: MarketStripProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const updateFades = () => {
      const maxScrollLeft = node.scrollWidth - node.clientWidth;
      setShowLeftFade(node.scrollLeft > 6);
      setShowRightFade(maxScrollLeft - node.scrollLeft > 6);
    };

    updateFades();
    node.addEventListener('scroll', updateFades, { passive: true });
    window.addEventListener('resize', updateFades);

    return () => {
      node.removeEventListener('scroll', updateFades);
      window.removeEventListener('resize', updateFades);
    };
  }, [items, loading]);

  return (
    <div className="relative z-10">
      <div className="rounded-[1.75rem] border border-white/10 border-b-white/12 bg-slate-950/82 px-4 py-3.5 shadow-[0_18px_50px_rgba(2,6,23,0.24)] backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/72">
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

        <div className="relative mt-3">
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-l-[1.4rem] bg-gradient-to-r from-slate-950/70 to-transparent transition-opacity duration-300 ${
              showLeftFade ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-[1.4rem] bg-gradient-to-l from-slate-950/70 to-transparent transition-opacity duration-300 ${
              showRightFade ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {loading
              ? Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="h-[84px] min-w-[186px] animate-pulse rounded-[1.35rem] border border-outline/20 bg-slate-900/45" />
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
                      className={`min-w-[186px] rounded-[1.35rem] border px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out ${
                        isActive
                          ? 'border-cyan-400/35 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_30px_rgba(34,211,238,0.10),0_18px_42px_rgba(8,47,73,0.24)]'
                          : 'border-outline/25 bg-slate-900/42 shadow-[0_0_0_1px_rgba(148,163,184,0.04)] hover:border-outline/45 hover:bg-slate-900/58 hover:shadow-[0_0_0_1px_rgba(148,163,184,0.08),0_12px_28px_rgba(2,6,23,0.18)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold tracking-[0.16em] text-slate-100">{item.symbol}</p>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs ${tone} transition-colors duration-300`}>{trendArrow(item.price_change_percent)}</span>
                          <span className={`text-xs font-medium ${tone} transition-colors duration-300`}>
                            {formatChange(item.price_change_percent)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2.5 text-[1.15rem] font-semibold text-white transition-colors duration-300">{formatPrice(item.last_price)}</p>
                    </button>
                  );
                })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketStrip;
