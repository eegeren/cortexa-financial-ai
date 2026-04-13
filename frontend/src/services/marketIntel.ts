import http from '@/services/httpClient';

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: string;
  history: Array<{ date: string; value: number; classification: string }>;
}

export interface ETFFlow {
  ticker: string;
  name: string;
  flow_usd: number;
  date: string;
}

export interface ETFFlowsData {
  flows: ETFFlow[];
  total_net_flow: number;
  period: string;
}

export interface WhaleAlert {
  id: string;
  timestamp: string;
  amount: number;
  amount_usd: number;
  symbol: string;
  from: string;
  from_type: 'exchange' | 'wallet' | 'unknown';
  to: string;
  to_type: 'exchange' | 'wallet' | 'unknown';
  tx_hash?: string;
}

export interface WhaleAlertsData {
  alerts: WhaleAlert[];
  page: number;
  total: number;
}

export interface LiquidationLevel {
  price: number;
  long_usd: number;
  short_usd: number;
}

export interface LiquidationsData {
  symbol: string;
  current_price: number;
  levels: LiquidationLevel[];
  updated_at: string;
}

export interface VolumeSpike {
  symbol: string;
  current_volume: number;
  avg_volume: number;
  spike_ratio: number;
  price_change_pct: number;
  direction: 'up' | 'down' | 'flat';
}

export interface VolumeSpikesData {
  spikes: VolumeSpike[];
  scanned_at: string;
}

export interface OnChainMetric {
  key: string;
  label: string;
  value: number;
  formatted: string;
  interpretation: string;
  description: string;
  signal: 'OVERVALUED' | 'UNDERVALUED' | 'FAIR' | 'CAUTION' | 'OPPORTUNITY' | 'NEUTRAL';
}

export interface OnChainData {
  symbol: string;
  metrics: OnChainMetric[];
  updated_at: string;
}

type FearGreedApi = {
  data?: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
};

type ETFFlowsApi = {
  updated_at: string;
  products: Array<{
    ticker: string;
    name: string;
    flows: Array<{ date: string; inflow_usd_millions: number }>;
  }>;
};

type LiquidationsApi = {
  symbol: string;
  current_price: number;
  updated_at: string;
  levels: Array<{
    price: number;
    long_liquidations_usd: number;
    short_liquidations_usd: number;
  }>;
};

type WhaleAlertsApi = {
  updated_at: string;
  alerts: Array<{
    id: string;
    timestamp: string;
    amount: number;
    amount_usd: number;
    symbol: string;
    from: string;
    to: string;
    tx_hash?: string;
  }>;
};

type OnChainApi = {
  symbol: string;
  updated_at: string;
  metrics: Array<{
    name: string;
    value: number;
    signal: string;
    description: string;
  }>;
};

type VolumeSpikesApi = {
  updated_at: string;
  spikes: Array<{
    symbol: string;
    current_volume_usd: number;
    avg_volume_usd: number;
    ratio: number;
    price_change_1h_pct: number;
  }>;
};

const PUBLIC_API = '/api/public';

const toTransferType = (label: string): 'exchange' | 'wallet' | 'unknown' => {
  const normalized = label.toLowerCase();
  if (normalized.includes('binance') || normalized.includes('coinbase') || normalized.includes('kraken') || normalized.includes('okx') || normalized.includes('bybit') || normalized.includes('circle')) {
    return 'exchange';
  }
  if (normalized.includes('wallet')) {
    return 'wallet';
  }
  return 'unknown';
};

const toSignal = (signal: string): OnChainMetric['signal'] => {
  switch (signal.toLowerCase()) {
    case 'bullish':
      return 'OPPORTUNITY';
    case 'bearish':
      return 'CAUTION';
    default:
      return 'FAIR';
  }
};

const formatMetric = (name: string, value: number) => {
  if (name.toLowerCase().includes('reserve')) return value.toFixed(5);
  if (name.toLowerCase().includes('sopr')) return value.toFixed(4);
  if (name.toLowerCase().includes('stock')) return value.toFixed(1);
  return value.toFixed(3).replace(/\.?0+$/, '');
};

const interpretMetric = (name: string, signal: OnChainMetric['signal']) => {
  if (signal === 'OPPORTUNITY' || signal === 'UNDERVALUED') return `${name} suggests favorable positioning.`;
  if (signal === 'CAUTION' || signal === 'OVERVALUED') return `${name} is flashing caution.`;
  return `${name} remains in a balanced range.`;
};

export const fetchFearGreed = async () => {
  const { data } = await http.get<FearGreedApi>(`${PUBLIC_API}/market/fear-greed`);
  const history = (data.data ?? [])
    .map((entry) => ({
      date: new Date(Number(entry.timestamp) * 1000).toISOString(),
      value: Number(entry.value),
      classification: entry.value_classification,
    }))
    .reverse();
  const latest = history[history.length - 1];
  return {
    value: latest?.value ?? 0,
    classification: latest?.classification ?? 'Neutral',
    timestamp: latest?.date ?? new Date().toISOString(),
    history,
  } satisfies FearGreedData;
};

export const fetchETFFlows = async () => {
  const { data } = await http.get<ETFFlowsApi>(`${PUBLIC_API}/market/etf-flows`);
  const flows = (data.products ?? []).map((product) => {
    const latestFlow = product.flows?.[0];
    return {
      ticker: product.ticker,
      name: product.name,
      flow_usd: (latestFlow?.inflow_usd_millions ?? 0) * 1_000_000,
      date: latestFlow?.date ?? data.updated_at,
    };
  });
  return {
    flows,
    total_net_flow: flows.reduce((sum, item) => sum + item.flow_usd, 0),
    period: flows[0]?.date ?? data.updated_at,
  } satisfies ETFFlowsData;
};

export const fetchWhaleAlerts = async () => {
  const { data } = await http.get<WhaleAlertsApi>(`${PUBLIC_API}/market/whale-alerts`);
  return {
    alerts: (data.alerts ?? []).map((alert) => ({
      id: alert.id,
      timestamp: alert.timestamp,
      amount: alert.amount,
      amount_usd: alert.amount_usd,
      symbol: alert.symbol,
      from: alert.from,
      from_type: toTransferType(alert.from),
      to: alert.to,
      to_type: toTransferType(alert.to),
      tx_hash: alert.tx_hash,
    })),
    page: 1,
    total: data.alerts?.length ?? 0,
  } satisfies WhaleAlertsData;
};

export const fetchLiquidations = async (symbol?: string) => {
  const { data } = await http.get<LiquidationsApi>(`${PUBLIC_API}/market/liquidations`, {
    params: symbol ? { symbol } : undefined,
  });
  return {
    symbol: data.symbol,
    current_price: data.current_price,
    updated_at: data.updated_at,
    levels: (data.levels ?? []).map((level) => ({
      price: level.price,
      long_usd: level.long_liquidations_usd,
      short_usd: level.short_liquidations_usd,
    })),
  } satisfies LiquidationsData;
};

export const fetchOnChainMetrics = async (symbol?: string) => {
  const { data } = await http.get<OnChainApi>(`${PUBLIC_API}/market/on-chain`, {
    params: symbol ? { symbol } : undefined,
  });
  return {
    symbol: data.symbol,
    updated_at: data.updated_at,
    metrics: (data.metrics ?? []).map((metric) => {
      const mappedSignal = toSignal(metric.signal);
      return {
        key: metric.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: metric.name,
        value: metric.value,
        formatted: formatMetric(metric.name, metric.value),
        interpretation: interpretMetric(metric.name, mappedSignal),
        description: metric.description,
        signal: mappedSignal,
      };
    }),
  } satisfies OnChainData;
};

export const fetchVolumeSpikes = async () => {
  const { data } = await http.get<VolumeSpikesApi>(`${PUBLIC_API}/market/volume-spikes`);
  return {
    spikes: (data.spikes ?? []).map((spike) => ({
      symbol: spike.symbol,
      current_volume: spike.current_volume_usd,
      avg_volume: spike.avg_volume_usd,
      spike_ratio: spike.ratio,
      price_change_pct: spike.price_change_1h_pct,
      direction: spike.price_change_1h_pct > 0 ? 'up' : spike.price_change_1h_pct < 0 ? 'down' : 'flat',
    })),
    scanned_at: data.updated_at,
  } satisfies VolumeSpikesData;
};
