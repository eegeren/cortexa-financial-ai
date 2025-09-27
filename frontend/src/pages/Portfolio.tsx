import { FormEvent, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Spinner from '@/components/Spinner';
import Banner from '@/components/Banner';
import { createTrade, fetchPortfolio, PortfolioResponse, Trade } from '@/services/api';
import { Link } from 'react-router-dom';

const topSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'XRPUSDT', 'DOGEUSDT'];
const symbolLabels: Record<string, string> = {
  BTCUSDT: 'Bitcoin',
  ETHUSDT: 'Ethereum',
  SOLUSDT: 'Solana',
  AVAXUSDT: 'Avalanche',
  XRPUSDT: 'XRP',
  DOGEUSDT: 'Dogecoin'
};

type TradeSide = 'BUY' | 'SELL';

const PortfolioPage = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<{ symbol: string; side: TradeSide; qty: number; price: number }>(
    { symbol: 'BTCUSDT', side: 'BUY', qty: 0.001, price: 0 }
  );
  const [filters, setFilters] = useState({ symbol: 'ALL', side: 'ALL', startDate: '', endDate: '' });

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
      setMessage('Trade added successfully.');
      await loadPortfolio();
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Failed to create trade';
      setMessage(messageText);
    }
  };

  const meta = useMemo(() => {
    if (!portfolio) {
      return null;
    }
    const trades = (portfolio.trades ?? []) as Trade[];
    const volume = trades.reduce<number>((acc, trade) => acc + trade.qty, 0);
    const net = trades.reduce<number>(
      (acc, trade) => acc + (trade.side === 'BUY' ? trade.qty * trade.price : -trade.qty * trade.price),
      0
    );
    const last = trades[0];
    return { count: trades.length, volume, net, last };
  }, [portfolio]);

  const availableSymbols = useMemo(() => {
    const trades = (portfolio?.trades ?? []) as Trade[];
    const uniques = new Set(trades.map((trade) => trade.symbol));
    return Array.from(uniques).sort();
  }, [portfolio]);

  const filteredTrades = useMemo(() => {
    const trades = (portfolio?.trades ?? []) as Trade[];
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
  }, [filters, portfolio]);

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolio"
        description="Review executed trades and record manual entries for external fills."
        actions={
          <Link
            to="/signals"
            className="rounded-full border border-primary/60 px-4 py-2 text-sm text-primary transition hover:border-primary hover:text-slate-50"
          >
            Jump to signals
          </Link>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="relative overflow-hidden border-slate-700/60 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950">
          <div className="pointer-events-none absolute -top-24 right-[-6rem] h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Manual ledger</p>
                <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Quick trade entry</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Register fills from other venues or backdate entries to keep your statistics aligned.
                </p>
              </div>
              {meta && (
                <div className="grid gap-2 text-right text-xs text-slate-400">
                  <span>{meta.count} trades logged</span>
                  <span>Total volume {meta.volume.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                  <span>Net exposure {meta.net.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
                </div>
              )}
            </header>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Symbol
                <input
                  value={form.symbol}
                  onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  required
                />
              </label>
              <div className="md:col-span-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Quick symbols</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {topSymbols.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, symbol: sym }))}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        form.symbol.toUpperCase() === sym
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-slate-700 text-slate-300 hover:border-primary/60 hover:text-primary'
                      }`}
                    >
                      {symbolLabels[sym] ?? sym}
                    </button>
                  ))}
                </div>
              </div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Side
            <select
              value={form.side}
              onChange={(event) => setForm((prev) => ({ ...prev, side: event.target.value as TradeSide }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Quantity
                <input
                  type="number"
                  min={0}
                  step={0.0001}
                  value={form.qty}
                  onChange={(event) => setForm((prev) => ({ ...prev, qty: Number(event.target.value) }))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  required
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Price
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={(event) => setForm((prev) => ({ ...prev, price: Number(event.target.value) }))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  required
                />
              </label>
              <div className="md:col-span-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary/80"
                  >
                    Add trade
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ symbol: 'BTCUSDT', side: 'BUY', qty: 0.001, price: 0 })}
                    className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
                <div className="space-y-1 text-sm text-slate-400 text-right">
                  {formError && <p className="text-xs text-red-400">{formError}</p>}
                  {message && <p>{message}</p>}
                </div>
              </div>
            </form>
          </div>
        </Card>

      <Card className="bg-slate-900/70">
        <h3 className="text-lg font-semibold text-white">Best practices</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>• Record Binance auto-trades here to keep your history centralised.</li>
          <li>• Use SELL entries with zero price for exit markers, then adjust later.</li>
          <li>• Export data regularly once CSV/analytics tooling is connected.</li>
        </ul>
      </Card>

      <Card className="bg-slate-900/70">
        <h3 className="text-lg font-semibold text-white">Filtreler</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Sembol
            <select
              value={filters.symbol}
              onChange={(event) => setFilters((prev) => ({ ...prev, symbol: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            >
              <option value="ALL">Tümü</option>
              {availableSymbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Yön
            <select
              value={filters.side}
              onChange={(event) => setFilters((prev) => ({ ...prev, side: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            >
              <option value="ALL">Tümü</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Başlangıç
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Bitiş
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>
            Toplam kayıt: <span className="font-semibold text-slate-200">{filteredSummary.count}</span>
          </span>
          <span>
            Hacim: <span className="font-semibold text-slate-200">{filteredSummary.volume.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          </span>
          <span>
            Net: <span className="font-semibold text-slate-200">{filteredSummary.net.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setFilters({ symbol: 'ALL', side: 'ALL', startDate: '', endDate: '' })}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300 transition hover:border-primary hover:text-white"
          >
            Filtreleri sıfırla
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-full bg-primary/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary"
            disabled={!filteredSummary.count}
          >
            CSV indir
          </button>
        </div>
      </Card>
    </div>

    {loading && <Spinner />}

    {!loading && portfolio && (
      <Card className="bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">Trade history</h3>
            {meta?.last && (
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                Last entry: {meta.last.symbol} {meta.last.side} @{' '}
                {meta.last.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr className="bg-slate-900/60">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredTrades.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      {(portfolio.trades ?? []).length === 0
                        ? 'You haven’t added any trades yet.'
                        : 'Filtrelere uygun kayıt bulunamadı.'}
                    </td>
                  </tr>
                )}
                {filteredTrades.map((trade) => (
                  <tr key={trade.id} className="transition hover:bg-slate-900/40">
                    <td className="px-4 py-2 text-slate-400">{trade.id}</td>
                    <td className="px-4 py-2 font-medium text-slate-100">
                      {trade.symbol}
                      <span className="ml-2 text-xs text-slate-500">
                        {symbolLabels[trade.symbol] ?? ''}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          trade.side === 'BUY'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-200">
                      {trade.qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </td>
                    <td className="px-4 py-2 text-slate-200">
                      {trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {trade.created_at ? new Date(trade.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PortfolioPage;
