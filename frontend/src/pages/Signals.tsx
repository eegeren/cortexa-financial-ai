import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSignal, triggerAutoTrade, fetchBacktest, SignalResponse, BacktestResponse } from '@/services/api';
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

const SignalsPage = () => {
  const [activeSymbol, setActiveSymbol] = useState(DEFAULT_SYMBOL);
  const [searchValue, setSearchValue] = useState(DEFAULT_SYMBOL);
  const [signal, setSignal] = useState<SignalResponse | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalError, setSignalError] = useState<string | null>(null);
  const [autoThreshold, setAutoThreshold] = useState('0.65');
  const [autoQty, setAutoQty] = useState('0.001');
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const { pushToast } = useToast();

  const loadSignal = useCallback( async (raw: string) => {
    const symbol = raw.trim().toUpperCase();
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
      const message = error instanceof Error ? error.message : 'Sinyal alınamadı';
      setSignal(null);
      setSignalError(message);
    } finally {
      setSignalLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSignal(DEFAULT_SYMBOL);
  }, [loadSignal]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadSignal(searchValue);
  };

  const handleAutoTrade = async () => {
    const threshold = Number.parseFloat(autoThreshold);
    const qty = Number.parseFloat(autoQty);
    if (!Number.isFinite(threshold) || !Number.isFinite(qty)) {
      pushToast('Geçerli bir eşik ve miktar gir', 'warning');
      return;
    }
    setAutoBusy(true);
    setAutoStatus(null);
    try {
      const result = await triggerAutoTrade(activeSymbol, threshold, qty);
      const message = result.executed
        ? `Otomasyon ${result.score.toFixed(2)} skorunda devrede`
        : result.reason ?? 'Otomasyon kuyrukta';
      setAutoStatus(message);
      pushToast(message, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Otomasyon yapılamadı';
      setAutoStatus(message);
      pushToast(message, 'error');
    } finally {
      setAutoBusy(false);
    }
  };

  const runBacktest = async () => {
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
      const message = error instanceof Error ? error.message : 'Backtest başarısız';
      setBacktest(null);
      setBacktestError(message);
      pushToast(message, 'warning');
    } finally {
      setBacktestLoading(false);
    }
  };

  const summaryMetrics = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      { label: 'Skor', value: signal.score.toFixed(2) },
      { label: 'Güven', value: signal.confidence ? `${Math.round(signal.confidence * 100)}%` : '—' },
      { label: 'Yön', value: signal.side ?? '—' },
      { label: 'Ufuk', value: signal.horizon ?? '—' }
    ];
  }, [signal]);

  const techMetrics = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      { label: 'Fiyat', value: signal.price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—' },
      { label: 'RSI', value: signal.rsi?.toFixed(1) ?? '—' },
      { label: 'ATR', value: signal.atr?.toFixed(2) ?? '—' },
      {
        label: 'EMA hızlı/yavaş',
        value:
          signal.ema_fast !== undefined && signal.ema_slow !== undefined
            ? `${signal.ema_fast.toFixed(2)} / ${signal.ema_slow.toFixed(2)}`
            : '—'
      }
    ];
  }, [signal]);

  const riskMetrics = useMemo(() => {
    if (!signal) {
      return [];
    }
    return [
      { label: 'Önerilen allotman', value: signal.suggested_allocation ?? '—' },
      { label: 'Giriş', value: signal.entry_price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—' },
      { label: 'Kar al', value: signal.take_profit?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—' },
      { label: 'Zarar durdur', value: signal.stop_loss?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—' }
    ];
  }, [signal]);

  const backtestSummary = useMemo(() => {
    if (!backtest) {
      return [];
    }
    return [
      { label: 'İşlem sayısı', value: backtest.trades?.toString() ?? '—' },
      { label: 'Hit rate', value: backtest.hit_rate ? `${(backtest.hit_rate * 100).toFixed(1)}%` : '—' },
      { label: 'Net getiri', value: backtest.net_return_sum ? `${(backtest.net_return_sum * 100).toFixed(2)}%` : '—' },
      { label: 'Max DD', value: backtest.max_drawdown ? `${(backtest.max_drawdown * 100).toFixed(1)}%` : '—' }
    ];
  }, [backtest]);

  return (
    <div className="space-y-16">
      <section className="text-center">
        <header className="space-y-4">
          <span className="text-xs uppercase tracking-[0.4em] text-slate-500">Canlı sinyal stüdyosu</span>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            Sinyalleri tarayın, doğrulayın, otomasyona taşıyın.
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400">
            Sembol seç, sinyal motoru içgörülerini incele ve otomasyon eşiğini ayarla. Tüm adımlar assistant ile senkron.
          </p>
        </header>
        <form onSubmit={handleSearch} className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value.toUpperCase())}
            placeholder="Sembol ara (BTCUSDT)"
            className="w-full max-w-xs rounded-full border border-outline/50 bg-surface px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 font-medium text-black shadow-inner-glow transition hover:bg-slate-200"
          >
            Sinyali yükle
          </button>
        </form>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          {PRIMARY_SYMBOLS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => void loadSignal(symbol)}
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
              onClick={() => void loadSignal(symbol)}
              className="rounded-full border border-outline/40 bg-muted/60 px-3 py-1 transition hover:border-outline hover:text-white"
            >
              {SYMBOL_LABELS[symbol] ?? symbol}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {SYMBOL_LABELS[activeSymbol] ?? activeSymbol} • sinyal özeti
              </h2>
              <p className="text-sm text-slate-400">Sinyal motorunun son çıkışı ve teknik ayrıntıları.</p>
            </div>
            {signalError && (
              <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                {signalError}
              </span>
            )}
          </header>

          <div className="mt-6 space-y-6">
            {signalLoading ? (
              <div className="h-40 rounded-2xl border border-outline/30 bg-muted/60 animate-pulse" />
            ) : signal ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-[0.28em] text-slate-500">Özet</h3>
                  <dl className="space-y-3 text-sm text-slate-300">
                    {summaryMetrics.map((metric) => (
                      <div key={metric.label} className="flex items-center justify-between">
                        <dt>{metric.label}</dt>
                        <dd className="text-white">{metric.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-[0.28em] text-slate-500">Teknikler</h3>
                  <dl className="space-y-3 text-sm text-slate-300">
                    {techMetrics.map((metric) => (
                      <div key={metric.label} className="flex items-center justify-between">
                        <dt>{metric.label}</dt>
                        <dd className="text-white">{metric.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-outline/30 bg-muted/60 p-4 text-sm text-slate-300">
                Henüz sinyal bulunamadı. Farklı bir sembol deneyin.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {riskMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-outline/30 bg-muted/60 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-sm text-white">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
            <h3 className="text-lg font-semibold text-white">Otomasyon eşiği</h3>
            <p className="mt-1 text-sm text-slate-400">
              Skor belirlenen eşiği aşınca otomatik olarak işlem tetiklenir.
            </p>
            <div className="mt-4 space-y-4 text-sm">
              <label className="block text-xs uppercase tracking-[0.28em] text-slate-500">
                Eşik
                <input
                  value={autoThreshold}
                  onChange={(event) => setAutoThreshold(event.target.value)}
                  className="mt-1 w-full rounded-full border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="block text-xs uppercase tracking-[0.28em] text-slate-500">
                Miktar
                <input
                  value={autoQty}
                  onChange={(event) => setAutoQty(event.target.value)}
                  className="mt-1 w-full rounded-full border border-outline/50 bg-canvas px-4 py-2 text-sm text-ink focus:border-outline focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <button
                type="button"
                onClick={handleAutoTrade}
                disabled={autoBusy}
                className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-inner-glow transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {autoBusy ? 'Ayar bekleniyor…' : 'Otomasyonu devreye al'}
              </button>
              {autoStatus && <p className="text-xs text-slate-400">{autoStatus}</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Hızlı backtest</h3>
              <button
                type="button"
                onClick={runBacktest}
                className="rounded-full border border-outline/40 px-3 py-1 text-xs text-slate-300 transition hover:border-outline hover:text-white"
              >
                Çalıştır
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              400 işlem, 4 saat ufuk, 4 bps komisyon, 1 bps kayma.
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
              <p className="mt-4 text-xs text-slate-400">Backtesti çalıştır ve sonuçları burada gör.</p>
            )}
          </div>

          <div className="rounded-3xl border border-outline/40 bg-surface p-6 shadow-elevation-soft text-xs text-slate-300">
            <h3 className="text-lg font-semibold text-white">Daha fazla öğren</h3>
            <ul className="mt-3 space-y-2 list-disc pl-4">
              <li>
                <Link to="/assistant" className="text-slate-200 transition hover:text-white">
                  Assistant ile sinyal açıklaması iste →
                </Link>
              </li>
              <li>
                <Link to="/forum" className="text-slate-200 transition hover:text-white">
                  Forumda strateji paylaşımlarını oku →
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-slate-200 transition hover:text-white">
                  Portföy görünümüne geri dön →
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
