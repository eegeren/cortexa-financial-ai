import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSignal, fetchBacktest, fetchInsight, fetchMarketSymbols, type SignalResponse, type BacktestResponse } from '@/services/api';
import { useToast } from '@/components/ToastProvider';

const FALLBACK_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'XRPUSDT', 'DOGEUSDT', 'BNBUSDT', 'ADAUSDT'] as const;

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

const formatSymbolDisplay = (symbol: string) => symbol.replace(/USDT$/, ' / USDT');

const LoadingState = () => (
  <div className="flex min-h-[21rem] flex-col items-center justify-center rounded-[2rem] border border-outline/25 bg-muted/40 px-6 py-10 text-center">
    <div className="relative flex h-20 w-20 items-center justify-center">
      <div className="absolute inset-0 rounded-full border border-cyan-400/15 bg-cyan-500/5" />
      <div className="signal-spinner h-12 w-12 rounded-full border border-cyan-400/20 border-t-cyan-300/80" />
    </div>
    <div className="mt-6 flex items-center gap-2 text-lg font-medium text-white">
      <span className="signal-loading-text">Loading</span>
      <span className="signal-loading-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </div>
    <p className="mt-3 max-w-md text-sm text-slate-400">
      Pulling the latest market structure, confidence, risk, and AI context for the selected symbol.
    </p>
    <div className="mt-8 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-24 rounded-2xl border border-outline/20 bg-slate-900/40 animate-pulse" />
      ))}
    </div>
  </div>
);

const SignalsPage = () => {
  const [activeSymbol, setActiveSymbol] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([...FALLBACK_SYMBOLS]);
  const [symbolMenuOpen, setSymbolMenuOpen] = useState(false);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [symbolFetchFailed, setSymbolFetchFailed] = useState(false);
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
  const symbolPickerRef = useRef<HTMLDivElement | null>(null);

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
    let cancelled = false;

    const loadSymbols = async () => {
      setSymbolsLoading(true);
      try {
        const symbols = await fetchMarketSymbols();
        if (cancelled) {
          return;
        }
        if (symbols.length) {
          setAvailableSymbols(symbols);
          setSymbolFetchFailed(false);
        } else {
          setAvailableSymbols([...FALLBACK_SYMBOLS]);
          setSymbolFetchFailed(true);
        }
      } catch {
        if (cancelled) {
          return;
        }
        setAvailableSymbols([...FALLBACK_SYMBOLS]);
        setSymbolFetchFailed(true);
      } finally {
        if (!cancelled) {
          setSymbolsLoading(false);
        }
      }
    };

    void loadSymbols();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shouldAutoScroll || signalLoading || !signal || !resultsRef.current) {
      return;
    }
    resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShouldAutoScroll(false);
  }, [shouldAutoScroll, signalLoading, signal]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (symbolPickerRef.current && !symbolPickerRef.current.contains(event.target as Node)) {
        setSymbolMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const filteredSymbols = useMemo(() => {
    const query = searchValue.trim().toUpperCase();
    const matches = query
      ? availableSymbols.filter((symbol) => symbol.includes(query))
      : availableSymbols;

    return matches
      .slice()
      .sort((left, right) => {
        const leftStarts = left.startsWith(query);
        const rightStarts = right.startsWith(query);
        if (leftStarts !== rightStarts) {
          return leftStarts ? -1 : 1;
        }
        return left.localeCompare(right);
      })
      .slice(0, 60);
  }, [availableSymbols, searchValue]);

  const hasSelectedSymbol = searchValue.trim().length > 0;

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (signalLoading) {
      return;
    }
    const normalizedSymbol = searchValue.trim().toUpperCase();
    if (!normalizedSymbol) {
      pushToast('Choose a symbol to load a signal.', 'warning');
      setSymbolMenuOpen(true);
      return;
    }

    const matchedSymbol = availableSymbols.find((symbol) => symbol === normalizedSymbol);
    if (!matchedSymbol) {
      pushToast('Select a supported symbol from the search list.', 'warning');
      setSymbolMenuOpen(true);
      return;
    }

    void loadSignal(matchedSymbol, { scrollToResults: true });
  };

  const handleSymbolSelect = (symbol: string) => {
    setSearchValue(symbol);
    setSymbolMenuOpen(false);
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
    <div className="flex flex-col gap-5 lg:gap-6">
      <section
        className={`hero rounded-[2rem] border border-outline/20 bg-gradient-to-b from-surface via-surface to-transparent px-4 text-center transition-all duration-300 ease-out sm:px-6 ${
          hasData ? 'hero-compact py-4 sm:py-5' : 'py-10 lg:py-12'
        }`}
      >
        <header className={`${hasData ? 'space-y-2.5' : 'space-y-4'}`}>
          <span className="text-xs uppercase tracking-[0.4em] text-slate-500">Live signal studio</span>
          <h1 className={`font-semibold text-white transition-all duration-300 ${hasData ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl'}`}>
            Scan structure, validate edge, and read the market with context.
          </h1>
          <p className={`mx-auto max-w-2xl text-slate-400 transition-all duration-300 ${hasData ? 'text-xs sm:text-sm' : 'text-sm'}`}>
            Pick a market, inspect deterministic scoring, and use the AI layer for explanation only. The output is built for decision support, not trade commands.
          </p>
        </header>
        <form onSubmit={handleSearch} className={`flex flex-wrap justify-center gap-3 text-sm transition-all duration-300 ${hasData ? 'mt-4' : 'mt-8'}`}>
          <div ref={symbolPickerRef} className={`relative w-full ${hasData ? 'max-w-md' : 'max-w-sm'}`}>
            <div className="flex items-center rounded-[1.6rem] border border-outline/50 bg-surface/95 shadow-elevation-soft transition focus-within:border-outline focus-within:ring-2 focus-within:ring-primary">
              <input
                value={searchValue}
                onChange={(event) => {
                  setSearchValue(event.target.value.toUpperCase());
                  setSymbolMenuOpen(true);
                }}
                onFocus={() => setSymbolMenuOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSymbolMenuOpen(false);
                  }
                }}
                placeholder="Select a market..."
                role="combobox"
                aria-expanded={symbolMenuOpen}
                aria-controls="signals-symbol-listbox"
                aria-autocomplete="list"
                className={`w-full rounded-[1.6rem] bg-transparent pl-4 pr-12 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none transition-all duration-300 ${hasData ? 'py-2' : 'py-2.5'}`}
              />
              <button
                type="button"
                onClick={() => setSymbolMenuOpen((open) => !open)}
                className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800/70 hover:text-white"
                aria-label="Toggle symbol options"
              >
                <svg aria-hidden viewBox="0 0 12 8" className={`h-3.5 w-3.5 transition-transform ${symbolMenuOpen ? 'rotate-180' : ''}`} fill="none">
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {symbolMenuOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.65rem)] z-20 overflow-hidden rounded-[1.4rem] border border-outline/40 bg-slate-950/95 text-left shadow-elevation-soft backdrop-blur">
                <div className="border-b border-outline/20 px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  {symbolsLoading
                    ? 'Loading symbol universe'
                    : symbolFetchFailed
                      ? 'Fallback symbol list'
                      : `${availableSymbols.length} supported symbols`}
                </div>
                <div id="signals-symbol-listbox" role="listbox" className="max-h-80 overflow-y-auto p-2">
                  {filteredSymbols.length ? (
                    filteredSymbols.map((symbol) => (
                      <button
                        key={symbol}
                        type="button"
                        role="option"
                        aria-selected={searchValue === symbol}
                        onClick={() => handleSymbolSelect(symbol)}
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                          searchValue === symbol
                            ? 'bg-primary/15 text-white'
                            : 'text-slate-300 hover:bg-slate-900/70 hover:text-white'
                        }`}
                      >
                        <span className="font-medium">{symbol}</span>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{formatSymbolDisplay(symbol)}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-slate-400">
                      No supported symbols match "{searchValue.trim().toUpperCase()}".
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!hasSelectedSymbol || signalLoading}
            className={`inline-flex items-center gap-2 rounded-full px-5 font-medium shadow-inner-glow transition-all duration-300 ${hasData ? 'py-2' : 'py-2.5'} ${
              hasSelectedSymbol && !signalLoading
                ? 'bg-white text-black hover:bg-slate-200'
                : 'cursor-not-allowed bg-slate-700/70 text-slate-300 opacity-60'
            }`}
          >
            {signalLoading ? 'Loading...' : 'Load signal'}
          </button>
        </form>
        <p className={`text-xs transition-all duration-300 ${hasData ? 'mt-3 text-slate-500' : 'mt-4 text-slate-400'}`}>
          {symbolsLoading
            ? 'Syncing supported markets from the signal engine...'
            : symbolFetchFailed
              ? 'Using a fallback list of major pairs while symbol discovery is unavailable.'
              : `Search across ${availableSymbols.length} backend-supported trading pairs.`}
        </p>
        <p className="mt-2 text-xs text-slate-500">Choose a symbol to load a signal.</p>
      </section>

      <section
        ref={resultsRef}
        className="grid scroll-mt-24 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,380px)]"
      >
        <article className="flex flex-col rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {(activeSymbol ? formatSymbolDisplay(activeSymbol) : 'Select a market')} • market intelligence snapshot
              </h2>
              <p className="text-sm text-slate-400">Latest deterministic view from the analysis engine with explainable technical context.</p>
            </div>
            {signalError && (
              <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                {signalError}
              </span>
            )}
          </header>

          <div className={`mt-6 transition-opacity duration-300 ${signalLoading ? 'opacity-100' : 'opacity-100'}`}>
            {signalLoading ? (
              <LoadingState />
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

        <aside className="grid gap-5 content-start">
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
