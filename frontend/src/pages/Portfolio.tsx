import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createTrade, fetchPortfolio, PortfolioResponse, Trade } from '@/services/api';

const HERO_SUGGESTIONS = [
  { label: 'Export the latest trades to CSV', action: 'export' as const },
  { label: 'Ask the assistant for a portfolio risk review', href: '/assistant' },
  { label: 'Check the status of automation bots', href: '/dashboard' },
  { label: 'Add a ledger entry aligned with the signal engine', href: '#add-trade' }
];

type TradeSide = 'BUY' | 'SELL';

type FilterState = {
  symbol: string;
  side: string;
  startDate: string;
  endDate: string;
};

const defaultFilters: FilterState = {
  symbol: 'ALL',
  side: 'ALL',
  startDate: '',
  endDate: ''
};

const PortfolioPage = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<{ symbol: string; side: TradeSide; qty: number; price: number }>(
    { symbol: 'BTCUSDT', side: 'BUY', qty: 0.001, price: 0 }
  );
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const loadPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPortfolio();
      setPortfolio({ ...data, trades: data.trades ?? [] });
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Failed to fetch portfolio';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPortfolio();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setFormError(null);

    const symbol = form.symbol.trim().toUpperCase();
    const qty = Number(form.qty);
    const price = Number(form.price);
    if (symbol.length < 3) {
      setFormError('Symbol must be at least 3 characters.');
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      setFormError('Quantity must be a positive number.');
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setFormError('Price cannot be negative.');
      return;
    }

    try {
      await createTrade({ ...form, symbol, qty, price });
      setMessage('Trade saved.');
      await loadPortfolio();
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Failed to create trade';
      setMessage(messageText);
    }
  };

  const trades = useMemo(() => (portfolio?.trades ?? []) as Trade[], [portfolio]);

  const meta = useMemo(() => {
    if (!trades.length) {
      return null;
    }
    const volume = trades.reduce((acc, trade) => acc + trade.qty, 0);
    const net = trades.reduce(
      (acc, trade) => acc + (trade.side === 'BUY' ? trade.qty * trade.price : -trade.qty * trade.price),
      0
    );
    const last = trades[trades.length - 1];
    return { count: trades.length, volume, net, last };
  }, [trades]);

  const availableSymbols = useMemo(() => {
    const unique = new Set(trades.map((trade) => trade.symbol));
    return Array.from(unique).sort();
  }, [trades]);

  const filteredTrades = useMemo(() => {
    if (!trades.length) {
      return [];
    }
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
    return trades.filter((trade) => {
      const symbolMatch = filters.symbol === 'ALL' || trade.symbol === filters.symbol;
      const sideMatch = filters.side === 'ALL' || trade.side === filters.side;
      if (!symbolMatch || !sideMatch) {
        return false;
      }
      if (!startDate && !endDate) {
        return true;
      }
      const createdAt = trade.created_at ? new Date(trade.created_at) : null;
      if (startDate && (!createdAt || createdAt < startDate)) {
        return false;
      }
      if (endDate && (!createdAt || createdAt > endDate)) {
        return false;
      }
      return true;
    });
  }, [filters, trades]);

  const filteredSummary = useMemo(() => {
    if (!filteredTrades.length) {
      return { count: 0, volume: 0, net: 0 };
    }
    const volume = filteredTrades.reduce((acc, trade) => acc + trade.qty, 0);
    const net = filteredTrades.reduce(
      (acc, trade) => acc + (trade.side === 'BUY' ? trade.qty * trade.price : -trade.qty * trade.price),
      0
    );
    return { count: filteredTrades.length, volume, net };
  }, [filteredTrades]);

  const handleExport = () => {
    if (!filteredTrades.length) {
      return;
    }
    const header = 'id,symbol,side,qty,price,created_at\n';
    const rows = filteredTrades
      .map((trade) =>
        [
          trade.id,
          trade.symbol,
          trade.side,
          trade.qty,
          trade.price,
          trade.created_at ?? ''
        ]
          .map((value) => `${value}`.replace(/"/g, ''))
          .join(',')
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cortexa_trades_${new Date().toISOString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-60 rounded-full bg-muted/80 animate-pulse" />
        <div className="h-64 rounded-3xl border border-outline/40 bg-surface animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <section className="text-center">
        <header className="space-y-4">
          <span className="text-xs uppercase tracking-[0.4em] text-slate-500">Portfolio updates</span>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            Log trades, monitor risk, stay in sync with automation.
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400">
            Keep a ledger aligned with Cortexa signals and automation flows. Record external fills, filter performance, and export whenever you need.
          </p>
        </header>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <Link
            to="/signals"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 font-medium text-black shadow-inner-glow transition hover:bg-slate-200"
          >
            Go to signals
          </Link>
          <Link
            to="/assistant"
            className="inline-flex items-center gap-2 rounded-full border border-outline/50 px-4 py-2 text-slate-200 transition hover:border-outline hover:text-white"
          >
            Open the assistant ↗
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          {HERO_SUGGESTIONS.map((item) => {
            if (item.action === 'export') {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={handleExport}
                  className="rounded-2xl border border-outline/40 bg-surface px-4 py-2 transition hover:border-outline hover:text-white"
                >
                  {item.label} ↗
                </button>
              );
            }
            if (item.href?.startsWith('#')) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="rounded-2xl border border-outline/40 bg-surface px-4 py-2 transition hover:border-outline hover:text-white"
                >
                  {item.label} ↗
                </a>
              );
            }
            return (
              <Link
                key={item.label}
                to={item.href ?? '/'}
                className="rounded-2xl border border-outline/40 bg-surface px-4 py-2 transition hover:border-outline hover:text-white"
              >
                {item.label} ↗
              </Link>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200 text-center">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-3xl border border-primary/40 bg-primary/20 p-4 text-sm text-primary text-center">
          {message}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <article id="add-trade" className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Add a trade</h2>
              <p className="text-sm text-slate-400">Log external fills and keep your analytics in sync.</p>
            </div>
            {meta && (
              <div className="grid gap-1 text-right text-xs text-slate-400">
                <span>Total trades: <span className="text-slate-200">{meta.count}</span></span>
                <span>Net exposure: <span className="text-slate-200">{meta.net.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span></span>
                <span>Volume: <span className="text-slate-200">{meta.volume.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></span>
              </div>
            )}
          </header>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Symbol
              <input
                value={form.symbol}
                onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
                className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Side
              <select
                value={form.side}
                onChange={(event) => setForm((prev) => ({ ...prev, side: event.target.value as TradeSide }))}
                className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </label>
            <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Quantity
              <input
                type="number"
                min="0"
                step="0.0001"
                value={form.qty}
                onChange={(event) => setForm((prev) => ({ ...prev, qty: Number(event.target.value) }))}
                className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Price
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: Number(event.target.value) }))}
                className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <div className="sm:col-span-2 flex items-center justify-between text-xs text-slate-500">
              <span>Log fills executed outside of automation to keep the ledger complete.</span>
              <button
                type="submit"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-inner-glow transition hover:bg-slate-200"
              >
                Save trade
              </button>
            </div>
            {formError && <p className="sm:col-span-2 text-xs text-rose-300">{formError}</p>}
          </form>
        </article>

        <aside className="space-y-6">
          <div id="filters" className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Filters</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Symbol
                <select
                  value={filters.symbol}
                  onChange={(event) => setFilters((prev) => ({ ...prev, symbol: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL">All</option>
                  {availableSymbols.map((symbol) => (
                    <option key={symbol} value={symbol}>{symbol}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Side
                <select
                  value={filters.side}
                  onChange={(event) => setFilters((prev) => ({ ...prev, side: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL">All</option>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </label>
              <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Start date
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.28em] text-slate-500">
                End date
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <button
                type="button"
                onClick={() => setFilters(defaultFilters)}
                className="rounded-full border border-outline/50 px-4 py-2 text-xs text-slate-300 transition hover:border-outline hover:text-white"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-inner-glow transition hover:bg-slate-200"
              >
                Export CSV
              </button>
              <div className="rounded-2xl border border-outline/30 bg-muted/60 p-4 text-xs text-slate-300">
                <p>Filtered trades</p>
                <p className="mt-1 text-white">{filteredSummary.count} records • {filteredSummary.volume.toFixed(4)} volume</p>
                <p className="text-white">Net {filteredSummary.net.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft text-xs text-slate-300">
            <h3 className="text-lg font-semibold text-white">Tips</h3>
            <ul className="mt-3 space-y-2 list-disc pl-4">
              <li>Record every external trade to stay aligned with the signal engine.</li>
              <li>Use filters to inspect performance for a specific bot or symbol.</li>
              <li>Export CSV data into notebooks or dashboards for deeper analysis.</li>
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">Enterprise unlocks automated sync integrations.</p>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Trade history</h2>
            <p className="text-sm text-slate-400">Filtered results appear below. The newest entries sit at the end of the list.</p>
          </div>
        </header>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm text-slate-300">
            <thead>
              <tr className="border-b border-outline/30 text-xs uppercase tracking-[0.28em] text-slate-500">
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Side</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length ? (
                filteredTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-outline/20">
                    <td className="px-3 py-2 text-white">{trade.symbol}</td>
                    <td className="px-3 py-2 text-white">{trade.side}</td>
                    <td className="px-3 py-2 text-right text-white">{trade.qty.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right text-white">{trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {trade.created_at ? new Date(trade.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    No trades match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PortfolioPage;
