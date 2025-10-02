import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchSignal,
  triggerAutoTrade,
  fetchBacktest,
  SignalResponse,
  BacktestResponse
} from '@/services/api';
import { useToast } from '@/components/ToastProvider';

const primarySymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'XRPUSDT', 'DOGEUSDT'] as const;
const secondarySymbols = ['BNBUSDT', 'ADAUSDT', 'LINKUSDT', 'MATICUSDT', 'DOTUSDT', 'NEARUSDT', 'ATOMUSDT'];

const symbolLabels: Record<string, string> = {
  BTCUSDT: 'Bitcoin',
  ETHUSDT: 'Ethereum',
  SOLUSDT: 'Solana',
  AVAXUSDT: 'Avalanche',
  XRPUSDT: 'XRP',
  DOGEUSDT: 'Dogecoin',
  BNBUSDT: 'BNB',
  ADAUSDT: 'Cardano',
  LINKUSDT: 'Chainlink',
  MATICUSDT: 'Polygon',
  DOTUSDT: 'Polkadot',
  NEARUSDT: 'NEAR',
  ATOMUSDT: 'Cosmos'
};

const defaultSymbol = primarySymbols[0];
const DEFAULT_THRESHOLD = '0.65';
const DEFAULT_QTY = '0.001';

const formatCurrency = (value: number | undefined | null, digits = 2) =>
  typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';

const SignalsPage = () => {
  const [activeSymbol, setActiveSymbol] = useState(defaultSymbol);
  const [searchValue, setSearchValue] = useState(defaultSymbol);
  const [signal, setSignal] = useState<SignalResponse | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalError, setSignalError] = useState<string | null>(null);
  const [autoThreshold, setAutoThreshold] = useState(DEFAULT_THRESHOLD);
  const [autoQty, setAutoQty] = useState(DEFAULT_QTY);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const { pushToast } = useToast();

  const loadSignal = useCallback(async (rawSymbol: string) => {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol) {
      return;
    }
    setSignalLoading(true);
    setSignalError(null);
    try {
      const data = await fetchSignal(symbol);
      setSignal(data);
      setActiveSymbol(symbol);
      setSearchValue(symbol);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load signal';
      setSignal(null);
      setSignalError(message);
    } finally {
      setSignalLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSignal(defaultSymbol);
  }, [loadSignal]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadSignal(searchValue);
  };

  const handleChipClick = (symbol: string) => {
    if (symbol !== activeSymbol) {
      void loadSignal(symbol);
    }
  };

  const handleAutoTrade = async () => {
    const threshold = Number.parseFloat(autoThreshold);
    const qty = Number.parseFloat(autoQty);
    if (!Number.isFinite(threshold) || !Number.isFinite(qty)) {
      pushToast('Provide numeric threshold and quantity', 'warning');
      return;
    }
    setAutoBusy(true);
    setAutoStatus(null);
    try {
      const result = await triggerAutoTrade(activeSymbol, threshold, qty);
      const message = result.executed
        ? `Automation armed at score ${result.score.toFixed(2)}`
        : result.reason ?? 'Automation queued';
      setAutoStatus(message);
      pushToast(message, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to configure automation';
      setAutoStatus(message);
      pushToast(message, 'error');
    } finally {
      setAutoBusy(false);
    }
  };

  const runQuickBacktest = async () => {
    setBacktestLoading(true);
    setBacktestError(null);
    try {
      const report = await fetchBacktest(activeSymbol, {
        threshold: Number.parseFloat(autoThreshold) || 0.65,
        horizon: 4,
        limit: 400,
        commission_bps: 4,
        slippage_bps: 1,
        position_size: 1
      });
      setBacktest(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backtest failed';
      setBacktest(null);
      setBacktestError(message);
      pushToast(message, 'warning');
    } finally {
      setBacktestLoading(false);
    }
  };

  const detailMetrics = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      {
        label: 'Signal score',
        value: signal.score.toFixed(2)
      },
      {
        label: 'Confidence',
        value: signal.confidence ? `${Math.round(signal.confidence * 100)}%` : '—'
      },
      {
        label: 'Side',
        value: signal.side ?? '—'
      },
      {
        label: 'Horizon',
        value: signal.horizon ?? '—'
      }
    ];
  }, [signal]);

  const technicals = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      {
        label: 'Price',
        value: signal.price !== undefined ? formatCurrency(signal.price, 2) : '—'
      },
      {
        label: 'RSI',
        value: signal.rsi !== undefined ? signal.rsi.toFixed(1) : '—'
      },
      {
        label: 'ATR',
        value: signal.atr !== undefined ? signal.atr.toFixed(2) : '—'
      },
      {
        label: 'EMA fast / slow',
        value:
          signal.ema_fast !== undefined && signal.ema_slow !== undefined
            ? `${signal.ema_fast.toFixed(2)} / ${signal.ema_slow.toFixed(2)}`
            : '—'
      }
    ];
  }, [signal]);

  const riskTargets = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      {
        label: 'Suggested allocation',
        value: signal.suggested_allocation ?? '—'
      },
      {
        label: 'Entry',
        value: signal.entry_price !== undefined ? formatCurrency(signal.entry_price) : '—'
      },
      {
        label: 'Take profit',
        value: signal.take_profit !== undefined ? formatCurrency(signal.take_profit) : '—'
      },
      {
        label: 'Stop loss',
        value: signal.stop_loss !== undefined ? formatCurrency(signal.stop_loss) : '—'
      }
    ];
  }, [signal]);

  const backtestSummary = useMemo(() => {
    if (!backtest) {
      return [];
    }
    return [
      {
        label: 'Trades',
        value: backtest.trades?.toString() ?? '—'
      },
      {
        label: 'Hit rate',
        value:
          typeof backtest.hit_rate === 'number' ? `${(backtest.hit_rate * 100).toFixed(1)}%` : '—'
      },
      {
        label: 'Net return',
        value:
          typeof backtest.net_return_sum === 'number'
            ? `${(backtest.net_return_sum * 100).toFixed(2)}%`
            : '—'
      },
      {
        label: 'Max drawdown',
        value:
          typeof backtest.max_drawdown === 'number' ? `${(backtest.max_drawdown * 100).toFixed(1)}%` : '—'
      }
    ];
  }, [backtest]);

  const biasBadge = useMemo(() => {
    if (!signal) {
      return { label: 'No signal', tone: 'border-outline/50 text-slate-300 bg-surface/60' };
    }
    if (signal.side === 'BUY') {
      return { label: 'Buy bias', tone: 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10' };
    }
    if (signal.side === 'SELL') {
      return { label: 'Sell bias', tone: 'border-rose-500/40 text-rose-200 bg-rose-500/10' };
    }
    return { label: 'Neutral', tone: 'border-amber-500/40 text-amber-200 bg-amber-500/10' };
  }, [signal]);

  return (
    <div className="space-y-14">
      <section className="rounded-3xl border border-outline/40 bg-surface/70 p-8 shadow-elevation-soft backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-outline/60 bg-surface/70 px-3 py-1 text-xs uppercase tracking-[0.4em] text-slate-400">
              Live signal intelligence
            </span>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              Scan, validate, and automate high-conviction trades in real time.
            </h1>
            <p className="max-w-2xl text-base text-slate-300">
              Pick a market, inspect the AI signal stack, then arm execution with guardrails. Everything stays in sync with your automation rules and assistant workflows.
            </p>
            <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value.toUpperCase())}
                placeholder="Search symbol (e.g. BTCUSDT)"
                className="w-full max-w-xs rounded-full border border-outline/60 bg-canvas/60 px-4 py-2 text-sm text-ink placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
              <button
                type="submit"
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-elevation transition hover:bg-primary/90"
              >
                Load signal
              </button>
            </form>
          </div>
          <div className="w-full max-w-sm space-y-4">
            <div className="flex flex-wrap gap-2">
              {primarySymbols.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => handleChipClick(sym)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    activeSymbol === sym
                      ? 'border-primary bg-primary/20 text-white'
                      : 'border-outline/50 bg-surface/70 text-slate-300 hover:border-outline'
                  }`}
                >
                  {symbolLabels[sym] ?? sym}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              {secondarySymbols.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => handleChipClick(sym)}
                  className="rounded-full border border-outline/40 bg-surface/60 px-3 py-1 text-slate-400 transition hover:border-outline hover:text-white"
                >
                  {symbolLabels[sym] ?? sym}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{activeSymbol}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {symbolLabels[activeSymbol] ?? activeSymbol}
              </h2>
            </div>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${biasBadge.tone}`}>
              {biasBadge.label}
            </span>
          </header>

          <div className="mt-6 space-y-6">
            {signalLoading ? (
              <div className="h-40 rounded-2xl border border-outline/30 bg-surface/60 shadow-inner-glow animate-pulse" />
            ) : signalError ? (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
                {signalError}
              </div>
            ) : signal ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Signal summary</h3>
                  <dl className="grid gap-4">
                    {detailMetrics.map((metric) => (
                      <div key={metric.label} className="flex items-center justify-between">
                        <dt className="text-sm text-slate-400">{metric.label}</dt>
                        <dd className="text-sm font-medium text-white">{metric.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Technicals</h3>
                  <dl className="grid gap-4">
                    {technicals.map((metric) => (
                      <div key={metric.label} className="flex items-center justify-between">
                        <dt className="text-sm text-slate-400">{metric.label}</dt>
                        <dd className="text-sm font-medium text-white">{metric.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-outline/30 bg-surface/70 p-6 text-sm text-slate-300">
                Choose a market to load the latest AI signal snapshot.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {riskTargets.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-outline/30 bg-surface/60 p-4 shadow-inner-glow"
                >
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{metric.label}</p>
                  <p className="mt-2 text-sm font-medium text-white">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Automation</h3>
            <p className="mt-1 text-sm text-slate-400">
              Arm an auto-trade once the score clears a threshold. Runs on your connected exchange credentials.
            </p>
            <div className="mt-4 space-y-4 text-sm">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Threshold</span>
                <input
                  value={autoThreshold}
                  onChange={(event) => setAutoThreshold(event.target.value)}
                  className="mt-1 w-full rounded-full border border-outline/50 bg-canvas/60 px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Quantity</span>
                <input
                  value={autoQty}
                  onChange={(event) => setAutoQty(event.target.value)}
                  className="mt-1 w-full rounded-full border border-outline/50 bg-canvas/60 px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </label>
              <button
                type="button"
                onClick={handleAutoTrade}
                disabled={autoBusy}
                className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-elevation transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {autoBusy ? 'Configuring…' : 'Arm automation'}
              </button>
              {autoStatus && <p className="text-xs text-slate-400">{autoStatus}</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Quick backtest</h3>
              <button
                type="button"
                onClick={runQuickBacktest}
                className="rounded-full border border-outline/50 px-3 py-1 text-xs text-slate-300 transition hover:border-outline hover:text-white"
              >
                Run
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              400 trades, 4h horizon, 4 bps commission, 1 bps slippage.
            </p>
            {backtestLoading ? (
              <div className="mt-4 h-28 rounded-2xl border border-outline/30 bg-surface/60 shadow-inner-glow animate-pulse" />
            ) : backtestError ? (
              <p className="mt-4 text-xs text-rose-200">{backtestError}</p>
            ) : backtest ? (
              <dl className="mt-4 space-y-3 text-sm">
                {backtestSummary.map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between">
                    <dt className="text-slate-400">{metric.label}</dt>
                    <dd className="text-white">{metric.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-xs text-slate-400">Run the backtest to populate historical performance.</p>
            )}
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface/70 p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Need context?</h3>
            <p className="mt-2 text-sm text-slate-400">
              Dive into the methodology docs and assistant prompt packs to get the most from signal outputs.
            </p>
            <div className="mt-5 space-y-2 text-xs text-accent">
              <Link to="/assistant" className="block transition hover:text-white">
                Ask the assistant for trade rationale →
              </Link>
              <Link to="/forum" className="block transition hover:text-white">
                Read strategy breakdowns from the desk →
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default SignalsPage;
