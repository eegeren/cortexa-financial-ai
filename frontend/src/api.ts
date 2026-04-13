import httpClient from '@/services/httpClient';
import type { BotOrder, BotOrdersResponse, BotSettings } from '@/types/bot';
import type {
  EdgeType,
  IndicatorBias,
  IndicatorSnapshot,
  RegimeType,
  ScoreBreakdown,
  Signal,
  SignalCandle,
  SignalFilters,
  SignalListResponse,
  SupportResistanceLevel,
  Timeframe,
} from '@/types/signal';

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePair = (value: unknown) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'BTC/USDT';
  }
  const raw = value.trim().toUpperCase();
  if (raw.includes('/')) {
    return raw;
  }
  return raw.replace(/USDT$/, '/USDT');
};

const normalizeSymbol = (value: unknown) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'BTCUSDT';
  }
  return value.trim().toUpperCase().replace('/', '');
};

const normalizeEdge = (value: unknown): EdgeType => {
  if (typeof value !== 'string') {
    return 'none';
  }

  const edge = value.trim().toLowerCase();
  if (edge.includes('buy') || edge.includes('bull') || edge === 'long') {
    return 'long';
  }
  if (edge.includes('sell') || edge.includes('bear') || edge === 'short') {
    return 'short';
  }
  if (edge.includes('limit') || edge.includes('weak') || edge.includes('mixed')) {
    return 'limited';
  }
  return edge === 'none' ? 'none' : 'limited';
};

const normalizeRegime = (value: unknown): RegimeType => {
  if (typeof value !== 'string') {
    return 'range';
  }

  const regime = value.trim().toLowerCase();
  if (regime.includes('trend')) {
    return 'trending';
  }
  if (regime.includes('low') || regime.includes('quiet') || regime.includes('compression')) {
    return 'low';
  }
  return 'range';
};

const inferBias = (name: string, value: number | string): IndicatorBias => {
  const label = name.toLowerCase();
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized.includes('bull')) return 'bull';
    if (normalized.includes('bear')) return 'bear';
    return 'neutral';
  }

  if (label === 'rsi') {
    if (value >= 55) return 'bull';
    if (value <= 45) return 'bear';
    return 'neutral';
  }

  if (label === 'adx') {
    return value >= 25 ? 'bull' : 'neutral';
  }

  return 'neutral';
};

const normalizeIndicators = (raw: Record<string, unknown>): IndicatorSnapshot[] => {
  const entries: IndicatorSnapshot[] = [];
  const indicators = raw.indicators;

  if (Array.isArray(indicators)) {
    indicators.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : 'Indicator';
      const value = typeof record.value === 'number' || typeof record.value === 'string' ? record.value : '—';
      const bias =
        record.bias === 'bull' || record.bias === 'bear' || record.bias === 'neutral'
          ? (record.bias as IndicatorBias)
          : inferBias(name, value);
      entries.push({
        name,
        value,
        bias,
        note: typeof record.note === 'string' ? record.note : undefined,
      });
    });
  } else if (indicators && typeof indicators === 'object') {
    const indicatorRecord = indicators as Record<string, unknown>;
    const scalarKeys: Array<[string, unknown]> = [
      ['RSI', indicatorRecord.rsi ?? raw.rsi],
      ['ADX', indicatorRecord.adx ?? raw.adx],
      ['ATR', indicatorRecord.atr ?? raw.atr],
      ['EMA 20', indicatorRecord.ema20],
      ['EMA 50', indicatorRecord.ema50],
      ['EMA 200', indicatorRecord.ema200],
      ['Volume Ratio', indicatorRecord.volume_ratio],
    ];

    scalarKeys.forEach(([name, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      const formatted = typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : String(value);
      entries.push({ name, value: formatted, bias: inferBias(name, formatted) });
    });

    if (indicatorRecord.macd && typeof indicatorRecord.macd === 'object') {
      const macd = indicatorRecord.macd as Record<string, unknown>;
      const macdValue = [macd.macd, macd.signal]
        .map((value) => (value !== undefined && value !== null ? Number(value).toFixed(2) : null))
        .filter(Boolean)
        .join(' / ');
      if (macdValue) {
        entries.push({ name: 'MACD', value: macdValue, bias: inferBias('MACD', macdValue) });
      }
    }
  }

  if (!entries.length) {
    entries.push(
      { name: 'RSI', value: toNumber(raw.rsi, 50), bias: inferBias('RSI', toNumber(raw.rsi, 50)) },
      { name: 'ADX', value: toNumber(raw.adx, 20), bias: inferBias('ADX', toNumber(raw.adx, 20)) },
      { name: 'Momentum', value: String(raw.momentum ?? 'Mixed'), bias: inferBias('Momentum', String(raw.momentum ?? 'Mixed')) }
    );
  }

  return entries;
};

const normalizeLevels = (raw: Record<string, unknown>, price: number): SupportResistanceLevel[] => {
  const source = raw.supportResistance ?? raw.levels;
  if (Array.isArray(source)) {
    return source
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const record = item as Record<string, unknown>;
        const value = toNumber(record.value);
        return {
          label: typeof record.label === 'string' ? record.label : `L${index + 1}`,
          value,
          type: record.type === 'support' || record.type === 'resistance' ? record.type : index < 2 ? 'support' : 'resistance',
          distancePct:
            typeof record.distancePct === 'number'
              ? record.distancePct
              : price > 0
                ? Number((((value - price) / price) * 100).toFixed(2))
                : undefined,
        } satisfies SupportResistanceLevel;
      })
      .filter((item): item is SupportResistanceLevel => Boolean(item));
  }

  if (source && typeof source === 'object') {
    const levels = source as Record<string, unknown>;
    const support = levels.support !== undefined ? toNumber(levels.support) : undefined;
    const resistance = levels.resistance !== undefined ? toNumber(levels.resistance) : undefined;
    return [
      support !== undefined
        ? {
            label: 'S1',
            value: support,
            type: 'support',
            distancePct: price > 0 ? Number((((support - price) / price) * 100).toFixed(2)) : undefined,
          }
        : null,
      resistance !== undefined
        ? {
            label: 'R1',
            value: resistance,
            type: 'resistance',
            distancePct: price > 0 ? Number((((resistance - price) / price) * 100).toFixed(2)) : undefined,
          }
        : null,
    ].filter((item): item is SupportResistanceLevel => Boolean(item));
  }

  return [];
};

const normalizeBreakdown = (raw: Record<string, unknown>, score: number): ScoreBreakdown => {
  const scoring =
    (raw.scoreBreakdown && typeof raw.scoreBreakdown === 'object' ? raw.scoreBreakdown : null) ??
    (raw.scoring && typeof raw.scoring === 'object' ? raw.scoring : null) ??
    {};

  const source = scoring as Record<string, unknown>;
  const riskFromLabel =
    typeof raw.risk === 'string'
      ? { low: 85, medium: 68, high: 46 }[raw.risk.trim().toLowerCase() as 'low' | 'medium' | 'high'] ?? 60
      : 60;

  return {
    trend: toNumber(source.trend ?? source.trend_structure_score, score),
    momentum: toNumber(source.momentum ?? source.momentum_confirmation_score, score),
    regime: toNumber(source.regime ?? source.regime_score, score),
    volume: toNumber(source.volume ?? source.volume_participation_score, score),
    risk: toNumber(source.risk, riskFromLabel),
    total: toNumber(source.total ?? raw.final_score ?? raw.score, score),
  };
};

const normalizeSignal = (payload: unknown): Signal => {
  const raw = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const symbol = normalizeSymbol(raw.symbol ?? raw.id);
  const pair = normalizePair(raw.pair ?? raw.symbol ?? raw.market ?? symbol);
  const timeframe = (typeof raw.timeframe === 'string' && raw.timeframe.trim()) || '1h';
  const score = Math.max(0, Math.min(100, Math.round(toNumber(raw.score ?? raw.final_score ?? raw.confidence, 0))));
  const price = toNumber(raw.price ?? raw.entry_price ?? raw.last_price, 0);
  const summary =
    typeof raw.summary === 'string'
      ? raw.summary
      : typeof raw.explanation === 'string'
        ? raw.explanation
        : typeof raw.scenario === 'string'
          ? raw.scenario
          : typeof raw.insight === 'string'
            ? raw.insight
            : 'Market context is available for this signal.';

  return {
    id: symbol,
    symbol,
    pair,
    timeframe,
    edge: normalizeEdge(raw.edge ?? raw.side ?? raw.trend),
    regime: normalizeRegime(raw.regime ?? raw.market_regime),
    score,
    price,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : typeof raw.updated_at === 'string' ? raw.updated_at : new Date().toISOString(),
    summary,
    confidence: raw.confidence !== undefined ? Math.round(toNumber(raw.confidence, score)) : undefined,
    change24h:
      raw.change24h !== undefined
        ? toNumber(raw.change24h)
        : raw.price_change_percent !== undefined
          ? toNumber(raw.price_change_percent)
          : undefined,
    indicators: normalizeIndicators(raw),
    scoreBreakdown: normalizeBreakdown(raw, score),
    supportResistance: normalizeLevels(raw, price),
    nlpSummary:
      typeof raw.nlpSummary === 'string'
        ? raw.nlpSummary
        : typeof raw.insight === 'string'
          ? raw.insight
          : typeof raw.explanation === 'string'
            ? raw.explanation
            : summary,
  };
};

const sortSignals = (signals: Signal[], sortBy: SignalFilters['sortBy'], sortOrder: SignalFilters['sortOrder']) => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  const key = sortBy ?? 'updatedAt';

  return [...signals].sort((left, right) => {
    if (key === 'pair') {
      return left.pair.localeCompare(right.pair) * direction;
    }
    if (key === 'price') {
      return (left.price - right.price) * direction;
    }
    if (key === 'score') {
      return (left.score - right.score) * direction;
    }
    return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction;
  });
};

const fetchSymbolUniverse = async () => {
  const { data } = await httpClient.get<unknown>('/api/market/symbols');
  const payload = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const symbols = Array.isArray(payload.symbols) ? payload.symbols : [];
  return symbols
    .map((value) => normalizeSymbol(value))
    .filter((value, index, array) => value.endsWith('USDT') && array.indexOf(value) === index);
};

export const fetchSignals = async (filters: SignalFilters = {}): Promise<SignalListResponse> => {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 8;
  const search = filters.search?.trim().toUpperCase() ?? '';
  const allSymbols = await fetchSymbolUniverse();
  const filteredSymbols = allSymbols.filter((symbol) => {
    if (!search) {
      return true;
    }
    const pair = normalizePair(symbol);
    return symbol.includes(search) || pair.includes(search);
  });

  const startIndex = Math.max(0, (page - 1) * pageSize);
  const pageSymbols = filteredSymbols.slice(startIndex, startIndex + pageSize);
  if (!pageSymbols.length) {
    return {
      items: [],
      total: filteredSymbols.length,
      page,
      pageSize,
      hasMore: false,
    };
  }

  const timeframe = filters.timeframe && filters.timeframe !== 'all' ? filters.timeframe : '1h';
  const { data } = await httpClient.get<unknown>('/api/signals', {
    params: {
      symbols: pageSymbols.join(','),
      timeframe,
    },
  });

  const payload = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const source = Array.isArray(payload.items) ? payload.items : [];
  const items = sortSignals(
    source
      .map((item) => normalizeSignal(item))
      .filter((signal) => !filters.edge || filters.edge === 'all' || signal.edge === filters.edge),
    filters.sortBy,
    filters.sortOrder
  );

  return {
    items,
    total: filteredSymbols.length,
    page,
    pageSize,
    hasMore: startIndex + pageSize < filteredSymbols.length,
  };
};

export const fetchSignalById = async (id: string, timeframe: Timeframe = '1h'): Promise<Signal> => {
  const symbol = normalizeSymbol(decodeURIComponent(id));
  const { data } = await httpClient.get<unknown>(`/api/signals/${symbol}`, {
    params: { timeframe },
  });
  return normalizeSignal(data);
};

export const fetchSignalCandles = async (pair: string, timeframe: Timeframe): Promise<SignalCandle[]> => {
  const symbol = normalizeSymbol(pair);
  const { data } = await httpClient.get<unknown>(`/api/prices/${symbol}`, {
    params: {
      interval: timeframe,
      limit: 60,
    },
  });

  const payload = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const source = Array.isArray(payload.ohlcv)
    ? payload.ohlcv
    : Array.isArray(payload.candles)
      ? payload.candles
      : Array.isArray(data)
        ? data
        : [];

  return source
    .map((item) => {
      if (Array.isArray(item)) {
        const [time, open, high, low, close] = item;
        return {
          time: typeof time === 'number' ? new Date(time).toISOString() : String(time),
          open: toNumber(open),
          high: toNumber(high),
          low: toNumber(low),
          close: toNumber(close),
        } satisfies SignalCandle;
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      return {
        time: typeof record.time === 'string' ? record.time : new Date(toNumber(record.time, Date.now())).toISOString(),
        open: toNumber(record.open),
        high: toNumber(record.high),
        low: toNumber(record.low),
        close: toNumber(record.close),
      } satisfies SignalCandle;
    })
    .filter((item): item is SignalCandle => Boolean(item));
};

export const fetchBotSettings = async (): Promise<BotSettings> => {
  const { data } = await httpClient.get<BotSettings>('/api/bot/settings');
  return data;
};

export const updateBotSettings = async (
  settings: Partial<BotSettings> & { api_key?: string; api_secret?: string }
): Promise<BotSettings> => {
  const { data } = await httpClient.put<BotSettings>('/api/bot/settings', settings);
  return data;
};

export const testBinanceConnection = async (
  apiKey: string,
  apiSecret: string
): Promise<{ success: boolean; balance?: string; error?: string }> => {
  const { data } = await httpClient.post<{ success: boolean; balance?: string; error?: string }>('/api/bot/test-connection', {
    api_key: apiKey,
    api_secret: apiSecret,
  });
  return data;
};

export const toggleBot = async (active: boolean): Promise<{ active: boolean }> => {
  const { data } = await httpClient.post<{ active: boolean }>('/api/bot/toggle', { active });
  return data;
};

export const fetchBotOrders = async (
  page = 1,
  filters: { status?: string; pair?: string; limit?: number } = {}
): Promise<BotOrdersResponse> => {
  const { data } = await httpClient.get<BotOrdersResponse>('/api/bot/orders', {
    params: {
      page,
      limit: filters.limit ?? 50,
      status: filters.status || undefined,
      pair: filters.pair?.trim() || undefined,
    },
  });
  return {
    items: Array.isArray(data.items) ? data.items : [],
    page: data.page ?? page,
    limit: data.limit ?? (filters.limit ?? 50),
    total: data.total ?? 0,
  };
};

export const cancelBotOrder = async (id: string): Promise<void> => {
  await httpClient.delete(`/api/bot/orders/${id}`);
};

export type { BotOrder, BotOrdersResponse, BotSettings };
