import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import Spinner from '@/components/Spinner';
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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const res = await fetchLatestPrice(symbol, interval);
            return { symbol: res.symbol, price: res.price ?? null, time: res.time ?? null, interval } as MarketRow;
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
    }
  };

  const signature = useMemo(() => symbols.join(','), [symbols]);

  useEffect(() => {
    void load();
    if (!refreshMs) {
      return undefined;
    }
    const id = window.setInterval(() => {
      void load();
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [interval, refreshMs, signature]);

  const sorted = useMemo(() => rows.slice().sort((a, b) => a.symbol.localeCompare(b.symbol)), [rows]);

  return (
    <Card className="h-full bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-950">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Market Watch</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Spot Snapshot</h2>
          <p className="text-xs text-slate-500">Interval • {interval}</p>
        </div>
        {updatedAt && <span className="text-xs text-slate-500">{updatedAt.toLocaleTimeString()}</span>}
      </div>

      {loading && <Spinner />}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="mt-5 space-y-4">
          {sorted.map((row) => (
            <div
              key={row.symbol}
              className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-900/40 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-white">
                  {symbolLabels[row.symbol] ?? row.symbol}
                </p>
                <p className="text-[11px] text-slate-500">{row.symbol}</p>
                {row.time && <p className="text-[11px] text-slate-500">{row.time.toLocaleTimeString()}</p>}
                {row.error && <p className="text-[11px] text-red-400">{row.error}</p>}
              </div>
              <p className="text-lg font-semibold text-accent">
                {row.price ? row.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--'}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default MarketWidget;
