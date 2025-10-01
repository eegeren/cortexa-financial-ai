import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import {
  fetchSignal,
  SignalResponse,
  triggerAutoTrade,
  fetchBacktest,
  BacktestResponse,
  fetchBacktestSweep,
  BacktestSweepResponse
} from '@/services/api';
import Banner from '@/components/Banner';
import { useAuthStore } from '@/store/auth';
import TrendChart from '@/components/TrendChart';
import MetricCard from '@/components/MetricCard';
import HeatmapMatrix from '@/components/HeatmapMatrix';
import { useToast } from '@/components/ToastProvider';
import Skeleton from '@/components/Skeleton';

// Primary quick chips (stay concise)
const topSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'XRPUSDT', 'DOGEUSDT'];

// Extended markets we now support on the backend as well
const extraSymbols = [
  'BNBUSDT', 'ADAUSDT', 'TONUSDT', 'TRXUSDT', 'LINKUSDT', 'MATICUSDT',
  'DOTUSDT', 'LTCUSDT', 'OPUSDT', 'ARBUSDT', 'APTUSDT', 'NEARUSDT',
  'ATOMUSDT', 'SUIUSDT', 'PEPEUSDT', 'SHIBUSDT'
];

const symbolLabels: Record<string, string> = {
  BTCUSDT: 'Bitcoin',
  ETHUSDT: 'Ethereum',
  SOLUSDT: 'Solana',
  AVAXUSDT: 'Avalanche',
  XRPUSDT: 'XRP',
  DOGEUSDT: 'Dogecoin',
  BNBUSDT: 'BNB',
  ADAUSDT: 'Cardano',
  TONUSDT: 'TON',
  TRXUSDT: 'TRON',
  LINKUSDT: 'Chainlink',
  MATICUSDT: 'Polygon',
  DOTUSDT: 'Polkadot',
  LTCUSDT: 'Litecoin',
  OPUSDT: 'Optimism',
  ARBUSDT: 'Arbitrum',
  APTUSDT: 'Aptos',
  NEARUSDT: 'NEAR',
  ATOMUSDT: 'Cosmos',
  SUIUSDT: 'Sui',
  PEPEUSDT: 'PEPE',
  SHIBUSDT: 'Shiba Inu'
};

const allSymbols: string[] = Array.from(new Set([...topSymbols, ...extraSymbols]));

const defaultSymbol = topSymbols[0];

const quantileKeys = ['p05', 'p25', 'p50', 'p75', 'p95'] as const;
const quantileLabels: Record<(typeof quantileKeys)[number], string> = {
  p05: '5th pct',
  p25: '25th pct',
  p50: 'Median',
  p75: '75th pct',
  p95: '95th pct'
};

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://cortexa-financial-ai.onrender.com';
const SCORE_HISTORY_LIMIT = 120;

const SignalsPage = () => {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const role = useAuthStore((state) => state.role);
  const token = useAuthStore((state) => state.token);
  const canRunBacktest = role === 'admin';
  const isPremium = role === 'admin' || role === 'premium';
  const [signal, setSignal] = useState<SignalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoThreshold, setAutoThreshold] = useState(0.6);
  const [autoQty, setAutoQty] = useState(0.001);
  const [autoResult, setAutoResult] = useState<string | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestThreshold, setBacktestThreshold] = useState(0.6);
  const [backtestLimit, setBacktestLimit] = useState(400);
  const [backtestHorizon, setBacktestHorizon] = useState(4);
  const [commissionBps, setCommissionBps] = useState(4);
  const [slippageBps, setSlippageBps] = useState(1);
  const [positionSize, setPositionSize] = useState(1);
  const [sweepThresholds, setSweepThresholds] = useState('0.4,0.5,0.6,0.7');
  const [sweepHorizons, setSweepHorizons] = useState('2,4,6');
  const [sweep, setSweep] = useState<BacktestSweepResponse | null>(null);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const prevSideRef = useRef<string | undefined>();
  const prevScoreRef = useRef<number | undefined>();
  const { pushToast } = useToast();

  const formatNumber = (value: number | undefined | null, digits = 2) =>
    typeof value === 'number' ? value.toFixed(digits) : '--';

  const formatPercent = (value: number | undefined | null, digits = 2) =>
    typeof value === 'number' ? `${(value * 100).toFixed(digits)}%` : '--';

  const sideMeta = useMemo(() => {
    switch (signal?.side) {
      case 'BUY':
        return {
          badge: 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200',
          score: 'text-emerald-300',
          label: 'Bullish bias'
        };
      case 'SELL':
        return {
          badge: 'bg-rose-500/10 border-rose-400/40 text-rose-200',
          score: 'text-rose-300',
          label: 'Bearish bias'
        };
      case 'HOLD':
        return {
          badge: 'bg-amber-500/10 border-amber-400/40 text-amber-200',
          score: 'text-amber-300',
          label: 'Neutral stance'
        };
      default:
        return {
          badge: 'bg-slate-800/60 border-slate-600/60 text-slate-300',
          score: 'text-accent',
          label: 'Awaiting signal'
        };
    }
  }, [signal?.side]);

  const applySignal = useCallback(
    (next: SignalResponse) => {
      setSignal(next);
      setScoreHistory((prev) => {
        const updated = [...prev, next.score];
        return updated.slice(-SCORE_HISTORY_LIMIT);
      });
      if (prevSideRef.current && prevSideRef.current !== next.side && next.side !== 'HOLD') {
        pushToast(`${next.side === 'BUY' ? 'Long' : 'Short'} bias detected (${next.symbol})`, 'info');
      }
      if ((prevScoreRef.current ?? 0) < 0.75 && next.score >= 0.75) {
        pushToast(`High conviction signal (${next.symbol} • ${next.score.toFixed(2)})`, 'success');
      }
      prevSideRef.current = next.side;
      prevScoreRef.current = next.score;
    },
    [pushToast]
  );

  const roleNotice = useMemo(() => {
    if (!role) {
      return null;
    }
    if (role === 'admin') {
      return null;
    }
    if (role === 'premium') {
      return (
        <Card className="border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h3 className="text-sm font-semibold text-emerald-200">Premium access active</h3>
          <p className="mt-2 text-xs text-emerald-100/80">
            Automated execution and advanced signal analytics are enabled. Reach out to the desk if you need extended
            backtest reports or bespoke models.
          </p>
        </Card>
      );
    }
    return (
      <Card className="border border-primary/40 bg-primary/10 p-5">
        <h3 className="text-sm font-semibold text-primary">Advanced analytics locked</h3>
        <p className="mt-2 text-xs text-slate-200">
          Upgrade to Cortexa Premium to unlock live auto-trading and full backtest reports.
        </p>
        <Link
          to="/dashboard"
          className="mt-3 inline-flex items-center text-xs font-semibold text-primary transition hover:text-primary/80"
        >
          View details →
        </Link>
      </Card>
    );
  }, [role]);

  const loadSignal = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    setAutoResult(null);
    setAutoError(null);
    setBacktest(null);
    try {
      const data = await fetchSignal(sym);
      applySignal(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch signal';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [applySignal]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadSignal(symbol.trim().toUpperCase());
  };

  const handleAutoTrade = async () => {
    if (autoTradeDisabled) {
      return;
    }
    if (!signal) {
      return;
    }
    const threshold = Number(autoThreshold);
    const qty = Number(autoQty);
    if (Number.isNaN(threshold) || threshold <= 0 || threshold >= 1) {
      setAutoError('Threshold must be a number between 0 and 1.');
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      setAutoError('Quantity must be a positive number.');
      return;
    }
    setAutoError(null);
    try {
      const response = await triggerAutoTrade(symbol.trim().toUpperCase(), threshold, qty);
      if (response.executed) {
        setAutoResult(`Auto trade placed successfully. Score ${response.score.toFixed(2)}.`);
      } else {
        setAutoResult(response.reason ?? 'Signal did not meet the criteria.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Auto trade failed';
      setAutoResult(message);
    }
  };

  const formatMetricValue = (value: number | undefined, digits = 2) =>
    typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '--';

  const metrics = useMemo(() => {
    if (!signal) {
      return [];
    }
    const pairs: Array<[string, number | undefined]> = [
      ['Score', signal.score],
      ['Price', signal.price],
      ['RSI', signal.rsi],
      ['ATR', signal.atr],
      ['EMA Fast', signal.ema_fast],
      ['EMA Slow', signal.ema_slow],
      ['ATR %', signal.atr_pct],
      ['ADX', signal.adx],
      ['Stop loss', signal.sl ?? undefined],
      ['Take profit', signal.tp ?? undefined]
    ];

    return pairs.filter(([, value]) => value !== undefined && value !== null);
  }, [signal]);

  const metricPreview = useMemo(() => metrics.slice(0, 4), [metrics]);
  const additionalMetrics = useMemo(() => metrics.slice(4), [metrics]);
  const scoreSpark = useMemo(() => (scoreHistory.length ? scoreHistory : signal ? [signal.score] : [0]), [scoreHistory, signal]);
  const heatmapData = useMemo(() => {
    if (!backtest?.regime_metrics || !backtest.regime_metrics.length) {
      return null;
    }
    const rows = new Set<string>();
    const cols = new Set<string>();
    const matrix: Record<string, Record<string, { label: string; value: number }>> = {};
    backtest.regime_metrics.forEach((item) => {
      const rowKey = item.vol_regime ?? 'unknown';
      const colKey = item.trend_regime ?? 'unknown';
      rows.add(rowKey);
      cols.add(colKey);
      matrix[rowKey] = matrix[rowKey] ?? {};
      matrix[rowKey][colKey] = {
        label: `${((item.net_return_sum ?? 0) * 100).toFixed(2)}%`,
        value: item.net_return_sum ?? 0
      };
    });
    return {
      rows: Array.from(rows),
      cols: Array.from(cols),
      data: matrix
    };
  }, [backtest]);

  const autoTradeDisabled = !isPremium;
  const showSignalSkeleton = loading && !signal;

  useEffect(() => {
    void loadSignal(symbol.trim().toUpperCase());
  }, [loadSignal, symbol]);

  useEffect(() => {
    let fallbackTimer: number | null = null;

    const startFallback = () => {
      if (fallbackTimer !== null) {
        return;
      }
      void loadSignal(symbol.trim().toUpperCase());
      fallbackTimer = window.setInterval(() => {
        void loadSignal(symbol.trim().toUpperCase());
      }, 30000);
    };

    if (!token) {
      startFallback();
      return () => {
        if (fallbackTimer !== null) {
          window.clearInterval(fallbackTimer);
        }
      };
    }

    const controller = new AbortController();

    const startStream = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/signals/${symbol.trim().toUpperCase()}/stream`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          }
        );
        if (!response.ok || !response.body) {
          throw new Error(`Stream failed (${response.status})`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (done) {
            break;
          }
          if (value) {
            buffer += decoder.decode(value, { stream: true });
          }
          let separatorIndex = buffer.indexOf('\n\n');
          while (separatorIndex !== -1) {
            const chunk = buffer.slice(0, separatorIndex).trim();
            buffer = buffer.slice(separatorIndex + 2);
            if (chunk.startsWith('data:')) {
              const payload = chunk.slice(5).trim();
              if (payload) {
                try {
                  const parsed = JSON.parse(payload) as SignalResponse;
                  applySignal(parsed);
                  setError(null);
                } catch (err) {
                  console.error('Failed to parse stream payload', err);
                }
              }
            }
            separatorIndex = buffer.indexOf('\n\n');
          }
        }
        startFallback();
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.warn('Signal stream error', err);
        startFallback();
      }
    };

    void startStream();

    return () => {
      controller.abort();
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer);
      }
    };
  }, [loadSignal, symbol, token]);

  useEffect(() => {
    if (!canRunBacktest) {
      setBacktest(null);
      setBacktestError(null);
      setSweep(null);
      setSweepError(null);
    }
  }, [canRunBacktest, setBacktest, setBacktestError, setSweep, setSweepError]);

  const handleBacktest = async () => {
    if (!canRunBacktest) {
      return;
    }
    setBacktestLoading(true);
    setBacktestError(null);
    try {
      const data = await fetchBacktest(symbol.trim().toUpperCase(), {
        threshold: backtestThreshold,
        limit: backtestLimit,
        horizon: backtestHorizon,
        commission_bps: commissionBps,
        slippage_bps: slippageBps,
        position_size: positionSize
      });
      setBacktest(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backtest failed';
      setBacktestError(message);
    } finally {
      setBacktestLoading(false);
    }
  };

  const handleSweep = async () => {
    if (!canRunBacktest) {
      return;
    }
    setSweepLoading(true);
    setSweepError(null);
    try {
      const thresholds = sweepThresholds
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((num) => !Number.isNaN(num));
      const horizons = sweepHorizons
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((num) => Number.isInteger(num));
      const data = await fetchBacktestSweep(symbol.trim().toUpperCase(), {
        thresholds,
        horizons,
        limit: backtestLimit,
        commission_bps: commissionBps,
        slippage_bps: slippageBps,
        position_size: positionSize
      });
      setSweep(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parameter sweep failed';
      setSweepError(message);
    } finally {
      setSweepLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Signals"
        description="Pull the latest AI-backed trading signals and trigger automated orders."
      >
        <form className="mt-4 flex flex-col gap-3 md:flex-row md:items-end" onSubmit={handleSubmit}>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Symbol
            <select
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            >
              <optgroup label="Top">
                {topSymbols.map((sym) => (
                  <option key={sym} value={sym}>
                    {symbolLabels[sym] ?? sym} ({sym})
                  </option>
                ))}
              </optgroup>
              <optgroup label="More">
                {extraSymbols.map((sym) => (
                  <option key={sym} value={sym}>
                    {symbolLabels[sym] ?? sym} ({sym})
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary/80 w-full md:w-auto md:px-6"
          >
            Load signal
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {topSymbols.map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => {
                setSymbol(sym);
                void loadSignal(sym);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                symbol === sym ? 'border-primary bg-primary/20 text-primary' : 'border-slate-700 text-slate-300 hover:border-primary/60 hover:text-primary'
              }`}
            >
              {symbolLabels[sym] ?? sym}
            </button>
          ))}
        </div>
        <div className="mt-3 -mb-1 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2 pb-1">
            {extraSymbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  setSymbol(sym);
                  void loadSignal(sym);
                }}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${
                  symbol === sym
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-slate-700 text-slate-300 hover:border-primary/60 hover:text-primary'
                }`}
              >
                {symbolLabels[sym] ?? sym}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {error && <Banner tone="error">{error}</Banner>}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card className="relative overflow-hidden border-slate-700/60 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950">
            <div className="pointer-events-none absolute -top-24 right-[-6rem] h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative space-y-6">
              {showSignalSkeleton ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-24 w-full" />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-20 w-full" />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{signal?.symbol ?? symbol}</p>
                      <span
                        className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${sideMeta.badge}`}
                      >
                        {symbolLabels[signal?.symbol ?? symbol] ?? signal?.symbol ?? symbol} · {signal?.side ?? 'Waiting'}
                      </span>
                    </div>
                    <div className={`text-4xl font-semibold ${sideMeta.score}`}>
                      {signal ? signal.score.toFixed(2) : '--'}
                    </div>
                  </div>
                  {signal ? (
                    <>
                      <TrendChart values={scoreSpark} height={90} />
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {metricPreview.map(([label, value]) => (
                          <MetricCard key={label} label={label} value={formatMetricValue(value, 4)} />
                        ))}
                      </div>
                      {additionalMetrics.length > 0 && (
                        <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                          {additionalMetrics.map(([label, value]) => (
                            <div key={label} className="rounded-lg border border-slate-800/70 bg-slate-900/50 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                              <p className="mt-1 text-base font-semibold text-white">{formatMetricValue(value, 4)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-slate-400">{sideMeta.label}</div>
                      {(signal.sl || signal.tp) && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Stop Loss</p>
                            <p className="mt-1 text-base font-semibold text-slate-200">
                              {signal.sl ? signal.sl.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Take Profit</p>
                            <p className="mt-1 text-base font-semibold text-slate-200">
                              {signal.tp ? signal.tp.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--'}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-5 text-sm text-slate-300">
                      <p className="font-semibold text-slate-100">Awaiting live data</p>
                      <p className="mt-1 text-slate-400">
                        We have not received a fresh score from the AI service yet. Sit tight or refresh the symbol to
                        kick off a manual pull.
                      </p>
                      <button
                        type="button"
                        onClick={() => void loadSignal(symbol.trim().toUpperCase())}
                        className="mt-3 inline-flex items-center rounded-full border border-primary/60 px-4 py-1 text-xs font-semibold text-primary transition hover:border-primary hover:text-white"
                      >
                        Refresh now
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card className="bg-slate-900/70">
            <h3 className="text-lg font-semibold text-white">Auto trade</h3>
            <p className="mt-1 text-sm text-slate-400">
              Define trigger conditions for this signal. When the AI confidence exceeds the chosen threshold we will
              execute a market order for the selected quantity.
            </p>
            {!isPremium && <Banner tone="warning">This feature is available to Cortexa Premium members.</Banner>}
            {autoError && <p className="mt-3 text-xs text-red-400">{autoError}</p>}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Threshold
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={autoThreshold}
                  onChange={(event) => setAutoThreshold(Number(event.target.value))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={autoTradeDisabled}
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Quantity
                <input
                  type="number"
                  min={0}
                  step={0.0001}
                  value={autoQty}
                  onChange={(event) => setAutoQty(Number(event.target.value))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={autoTradeDisabled}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleAutoTrade}
              className="mt-4 w-full rounded-full bg-accent/20 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/30 disabled:cursor-not-allowed disabled:bg-slate-800/50 disabled:text-slate-400"
              disabled={autoTradeDisabled}
            >
              {autoTradeDisabled ? 'Activate with Premium' : 'Trigger auto trade'}
            </button>
            {autoResult && <p className="mt-3 text-xs text-slate-400">{autoResult}</p>}
          </Card>
        </div>

        <div className="space-y-6">
          {roleNotice}
          {signal?.mtf && (
            <Card className="bg-slate-900/70 p-5">
              <h3 className="text-lg font-semibold text-white">Multi-timeframe context</h3>
              <div className="mt-4 grid gap-4">
                <div>
                  <h4 className="text-xs uppercase tracking-wide text-slate-500">Votes</h4>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {Object.entries(signal.mtf.votes).map(([frame, vote]) => {
                      const numericVote = Number(vote ?? 0);
                      return (
                      <li key={frame} className="flex items-center justify-between">
                        <span>{frame}</span>
                        <span>{numericVote.toFixed(2)}</span>
                      </li>
                    );
                    })}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wide text-slate-500">Filters</h4>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {Object.entries(signal.mtf.filters).map(([filter, passed]) => {
                      const isPassed = Boolean(passed);
                      return (
                        <li key={filter} className="flex items-center justify-between">
                          <span>{filter}</span>
                          <span className={`font-semibold ${isPassed ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {isPassed ? 'PASS' : 'BLOCK'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          <Card className="bg-slate-900/70 p-5">
            <h3 className="text-lg font-semibold text-white">Regime performance</h3>
            {heatmapData ? (
              <div className="mt-4">
                <HeatmapMatrix rows={heatmapData.rows} cols={heatmapData.cols} data={heatmapData.data} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Run a backtest to populate volatility / trend regimes.</p>
            )}
          </Card>

          {canRunBacktest && (
            <>
              <Card className="bg-slate-900/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">Historical backtest</h3>
                  {backtest && (
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                      {backtest.trades} trades · hit rate {Math.round(backtest.hit_rate * 100)}%
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Threshold
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={backtestThreshold}
                      onChange={(event) => setBacktestThreshold(Number(event.target.value))}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Limit
                    <input
                      type="number"
                      min={100}
                      max={1000}
                      step={50}
                      value={backtestLimit}
                      onChange={(event) => setBacktestLimit(Number(event.target.value))}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Horizon (bars)
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={backtestHorizon}
                      onChange={(event) => setBacktestHorizon(Number(event.target.value))}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Commission (bps)
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={commissionBps}
                      onChange={(event) => setCommissionBps(Number(event.target.value))}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Slippage (bps)
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={slippageBps}
                      onChange={(event) => setSlippageBps(Number(event.target.value))}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Position size
                    <input
                      type="number"
                      min={0.0001}
                      step={0.1}
                      value={positionSize}
                      onChange={(event) => setPositionSize(Number(event.target.value))}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleBacktest}
                  className="mt-4 w-full rounded-full border border-primary/60 px-4 py-2 text-sm text-primary transition hover:border-primary hover:text-slate-50"
                  disabled={backtestLoading}
                >
                  {backtestLoading ? 'Running…' : 'Run backtest'}
                </button>
                {backtestError && <p className="mt-3 text-xs text-red-400">{backtestError}</p>}
                {backtest && (
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-800/70 bg-slate-900/60 p-3 text-center">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Net PnL</p>
                        <p className="mt-1 text-base font-semibold text-emerald-300">
                          {formatNumber(backtest.net_value_sum)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Hit rate</p>
                        <p className="mt-1 text-base font-semibold text-slate-200">
                          {Math.round(backtest.hit_rate * 100)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Trades</p>
                        <p className="mt-1 text-base font-semibold text-slate-200">{backtest.trades}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-xl border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-400 sm:grid-cols-3">
                      <span>Gross return Σ: {formatPercent(backtest.gross_return_sum)}</span>
                      <span>Net return Σ: {formatPercent(backtest.net_return_sum)}</span>
                      <span>Cost per trade: {((backtest.cost_return ?? 0) * 10000).toFixed(2)} bps</span>
                    </div>
                    <div className="grid gap-3 rounded-xl border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-400 sm:grid-cols-3">
                      <span>Sharpe: {formatNumber(backtest.sharpe)}</span>
                      <span>Sortino: {formatNumber(backtest.sortino)}</span>
                      <span>Max drawdown: {formatPercent(backtest.max_drawdown)}</span>
                      <span>Avg win: {formatPercent(backtest.avg_win)}</span>
                      <span>Avg loss: {formatPercent(backtest.avg_loss)}</span>
                      <span>Expectancy: {formatPercent(backtest.expectancy)}</span>
                    </div>
                    <div className="grid gap-3 rounded-xl border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-400 sm:grid-cols-4">
                      <span>Profit factor: {formatNumber(backtest.profit_factor)}</span>
                      <span>Win/loss ratio: {formatNumber(backtest.win_loss_ratio)}</span>
                      <span>Median net: {formatPercent(backtest.median_return)}</span>
                      <span>Return σ: {formatPercent(backtest.return_std)}</span>
                    </div>
                    {(backtest.streaks || backtest.exposure) && (
                      <div className="grid gap-3 rounded-xl border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-300 sm:grid-cols-2">
                        {backtest.streaks && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Streaks</p>
                            <p className="mt-1">Longest winning run: <span className="font-semibold text-emerald-300">{backtest.streaks.longest_win}</span></p>
                            <p>Longest losing run: <span className="font-semibold text-rose-300">{backtest.streaks.longest_loss}</span></p>
                          </div>
                        )}
                        {backtest.exposure && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Market exposure</p>
                            <p className="mt-1">Hours in market: <span className="font-semibold text-slate-100">{formatNumber(backtest.exposure.hours, 1)}</span></p>
                            <p>Dataset coverage: <span className="font-semibold text-slate-100">{formatPercent(backtest.exposure.ratio)}</span></p>
                          </div>
                        )}
                      </div>
                    )}
                    {backtest.return_quantiles && (
                      <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-xs text-slate-300">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Return distribution</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-5">
                          {quantileKeys.map((key) => (
                            <div key={key} className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-2 text-center">
                              <p className="text-[10px] uppercase tracking-wide text-slate-500">{quantileLabels[key]}</p>
                              <p className={`mt-1 text-sm font-semibold ${
                                (backtest.return_quantiles?.[key] ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                              }`}>
                                {formatPercent(backtest.return_quantiles?.[key])}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {backtest.side_breakdown && (
                      <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-xs text-slate-300">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Side breakdown</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          {(['buy', 'sell'] as const).map((side) => {
                            const stats = backtest.side_breakdown?.[side];
                            const label = side === 'buy' ? 'Long bias' : 'Short bias';
                            if (!stats) {
                              return null;
                            }
                            return (
                              <div key={side} className="rounded-lg border border-slate-800/70 bg-slate-900/70 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-100">{stats.trades} trades</p>
                                <p className="mt-1">Net % Σ: <span className="font-semibold">{formatPercent(stats.net_return_sum)}</span></p>
                                <p>Hit rate: <span className="font-semibold">{Math.round(stats.hit_rate * 100)}%</span></p>
                                <p>Avg score: <span className="font-semibold">{formatNumber(stats.avg_score)}</span></p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {backtest.weekday_breakdown && backtest.weekday_breakdown.length > 0 && (
                      <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-xs text-slate-300">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Weekday efficiency</p>
                        <table className="mt-2 min-w-full">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="px-2 py-1">Day</th>
                              <th className="px-2 py-1">Trades</th>
                              <th className="px-2 py-1">Net % Σ</th>
                              <th className="px-2 py-1">Hit rate</th>
                              <th className="px-2 py-1">Avg %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(backtest.weekday_breakdown ?? []).map((row) => (
                              <tr key={row.day} className="border-t border-slate-800/70">
                                <td className="px-2 py-1">{row.day}</td>
                                <td className="px-2 py-1">{row.trades}</td>
                                <td className={`px-2 py-1 ${row.net_return_sum >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                  {formatPercent(row.net_return_sum)}
                                </td>
                                <td className="px-2 py-1">{Math.round(row.hit_rate * 100)}%</td>
                                <td className={`px-2 py-1 ${row.avg_return >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                  {formatPercent(row.avg_return)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {backtest.history.length > 0 && (
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800/70">
                        <table className="min-w-full text-xs">
                          <thead className="bg-slate-900/70 text-left uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Time</th>
                              <th className="px-3 py-2">Side</th>
                              <th className="px-3 py-2">Score</th>
                              <th className="px-3 py-2">Gross %</th>
                              <th className="px-3 py-2">Net %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backtest.history.map((row) => {
                              const grossReturn = row.gross_return ?? 0;
                              const netReturn = row.net_return ?? 0;
                              return (
                                <tr key={row.time} className="border-t border-slate-800/70">
                                  <td className="px-3 py-2 text-slate-400">{new Date(row.time).toLocaleString()}</td>
                                  <td className="px-3 py-2 text-slate-200">{row.side}</td>
                                  <td className="px-3 py-2 text-slate-200">{row.score.toFixed(2)}</td>
                                  <td className={`px-3 py-2 ${grossReturn >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {(grossReturn * 100).toFixed(2)}%
                                  </td>
                                  <td className={`px-3 py-2 ${netReturn >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {(netReturn * 100).toFixed(2)}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {backtest.equity_curve && backtest.equity_curve.length > 0 && (
                      <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-xs text-slate-300">
                        Net equity span: {backtest.equity_curve[0]?.time && new Date(backtest.equity_curve[0].time).toLocaleString()} →{' '}
                        {new Date(backtest.equity_curve[backtest.equity_curve.length - 1].time).toLocaleString()} | Final net cumulative:{' '}
                        {formatNumber(backtest.equity_curve[backtest.equity_curve.length - 1].net_value)}
                      </div>
                    )}
                    {backtest.score_buckets && backtest.score_buckets.length > 0 && (
                      <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-xs text-slate-300">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Score calibration</p>
                        <table className="mt-2 min-w-full">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="px-2 py-1">Score band</th>
                              <th className="px-2 py-1">Trades</th>
                              <th className="px-2 py-1">Avg net %</th>
                              <th className="px-2 py-1">Hit rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(backtest.score_buckets ?? [])
                              .slice()
                              .sort((a, b) => a.bucket.localeCompare(b.bucket))
                              .map((bucket) => (
                                <tr key={bucket.bucket} className="border-t border-slate-800/70">
                                  <td className="px-2 py-1">{bucket.bucket}</td>
                                  <td className="px-2 py-1">{bucket.trades}</td>
                                  <td className="px-2 py-1">{formatPercent(bucket.net_return_avg)}</td>
                                  <td className="px-2 py-1">{Math.round(bucket.hit_rate * 100)}%</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              <Card className="bg-slate-900/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">Parameter sweep</h3>
                  {sweep && (
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                      {sweep.results.length} combos · best net{' '}
                      {(() => {
                        const best = [...sweep.results].sort((a, b) => (b.net_value_sum ?? 0) - (a.net_value_sum ?? 0))[0];
                        return best ? best.net_value_sum?.toFixed(2) ?? '0.00' : '0.00';
                      })()}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Thresholds (comma)
                    <input
                      value={sweepThresholds}
                      onChange={(event) => setSweepThresholds(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Horizons (comma)
                    <input
                      value={sweepHorizons}
                      onChange={(event) => setSweepHorizons(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleSweep}
                      disabled={sweepLoading}
                      className="w-full rounded-full border border-accent/60 px-4 py-2 text-sm text-accent transition hover:border-accent hover:text-slate-50"
                    >
                      {sweepLoading ? 'Sweeping…' : 'Run sweep'}
                    </button>
                  </div>
                </div>
                {sweepError && <p className="mt-3 text-xs text-red-400">{sweepError}</p>}
                {sweep && sweep.results.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-900/70 text-left uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Threshold</th>
                          <th className="px-3 py-2">Horizon</th>
                          <th className="px-3 py-2">Trades</th>
                          <th className="px-3 py-2">Net PnL</th>
                          <th className="px-3 py-2">Net %</th>
                          <th className="px-3 py-2">Hit rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...sweep.results]
                          .sort((a, b) => (b.net_value_sum ?? 0) - (a.net_value_sum ?? 0))
                          .map((row) => (
                            <tr key={`${row.threshold}-${row.horizon}`} className="border-t border-slate-800/70">
                              <td className="px-3 py-2 text-slate-200">{row.threshold.toFixed(2)}</td>
                              <td className="px-3 py-2 text-slate-200">{row.horizon}</td>
                              <td className="px-3 py-2 text-slate-300">{row.trades}</td>
                              <td className="px-3 py-2 text-slate-200">{(row.net_value_sum ?? 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-slate-200">{((row.net_return_sum ?? 0) * 100).toFixed(2)}%</td>
                              <td className="px-3 py-2 text-slate-200">{Math.round(row.hit_rate * 100)}%</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {sweep && sweep.results[0]?.regime_metrics && sweep.results[0].regime_metrics!.length > 0 && (
                  <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-300">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Regime snapshot (best combo)</p>
                    <table className="mt-2 min-w-full">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="px-2 py-1">Vol regime</th>
                          <th className="px-2 py-1">Trend</th>
                          <th className="px-2 py-1">Trades</th>
                          <th className="px-2 py-1">Net %</th>
                          <th className="px-2 py-1">Hit rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sweep.results[0].regime_metrics!
                          .slice()
                          .sort((a, b) => (b.net_return_sum ?? 0) - (a.net_return_sum ?? 0))
                          .map((row) => (
                            <tr key={`${row.vol_regime}-${row.trend_regime}`} className="border-t border-slate-800/70">
                              <td className="px-2 py-1">{row.vol_regime}</td>
                              <td className="px-2 py-1">{row.trend_regime}</td>
                              <td className="px-2 py-1">{row.trades}</td>
                              <td className="px-2 py-1">{((row.net_return_sum ?? 0) * 100).toFixed(2)}%</td>
                              <td className="px-2 py-1">{Math.round((row.hit_rate ?? 0) * 100)}%</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignalsPage;
