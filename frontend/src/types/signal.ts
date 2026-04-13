export type EdgeType = 'long' | 'short' | 'limited' | 'none';
export type RegimeType = 'trending' | 'range' | 'low';
export type Timeframe = '15m' | '1h' | '4h' | (string & {});
export type IndicatorBias = 'bull' | 'bear' | 'neutral';

export interface IndicatorSnapshot {
  name: string;
  value: number | string;
  bias: IndicatorBias;
  note?: string;
}

export interface ScoreBreakdown {
  trend: number;
  momentum: number;
  regime: number;
  volume: number;
  risk: number;
  total?: number;
}

export interface SupportResistanceLevel {
  label: string;
  value: number;
  type: 'support' | 'resistance';
  distancePct?: number;
}

export interface Signal {
  id: string;
  symbol: string;
  pair: string;
  timeframe: Timeframe;
  edge: EdgeType;
  regime: RegimeType;
  score: number;
  price: number;
  updatedAt: string;
  summary: string;
  confidence?: number;
  change24h?: number;
  indicators: IndicatorSnapshot[];
  scoreBreakdown: ScoreBreakdown;
  supportResistance: SupportResistanceLevel[];
  nlpSummary: string;
}

export interface SignalListResponse {
  items: Signal[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SignalFilters {
  edge?: EdgeType | 'all';
  timeframe?: Timeframe | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'pair' | 'score' | 'price' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface SignalCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}
