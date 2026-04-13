import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import Card from '@/components/Card';
import Skeleton from '@/components/Skeleton';
import FearGreedWidget from '@/components/FearGreedWidget';
import {
  fetchFearGreed,
  fetchETFFlows,
  fetchWhaleAlerts,
  fetchLiquidations,
  fetchVolumeSpikes,
  fetchOnChainMetrics,
  type FearGreedData,
  type ETFFlowsData,
  type WhaleAlertsData,
  type LiquidationsData,
  type VolumeSpikesData,
  type OnChainData,
  type WhaleAlert,
  type OnChainMetric,
} from '@/services/marketIntel';

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatUSD = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const formatRelative = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(Math.abs(diffMs) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

// ─── Fear & Greed Section ───────────────────────────────────────────────────

const FALLBACK_FEAR_GREED: FearGreedData = {
  value: 62,
  classification: 'Greed',
  timestamp: new Date().toISOString(),
  history: [
    { date: '2026-03-27', value: 45, classification: 'Fear' },
    { date: '2026-03-28', value: 51, classification: 'Neutral' },
    { date: '2026-03-29', value: 55, classification: 'Neutral' },
    { date: '2026-03-30', value: 58, classification: 'Greed' },
    { date: '2026-03-31', value: 60, classification: 'Greed' },
    { date: '2026-04-01', value: 61, classification: 'Greed' },
    { date: '2026-04-02', value: 62, classification: 'Greed' },
  ],
};

const historyBarColor = (value: number): string => {
  if (value <= 25) return 'bg-red-500';
  if (value <= 50) return 'bg-orange-400';
  if (value <= 55) return 'bg-yellow-400';
  if (value <= 75) return 'bg-emerald-300';
  return 'bg-emerald-500';
};

const FearGreedSection = () => {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFearGreed()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) { setData(FALLBACK_FEAR_GREED); setError('Using cached data'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const display = data ?? FALLBACK_FEAR_GREED;

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible">
      <Card className="rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.36em] text-slate-500">Sentiment</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Fear &amp; Greed Index</h2>
          </div>
          {error && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 ring-1 ring-amber-500/20">
              {error}
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            <Skeleton className="h-24 w-48 rounded-2xl" />
            <Skeleton className="h-4 w-32 rounded" />
            <div className="flex gap-2">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12 w-6 rounded" />)}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-5">
            <FearGreedWidget value={display.value} classification={display.classification} />

            {/* 7-day trend */}
            <div className="w-full">
              <p className="mb-3 text-[10px] uppercase tracking-widest text-slate-600">7-Day Trend</p>
              <div className="flex items-end justify-between gap-1">
                {display.history.map((point) => {
                  const heightPct = Math.max(10, point.value);
                  return (
                    <div key={point.date} className="group flex flex-col items-center gap-1">
                      <div className="relative flex h-20 flex-col justify-end">
                        <motion.div
                          className={clsx('w-6 rounded-t-sm', historyBarColor(point.value))}
                          style={{ height: `${heightPct * 0.8}%` }}
                          initial={{ scaleY: 0, originY: 1 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        />
                        {/* Tooltip */}
                        <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          <p className="text-[10px] font-bold text-white">{point.value}</p>
                          <p className="text-[9px] text-slate-400">{point.classification}</p>
                        </div>
                      </div>
                      <p className="text-[8px] text-slate-600">
                        {new Date(point.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

// ─── ETF Flows Section ──────────────────────────────────────────────────────

const FALLBACK_ETF: ETFFlowsData = {
  flows: [
    { ticker: 'IBIT', name: 'iShares Bitcoin ETF', flow_usd: 312_000_000, date: '2026-04-02' },
    { ticker: 'FBTC', name: 'Fidelity Bitcoin ETF', flow_usd: -42_000_000, date: '2026-04-02' },
    { ticker: 'ARKB', name: 'ARK 21Shares Bitcoin', flow_usd: 89_000_000, date: '2026-04-02' },
    { ticker: 'BITB', name: 'Bitwise Bitcoin ETF', flow_usd: 26_000_000, date: '2026-04-02' },
    { ticker: 'GBTC', name: 'Grayscale Bitcoin Trust', flow_usd: -115_000_000, date: '2026-04-02' },
    { ticker: 'HODL', name: 'VanEck Bitcoin ETF', flow_usd: 18_500_000, date: '2026-04-02' },
  ],
  total_net_flow: 288_500_000,
  period: '2026-04-02',
};

const ETFFlowsSection = () => {
  const [data, setData] = useState<ETFFlowsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchETFFlows()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(FALLBACK_ETF); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const display = data ?? FALLBACK_ETF;
  const maxAbs = Math.max(...display.flows.map((f) => Math.abs(f.flow_usd)), 1);

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible">
      <Card className="rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.36em] text-slate-500">Institutional</p>
            <h2 className="mt-2 text-lg font-semibold text-white">ETF Flows</h2>
          </div>
          {!loading && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Net Weekly</p>
              <p className={clsx('text-sm font-bold', display.total_net_flow >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {formatUSD(display.total_net_flow)}
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="mt-5 space-y-2.5">
            {display.flows.map((etf) => {
              const barWidth = (Math.abs(etf.flow_usd) / maxAbs) * 100;
              const isPositive = etf.flow_usd >= 0;
              return (
                <div key={etf.ticker} className="group relative rounded-xl border border-slate-800/50 bg-slate-950/40 px-4 py-3 overflow-hidden">
                  {/* Background fill bar */}
                  <motion.div
                    className={clsx('absolute inset-y-0 left-0 rounded-xl opacity-20', isPositive ? 'bg-emerald-500' : 'bg-rose-500')}
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{etf.ticker}</span>
                      <span className="hidden text-[11px] text-slate-500 sm:inline">{etf.name}</span>
                    </div>
                    <span className={clsx('text-sm font-semibold tabular-nums', isPositive ? 'text-emerald-400' : 'text-rose-400')}>
                      {formatUSD(etf.flow_usd)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
};

// ─── Whale Activity Section ─────────────────────────────────────────────────

const FALLBACK_WHALES: WhaleAlertsData = {
  alerts: [
    { id: '1', timestamp: new Date(Date.now() - 3 * 60_000).toISOString(), amount: 1450, amount_usd: 99_650_000, symbol: 'BTC', from: 'Unknown Wallet', from_type: 'wallet', to: 'Binance', to_type: 'exchange' },
    { id: '2', timestamp: new Date(Date.now() - 8 * 60_000).toISOString(), amount: 28_000, amount_usd: 76_440_000, symbol: 'ETH', from: 'Coinbase', from_type: 'exchange', to: 'Unknown Wallet', to_type: 'wallet' },
    { id: '3', timestamp: new Date(Date.now() - 15 * 60_000).toISOString(), amount: 9_000_000, amount_usd: 9_000_000, symbol: 'USDT', from: 'Unknown Wallet', from_type: 'wallet', to: 'Unknown Wallet', to_type: 'wallet' },
    { id: '4', timestamp: new Date(Date.now() - 31 * 60_000).toISOString(), amount: 820, amount_usd: 56_274_000, symbol: 'BTC', from: 'Kraken', from_type: 'exchange', to: 'Unknown Wallet', to_type: 'wallet' },
    { id: '5', timestamp: new Date(Date.now() - 48 * 60_000).toISOString(), amount: 2_100_000, amount_usd: 2_100_000, symbol: 'USDC', from: 'Circle', from_type: 'exchange', to: 'OKX', to_type: 'exchange' },
  ],
  page: 1,
  total: 24,
};

const whaleRowStyle = (alert: WhaleAlert) => {
  if (alert.to_type === 'exchange' && alert.from_type !== 'exchange') {
    return { dot: 'bg-rose-500', badge: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/20', label: 'To Exchange' };
  }
  if (alert.from_type === 'exchange' && alert.to_type !== 'exchange') {
    return { dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20', label: 'Withdraw' };
  }
  return { dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20', label: 'Transfer' };
};

const WhaleActivitySection = () => {
  const [data, setData] = useState<WhaleAlertsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchWhaleAlerts()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(FALLBACK_WHALES); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const display = data ?? FALLBACK_WHALES;

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible">
      <Card className="rounded-3xl p-5 sm:p-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.36em] text-slate-500">On-Chain</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Whale Activity</h2>
        </div>

        {loading ? (
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="mt-4 space-y-2 overflow-y-auto" style={{ maxHeight: 340 }}>
            <AnimatePresence>
              {display.alerts.map((alert, idx) => {
                const style = whaleRowStyle(alert);
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="flex items-center gap-3 rounded-xl border border-slate-800/50 bg-slate-950/40 px-4 py-3"
                  >
                    <div className={clsx('h-2 w-2 flex-shrink-0 rounded-full', style.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">
                          {alert.amount_usd >= 1_000_000
                            ? `$${(alert.amount_usd / 1_000_000).toFixed(1)}M`
                            : `$${(alert.amount_usd / 1_000).toFixed(0)}K`}
                        </span>
                        <span className="text-xs text-slate-400">{alert.symbol}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {alert.from} → {alert.to}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', style.badge)}>
                        {style.label}
                      </span>
                      <span className="text-[10px] text-slate-600">{formatRelative(alert.timestamp)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

// ─── Liquidation Heatmap Section ────────────────────────────────────────────

const FALLBACK_LIQUIDATIONS: LiquidationsData = {
  symbol: 'BTCUSDT',
  current_price: 68_420,
  levels: [
    { price: 72_000, long_usd: 45_000_000, short_usd: 180_000_000 },
    { price: 71_000, long_usd: 28_000_000, short_usd: 120_000_000 },
    { price: 70_000, long_usd: 15_000_000, short_usd: 85_000_000 },
    { price: 69_500, long_usd: 8_000_000, short_usd: 60_000_000 },
    { price: 69_000, long_usd: 4_200_000, short_usd: 32_000_000 },
    { price: 68_500, long_usd: 2_100_000, short_usd: 15_000_000 },
    { price: 68_000, long_usd: 95_000_000, short_usd: 8_000_000 },
    { price: 67_500, long_usd: 145_000_000, short_usd: 4_500_000 },
    { price: 67_000, long_usd: 92_000_000, short_usd: 2_200_000 },
    { price: 66_000, long_usd: 72_000_000, short_usd: 1_100_000 },
    { price: 65_000, long_usd: 118_000_000, short_usd: 800_000 },
    { price: 64_000, long_usd: 55_000_000, short_usd: 400_000 },
  ],
  updated_at: new Date().toISOString(),
};

type LiqSide = 'both' | 'long' | 'short';

const LiquidationHeatmapSection = () => {
  const [data, setData] = useState<LiquidationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<LiqSide>('both');

  useEffect(() => {
    let alive = true;
    fetchLiquidations('BTCUSDT')
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(FALLBACK_LIQUIDATIONS); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const display = data ?? FALLBACK_LIQUIDATIONS;

  const sortedLevels = [...display.levels].sort((a, b) => b.price - a.price);
  const maxVal = Math.max(
    ...sortedLevels.map((l) => {
      if (side === 'long') return l.long_usd;
      if (side === 'short') return l.short_usd;
      return l.long_usd + l.short_usd;
    }),
    1
  );

  const getLevelValue = (l: LiquidationsData['levels'][number]) => {
    if (side === 'long') return l.long_usd;
    if (side === 'short') return l.short_usd;
    return l.long_usd + l.short_usd;
  };

  const intensityColor = (val: number, max: number): string => {
    const ratio = val / max;
    if (ratio > 0.7) return 'rgba(16, 185, 129, 0.85)';
    if (ratio > 0.4) return 'rgba(16, 185, 129, 0.50)';
    if (ratio > 0.2) return 'rgba(16, 185, 129, 0.28)';
    return 'rgba(16, 185, 129, 0.10)';
  };

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible">
      <Card className="rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.36em] text-slate-500">Derivatives</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Liquidation Heatmap</h2>
          </div>
          <div className="flex rounded-xl border border-slate-800 overflow-hidden text-[11px]">
            {(['both', 'long', 'short'] as LiqSide[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={clsx(
                  'px-3 py-1.5 capitalize transition',
                  side === s
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-transparent text-slate-500 hover:text-slate-300'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-5 space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="mt-5 space-y-1">
            {sortedLevels.map((level) => {
              const val = getLevelValue(level);
              const widthPct = (val / maxVal) * 100;
              const isCurrentPrice = Math.abs(level.price - display.current_price) < (display.current_price * 0.005);
              const isAbove = level.price > display.current_price;

              return (
                <div
                  key={level.price}
                  className={clsx(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 transition',
                    isCurrentPrice && 'ring-1 ring-emerald-400/60'
                  )}
                >
                  {/* Heatmap background */}
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-lg"
                    style={{ backgroundColor: intensityColor(val, maxVal) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <div className="relative flex flex-1 items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isCurrentPrice && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                      <span className={clsx('text-xs font-mono tabular-nums font-medium', isAbove ? 'text-slate-400' : 'text-slate-300')}>
                        ${level.price.toLocaleString()}
                      </span>
                      {isCurrentPrice && (
                        <span className="rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[9px] text-emerald-300 font-bold uppercase">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {val >= 1_000_000
                        ? `$${(val / 1_000_000).toFixed(1)}M`
                        : `$${(val / 1_000).toFixed(0)}K`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
};

// ─── Volume Spike Scanner Section ───────────────────────────────────────────

const FALLBACK_VOLUME_SPIKES: VolumeSpikesData = {
  spikes: [
    { symbol: 'PEPEUSDT', current_volume: 8_420_000_000, avg_volume: 980_000_000, spike_ratio: 8.59, price_change_pct: 18.4, direction: 'up' },
    { symbol: 'WIFUSDT', current_volume: 2_100_000_000, avg_volume: 320_000_000, spike_ratio: 6.56, price_change_pct: 12.1, direction: 'up' },
    { symbol: 'BONKUSDT', current_volume: 1_850_000_000, avg_volume: 290_000_000, spike_ratio: 6.38, price_change_pct: -8.2, direction: 'down' },
    { symbol: 'SOLUSDT', current_volume: 4_200_000_000, avg_volume: 820_000_000, spike_ratio: 5.12, price_change_pct: 6.7, direction: 'up' },
    { symbol: 'JUPUSDT', current_volume: 680_000_000, avg_volume: 140_000_000, spike_ratio: 4.86, price_change_pct: 9.3, direction: 'up' },
    { symbol: 'APTUSDT', current_volume: 520_000_000, avg_volume: 120_000_000, spike_ratio: 4.33, price_change_pct: -3.1, direction: 'down' },
    { symbol: 'ARBUSDT', current_volume: 890_000_000, avg_volume: 210_000_000, spike_ratio: 4.24, price_change_pct: 4.5, direction: 'up' },
    { symbol: 'INJUSDT', current_volume: 430_000_000, avg_volume: 108_000_000, spike_ratio: 3.98, price_change_pct: 7.2, direction: 'up' },
  ],
  scanned_at: new Date().toISOString(),
};

const spikeIntensityClass = (ratio: number): string => {
  if (ratio >= 7) return 'bg-violet-500/25 text-violet-200 ring-1 ring-violet-500/30';
  if (ratio >= 5) return 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/25';
  if (ratio >= 3) return 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/25';
  return 'bg-slate-700/40 text-slate-400 ring-1 ring-slate-700/40';
};

const VolumeSpikeSection = () => {
  const [data, setData] = useState<VolumeSpikesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchVolumeSpikes()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(FALLBACK_VOLUME_SPIKES); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const display = data ?? FALLBACK_VOLUME_SPIKES;

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible">
      <Card className="rounded-3xl p-5 sm:p-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.36em] text-slate-500">Scanner</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Volume Spike Scanner</h2>
        </div>

        {loading ? (
          <div className="mt-5 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-600">
                  <th className="pb-2 text-left">Symbol</th>
                  <th className="pb-2 text-right">Spike</th>
                  <th className="pb-2 text-right">Current Vol</th>
                  <th className="pb-2 text-right hidden sm:table-cell">Avg Vol</th>
                  <th className="pb-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {display.spikes.map((spike, idx) => (
                  <motion.tr
                    key={spike.symbol}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    className="group"
                  >
                    <td className="py-2.5 pr-2 font-medium text-slate-200">
                      {spike.symbol.replace('USDT', '')}
                      <span className="ml-1 text-[10px] text-slate-600">USDT</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold', spikeIntensityClass(spike.spike_ratio))}>
                        {spike.spike_ratio.toFixed(1)}x
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-300 tabular-nums">
                      {spike.current_volume >= 1_000_000_000
                        ? `$${(spike.current_volume / 1_000_000_000).toFixed(2)}B`
                        : `$${(spike.current_volume / 1_000_000).toFixed(0)}M`}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-500 tabular-nums hidden sm:table-cell">
                      {spike.avg_volume >= 1_000_000_000
                        ? `$${(spike.avg_volume / 1_000_000_000).toFixed(2)}B`
                        : `$${(spike.avg_volume / 1_000_000).toFixed(0)}M`}
                    </td>
                    <td className={clsx('py-2.5 text-right font-semibold tabular-nums', spike.price_change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                      {spike.price_change_pct >= 0 ? '+' : ''}{spike.price_change_pct.toFixed(1)}%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

// ─── On-Chain Metrics Section ───────────────────────────────────────────────

const FALLBACK_ON_CHAIN: OnChainData = {
  symbol: 'BTC',
  updated_at: new Date().toISOString(),
  metrics: [
    { key: 'mvrv', label: 'MVRV Z-Score', value: 2.41, formatted: '2.41', interpretation: 'Approaching overvalued territory', description: 'Market Value to Realized Value. Values above 7 indicate extreme overvaluation; below 0 signals undervaluation.', signal: 'CAUTION' },
    { key: 'sopr', label: 'SOPR', value: 1.023, formatted: '1.023', interpretation: 'Holders realizing profits', description: 'Spent Output Profit Ratio. Values > 1 mean coins are moved at profit; < 1 means at a loss.', signal: 'CAUTION' },
    { key: 'nupl', label: 'NUPL', value: 0.52, formatted: '52%', interpretation: 'Belief / Optimism phase', description: 'Net Unrealized Profit/Loss. Tracks the overall profitability of the network.', signal: 'FAIR' },
    { key: 'puell', label: 'Puell Multiple', value: 1.38, formatted: '1.38', interpretation: 'Healthy miner revenue', description: 'Daily miner issuance (USD) vs 365-day average. High values may precede sell pressure from miners.', signal: 'FAIR' },
    { key: 'reserve_risk', label: 'Reserve Risk', value: 0.0021, formatted: '0.0021', interpretation: 'Favorable risk/reward', description: 'Measures the risk/reward of investing relative to long-term holder conviction.', signal: 'OPPORTUNITY' },
    { key: 's2f', label: 'S2F Model', value: 0.92, formatted: '92% of model price', interpretation: 'Trading below model', description: 'Stock-to-Flow compares available supply to newly produced supply. Values < 1 suggest undervaluation vs model.', signal: 'UNDERVALUED' },
  ],
};

const signalBadgeClass: Record<OnChainMetric['signal'], string> = {
  OVERVALUED:  'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/25',
  UNDERVALUED: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/25',
  FAIR:        'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20',
  CAUTION:     'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/25',
  OPPORTUNITY: 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/25',
  NEUTRAL:     'bg-slate-700/40 text-slate-400 ring-1 ring-slate-700/40',
};

const OnChainSection = () => {
  const [data, setData] = useState<OnChainData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchOnChainMetrics('BTC')
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(FALLBACK_ON_CHAIN); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const display = data ?? FALLBACK_ON_CHAIN;

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible" className="xl:col-span-2">
      <Card className="rounded-3xl p-5 sm:p-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.36em] text-slate-500">Blockchain</p>
          <h2 className="mt-2 text-lg font-semibold text-white">On-Chain Metrics</h2>
          <p className="mt-1 text-xs text-slate-500">BTC network health indicators from on-chain data</p>
        </div>

        {loading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {display.metrics.map((metric, idx) => (
              <motion.div
                key={metric.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
                className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4"
              >
                {/* Top accent bar */}
                <div className={clsx('absolute inset-x-0 top-0 h-0.5', {
                  'bg-rose-500': metric.signal === 'OVERVALUED',
                  'bg-emerald-500': metric.signal === 'UNDERVALUED' || metric.signal === 'OPPORTUNITY',
                  'bg-blue-500': metric.signal === 'FAIR',
                  'bg-amber-500': metric.signal === 'CAUTION',
                  'bg-violet-500': metric.signal === 'OPPORTUNITY',
                  'bg-slate-700': metric.signal === 'NEUTRAL',
                })} />
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">{metric.label}</p>
                  <span className={clsx('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase', signalBadgeClass[metric.signal])}>
                    {metric.signal}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold text-white">{metric.formatted}</p>
                <p className="mt-1 text-xs font-medium text-slate-300">{metric.interpretation}</p>
                <p className="mt-2 text-[11px] leading-4 text-slate-600">{metric.description}</p>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

const AnalyticsPage = ({ compact = false }: { compact?: boolean }) => {
  return (
    <div className={compact ? 'space-y-6 sm:space-y-8' : 'min-h-screen space-y-6 sm:space-y-8'}>
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-500">Live</p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
            Market Intelligence Terminal
          </h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Institutional-grade analytics powered by AI
          </p>
        </motion.div>
      )}

      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
        <FearGreedSection />
        <ETFFlowsSection />
        <WhaleActivitySection />
        <LiquidationHeatmapSection />
        <VolumeSpikeSection />
      </div>
      <OnChainSection />
    </div>
  );
};

export default AnalyticsPage;
