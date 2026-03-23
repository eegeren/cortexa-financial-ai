import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSignal, fetchBacktest, fetchInsight, type SignalResponse, type BacktestResponse } from '@/services/api';
import { useToast } from '@/components/ToastProvider';

const PRIMARY_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'XRPUSDT', 'DOGEUSDT'] as const;
const SECONDARY_SYMBOLS = ['BNBUSDT', 'ADAUSDT', 'LINKUSDT', 'MATICUSDT', 'DOTUSDT', 'NEARUSDT'] as const;

const SYMBOL_LABELS: Record<string, string> = {
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
  NEARUSDT: 'NEAR'
};

const DEFAULT_SYMBOL = PRIMARY_SYMBOLS[0];

const QUALITY_FLAG_LABELS: Record<string, string> = {
  low_volume: 'Low volume',
  weak_volume_confirmation: 'Weak volume confirmation',
  high_volatility: 'High volatility',
  stale_data: 'Stale data',
  mtf_aligned: 'Multi-timeframe aligned',
  mtf_conflict: 'Multi-timeframe conflict',
  weak_trend_strength: 'Weak trend strength',
  choppy_structure: 'Choppy structure',
};

const toneClassByTrend: Record<string, string> = {
  'Strong Bullish': 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  Bullish: 'border-emerald-400/20 bg-emerald-500/8 text-emerald-100',
  Neutral: 'border-slate-500/30 bg-slate-500/10 text-slate-100',
  Bearish: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
  'Strong Bearish': 'border-rose-400/30 bg-rose-500/10 text-rose-100',
};

const toneClassByRisk: Record<string, string> = {
  Low: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
  Medium: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
  High: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
};

const formatNumber = (value?: number, digits = 2) =>
  value !== undefined ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';

const SignalsPage = () => {
  const [activeSymbol, setActiveSymbol] = useState(DEFAULT_SYMBOL);
  const [searchValue, setSearchValue] = useState(DEFAULT_SYMBOL);
  const [signal, setSignal] = useState<SignalResponse | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalError, setSignalError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState(false);
  const [validationThreshold, setValidationThreshold] = useState('0.60');
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const { pushToast } = useToast();
  const resultsRef = useRef<HTMLElement | null>(null);

  const loadSignal = useCallback(async (raw: string, options?: { scrollToResults?: boolean }) => {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) {
      return;
    }
    if (options?.scrollToResults) {
      setShouldAutoScroll(true);
    }
    setSignalLoading(true);
    setSignalError(null);
    setInsight('');
    setInsightLoading(false);
    setInsightError(false);
    try {
      const data = await fetchSignal(symbol);
      setSignal(data);
      setHasData(true);
      setActiveSymbol(symbol);
      setSearchValue(symbol);
      setInsightLoading(true);
      try {
        const insightResponse = await fetchInsight({
          trend: data.trend,
          confidence: data.confidence,
          risk: data.risk,
          market_regime: data.market_regime,
          levels: data.levels,
          quality_flags: data.quality_flags,
          scenario: data.scenario,
        });
        setInsight(insightResponse.insight?.trim() || data.insight || data.scenario || '');
      } catch {
        setInsight(data.insight || data.scenario || '');
        setInsightError(true);
      } finally {
        setInsightLoading(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load signal';
      setSignal(null);
      setHasData(false);
      setSignalError(message);
      setInsight('');
      setInsightError(false);
      setShouldAutoScroll(false);
    } finally {
      setSignalLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSignal(DEFAULT_SYMBOL, { scrollToResults: false });
  }, [loadSignal]);

  useEffect(() => {
    if (!shouldAutoScroll || signalLoading || !signal || !resultsRef.current) {
      return;
    }
    resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShouldAutoScroll(false);
  }, [shouldAutoScroll, signalLoading, signal]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadSignal(searchValue, { scrollToResults: true });
  };

  const runBacktest = async () => {
    setBacktestLoading(true);
    setBacktestError(null);
    try {
      const report = await fetchBacktest(activeSymbol, {
        threshold: Number.parseFloat(validationThreshold) || 0.6,
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

  const technicalMetrics = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      { label: 'RSI', value: signal.indicators?.rsi?.toFixed(1) ?? signal.rsi?.toFixed(1) ?? '—' },
      { label: 'ATR', value: signal.indicators?.atr?.toFixed(2) ?? signal.atr?.toFixed(2) ?? '—' },
      { label: 'ADX', value: signal.indicators?.adx?.toFixed(1) ?? signal.adx?.toFixed(1) ?? '—' },
      { label: 'Volume ratio', value: signal.indicators?.volume_ratio?.toFixed(2) ?? '—' },
      { label: 'EMA 20', value: signal.indicators?.ema20?.toFixed(2) ?? '—' },
      { label: 'EMA 50', value: signal.indicators?.ema50?.toFixed(2) ?? '—' },
      { label: 'EMA 200', value: signal.indicators?.ema200?.toFixed(2) ?? '—' },
      {
        label: 'MACD',
        value:
          signal.indicators?.macd?.macd !== undefined && signal.indicators?.macd?.signal !== undefined
            ? `${signal.indicators.macd.macd.toFixed(2)} / ${signal.indicators.macd.signal.toFixed(2)}`
            : '—'
      }
    ];
  }, [signal]);

  const conditionFlags = useMemo(() => {
    if (!signal?.quality_flags?.length) {
      return [];
    }
    return signal.quality_flags.map((flag) => ({
      key: flag,
      label: QUALITY_FLAG_LABELS[flag] ?? flag.replace(/_/g, ' '),
    }));
  }, [signal]);

  const structureMetrics = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      { label: 'Support', value: signal.levels?.support?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—' },
      { label: 'Resistance', value: signal.levels?.resistance?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—' },
      { label: 'Momentum', value: signal.momentum ?? '—' },
      { label: 'Timeframe', value: signal.timeframe?.toUpperCase() ?? '—' }
    ];
  }, [signal]);

  const summaryCards = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      {
        label: 'Trend',
        helper: 'Direction of the current market structure',
        value: signal.trend ?? '—',
        className: toneClassByTrend[signal.trend ?? ''] ?? 'border-outline/30 bg-muted/60 text-white',
      },
      {
        label: 'Confidence',
        helper: 'How strong the current structure looks',
        value: signal.confidence !== undefined ? `${signal.confidence}/100` : '—',
        className: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-50',
      },
      {
        label: 'Risk',
        helper: 'Volatility, liquidity, and structural risk',
        value: signal.risk ?? '—',
        className: toneClassByRisk[signal.risk ?? ''] ?? 'border-outline/30 bg-muted/60 text-white',
      },
      {
        label: 'Market regime',
        helper: 'Current market condition',
        value: signal.market_regime ?? '—',
        className: 'border-outline/30 bg-muted/60 text-white',
      }
    ];
  }, [signal]);

  const marketSnapshot = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      { label: 'RSI', value: signal.indicators?.rsi?.toFixed(1) ?? signal.rsi?.toFixed(1) ?? '—' },
      { label: 'ATR', value: signal.indicators?.atr?.toFixed(2) ?? signal.atr?.toFixed(2) ?? '—' },
      { label: 'Support', value: formatNumber(signal.levels?.support, 2) },
      { label: 'Resistance', value: formatNumber(signal.levels?.resistance, 2) },
    ];
  }, [signal]);

  const backtestSummary = useMemo(() => {
    if (!backtest) {
      return [];
    }
    return [
      { label: 'Trades', value: backtest.trades?.toString() ?? '—' },
      { label: 'Hit rate', value: backtest.hit_rate ? `${(backtest.hit_rate * 100).toFixed(1)}%` : '—' },
      { label: 'Net return', value: backtest.net_return_sum ? `${(backtest.net_return_sum * 100).toFixed(2)}%` : '—' },
      { label: 'Max drawdown', value: backtest.max_drawdown ? `${(backtest.max_drawdown * 100).toFixed(1)}%` : '—' }
    ];
  }, [backtest]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 lg:gap-5">
      <section
        className={`hero shrink-0 rounded-[2rem] border border-outline/20 bg-gradient-to-b from-surface via-surface to-transparent px-4 text-center transition-all duration-300 ease-out sm:px-6 ${
          hasData ? 'hero-compact min-h-[20vh] py-5' : 'min-h-[48vh] py-10 lg:min-h-[42vh]'
        }`}
      >
        <header className="space-y-4">
          <span className="text-xs uppercase tracking-[0.4em] text-slate-500">Live signal studio</span>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            Scan structure, validate edge, and read the market with context.
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400">
            Pick a market, inspect deterministic scoring, and use the AI layer for explanation only. The output is built for decision support, not trade commands.
          </p>
        </header>
        <form onSubmit={handleSearch} className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value.toUpperCase())}
            placeholder="Search symbol (e.g. BTCUSDT)"
            className="w-full max-w-xs rounded-full border border-outline/50 bg-surface px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 font-medium text-black shadow-inner-glow transition hover:bg-slate-200"
          >
            Load signal
          </button>
        </form>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          {PRIMARY_SYMBOLS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => void loadSignal(symbol, { scrollToResults: true })}
              className={`rounded-full border px-3 py-1.5 transition ${
                activeSymbol === symbol
                  ? 'border-primary bg-primary/20 text-white'
                  : 'border-outline/50 bg-surface text-slate-300 hover:border-outline'
              }`}
            >
              {SYMBOL_LABELS[symbol] ?? symbol}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
          {SECONDARY_SYMBOLS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => void loadSignal(symbol, { scrollToResults: true })}
              className="rounded-full border border-outline/40 bg-muted/60 px-3 py-1 transition hover:border-outline hover:text-white"
            >
              {SYMBOL_LABELS[symbol] ?? symbol}
            </button>
          ))}
        </div>
      </section>

      <section
        ref={resultsRef}
        className="grid flex-1 min-h-0 scroll-mt-6 gap-5 overflow-y-auto xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,380px)]"
      >
        <article className="flex min-h-0 flex-col rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {SYMBOL_LABELS[activeSymbol] ?? activeSymbol} • market intelligence snapshot
              </h2>
              <p className="text-sm text-slate-400">Latest deterministic view from the analysis engine with explainable technical context.</p>
            </div>
            {signalError && (
              <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                {signalError}
              </span>
            )}
          </header>

          <div className="mt-6 min-h-0 flex-1 space-y-6">
            {signalLoading ? (
              <div className="h-40 rounded-2xl border border-outline/30 bg-muted/60 animate-pulse" />
            ) : signal ? (
              <>
                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,360px)]">
                  <div className={`rounded-3xl border p-5 ${toneClassByTrend[signal.trend ?? ''] ?? 'border-outline/30 bg-muted/60 text-white'}`}>
                    <p className="text-[11px] uppercase tracking-[0.28em] opacity-70">Signal summary</p>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h3 className="text-3xl font-semibold text-white">{signal.trend ?? '—'}</h3>
                        <p className="mt-2 max-w-xl text-sm text-slate-200/90">
                          {signal.market_regime ?? 'Market regime unavailable'} with {signal.momentum?.toLowerCase() ?? 'limited'} momentum across the current structure.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-right">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Current price</p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {signal.price !== undefined ? formatNumber(signal.price, 2) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    {summaryCards.slice(1).map((card) => (
                      <div key={card.label} className={`rounded-2xl border p-4 ${card.className}`}>
                        <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">{card.label}</p>
                        <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                        <p className="mt-2 text-xs text-slate-300">{card.helper}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-4">
                  {summaryCards.slice(0, 1).map((card) => (
                    <div key={card.label} className={`rounded-2xl border p-4 ${card.className}`}>
                      <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">{card.label}</p>
                      <p className="mt-3 text-xl font-semibold text-white">{card.value}</p>
                      <p className="mt-2 text-xs text-slate-300">{card.helper}</p>
                    </div>
                  ))}
                  {marketSnapshot.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-outline/30 bg-muted/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{metric.label}</p>
                      <p className="mt-3 text-lg font-semibold text-white">{metric.value}</p>
                    </div>
                  ))}
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,360px)]">
                  <div className="space-y-4">
                    {signal?.scenario && (
                      <div className="rounded-2xl border border-outline/30 bg-muted/60 p-5">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Scenario</p>
                        <p className="mt-3 text-sm leading-7 text-slate-100">{signal.scenario}</p>
                      </div>
                    )}

                    {(signal || insightLoading) && (
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">AI Insight</p>
                          {insightError && (
                            <span className="text-[11px] text-slate-400">Fallback applied</span>
                          )}
                        </div>
                        {insightLoading ? (
                          <div className="mt-3 h-16 animate-pulse rounded-2xl border border-cyan-400/10 bg-cyan-500/5" />
                        ) : insight ? (
                          <p className="mt-3 text-sm leading-7 text-slate-100">{insight}</p>
                        ) : (
                          <p className="mt-3 text-sm leading-7 text-slate-300">
                            Additional AI interpretation is unavailable right now.
                          </p>
                        )}
                      </div>
                    )}

                    {signal?.explanation && (
                      <div className="rounded-2xl border border-outline/30 bg-muted/60 p-5">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Explanation</p>
                        <p className="mt-3 text-sm leading-7 text-slate-200">{signal.explanation}</p>
                        {signal.disclaimer && <p className="mt-4 text-xs text-slate-500">{signal.disclaimer}</p>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-outline/30 bg-muted/60 p-5">
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Key levels</p>
                      <dl className="mt-4 space-y-3 text-sm text-slate-300">
                        {structureMetrics.map((metric) => (
                          <div key={metric.label} className="flex items-center justify-between gap-4">
                            <dt>{metric.label}</dt>
                            <dd className="text-white">{metric.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="rounded-2xl border border-outline/30 bg-muted/60 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Market warnings / conditions</p>
                          <p className="mt-2 text-xs text-slate-400">
                            Specific confirmations or warnings around liquidity, volatility, and structure.
                          </p>
                        </div>
                      </div>
                      {conditionFlags.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {conditionFlags.map((flag) => (
                            <span
                              key={flag.key}
                              className="rounded-full border border-outline/30 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-100"
                            >
                              {flag.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-slate-400">No additional market warnings at the moment.</p>
                      )}
                    </div>
                  </div>
                </section>
              </>
            ) : (
                <p className="rounded-2xl border border-outline/30 bg-muted/60 p-4 text-sm text-slate-300">
                  No signal available right now. Try another symbol.
                </p>
            )}
          </div>
        </article>

        <aside className="grid min-h-0 gap-5 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Technical context</h3>
            <p className="mt-1 text-sm text-slate-400">
              Compact view of the deterministic indicators behind the current structure.
            </p>
            <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-1">
              {technicalMetrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between gap-4 rounded-2xl border border-outline/20 bg-muted/50 px-4 py-3">
                  <dt>{metric.label}</dt>
                  <dd className="text-white">{metric.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Validation threshold</h3>
            <p className="mt-1 text-sm text-slate-400">
              Set the confidence threshold used when validating the deterministic engine on historical candles.
            </p>
            <div className="mt-4 space-y-4 text-sm">
              <label className="block text-xs uppercase tracking-[0.28em] text-slate-500">
                Threshold
                <input
                  value={validationThreshold}
                  onChange={(event) => setValidationThreshold(event.target.value)}
                  className="mt-1 w-full rounded-full border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <p className="text-xs text-slate-500">
                The engine remains deterministic. This threshold only controls which bullish or bearish observations are included in the validation pass.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Quick backtest</h3>
              <button
                type="button"
                onClick={runBacktest}
                className="rounded-full border border-outline/40 px-3 py-1 text-xs text-slate-300 transition hover:border-outline hover:text-white"
              >
                Run
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Historical validation across recent candles with a 4-bar forward-return horizon.
            </p>
            {backtestLoading ? (
              <div className="mt-4 h-28 rounded-2xl border border-outline/30 bg-muted/60 animate-pulse" />
            ) : backtestError ? (
              <p className="mt-4 text-xs text-rose-200">{backtestError}</p>
            ) : backtest ? (
              <dl className="mt-4 space-y-3 text-sm text-slate-300">
                {backtestSummary.map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between">
                    <dt>{metric.label}</dt>
                    <dd className="text-white">{metric.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-xs text-slate-400">Run the backtest to populate historical performance.</p>
            )}
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft text-xs text-slate-300">
            <h3 className="text-lg font-semibold text-white">Need more context?</h3>
            <ul className="mt-3 space-y-2 list-disc pl-4">
              <li>
                <Link to="/assistant" className="text-slate-200 transition hover:text-white">
                  Ask the assistant for a market explanation →
                </Link>
              </li>
              <li>
                <Link to="/forum" className="text-slate-200 transition hover:text-white">
                  Read community strategy threads →
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-slate-200 transition hover:text-white">
                  Jump back to your overview →
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default SignalsPage;
