import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import Skeleton from '@/components/Skeleton';
import { fetchLatestPrice } from '@/services/api';

interface MarketWidgetProps {
  symbols?: string[];
  interval?: string;
  refreshMs?: number;
}

type MarketRow = {
  symbol: string;
  price: number | null;
  time: Date | null;
  interval?: string;
  error?: string;
};

const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'XRPUSDT', 'DOGEUSDT'];

const symbolLabels: Record<string, string> = {
  BTCUSDT: 'Bitcoin',
  ETHUSDT: 'Ethereum',
  SOLUSDT: 'Solana',
  AVAXUSDT: 'Avalanche',
  XRPUSDT: 'XRP',
  DOGEUSDT: 'Dogecoin'
};

const MarketWidget = ({ symbols = defaultSymbols, interval = '1h', refreshMs = 45000 }: MarketWidgetProps) => {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const { silent = false } = opts;
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const data = await Promise.all(
          symbols.map(async (symbol) => {
            try {
              const res = await fetchLatestPrice(symbol, interval);
              return {
                symbol: res.symbol,
                price: res.price ?? null,
                time: res.time ?? null,
                interval
              } as MarketRow;
            } catch (err) {
              const message = err instanceof Error ? err.message : 'unknown error';
              return { symbol, price: null, time: null, interval, error: message };
            }
          })
        );
        setRows(data);
        setUpdatedAt(new Date());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load prices';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [interval, symbols]
  );

  const signature = useMemo(() => symbols.join(','), [symbols]);
  const placeholders = useMemo(() => symbols.slice(0, 6), [symbols]);

  useEffect(() => {
    void load();
    if (!refreshMs) {
      return undefined;
    }
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [load, refreshMs, signature]);

  const sorted = useMemo(() => rows.slice().sort((a, b) => a.symbol.localeCompare(b.symbol)), [rows]);
  const hasMeaningfulData = useMemo(
    () => sorted.some((row) => row.price !== null || row.error),
    [sorted]
  );

  return (
    <Card className="h-full bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Market Watch</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Spot Snapshot</h2>
          <p className="text-xs text-slate-500">Interval • {interval}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          {updatedAt && <span>Updated {updatedAt.toLocaleTimeString()}</span>}
          <button
            type="button"
            onClick={() => void load({ silent: true })}
            className="rounded-full border border-slate-700 px-3 py-1 font-semibold text-slate-300 transition hover:border-primary hover:text-primary disabled:opacity-50"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-5 space-y-3">
          {placeholders.map((placeholder) => (
            <Skeleton key={placeholder} className="h-16 w-full" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && hasMeaningfulData && (
        <div className="mt-5 space-y-3">
          {sorted.map((row) => (
            <div
              key={row.symbol}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-800/50 bg-slate-900/40 px-4 py-3 transition hover:border-primary/60 hover:bg-slate-900/70"
            >
              <div>
                <p className="text-sm font-semibold text-white">{symbolLabels[row.symbol] ?? row.symbol}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>{row.symbol}</span>
                  {row.time && <span>• {row.time.toLocaleTimeString()}</span>}
                  {row.error && <span className="text-rose-300">• {row.error}</span>}
                </div>
              </div>
              <p className="text-lg font-semibold text-accent">
                {row.price ? row.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--'}
              </p>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && !hasMeaningfulData && (
        <div className="mt-5 rounded border border-slate-800/60 bg-slate-900/50 p-4 text-sm text-slate-400">
          No market data yet. Try refreshing or adjust the symbol list.
        </div>
      )}
    </Card>
  );
};

export default MarketWidget;
