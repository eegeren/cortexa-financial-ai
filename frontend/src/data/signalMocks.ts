import type { Signal, SignalCandle, SignalFilters, Timeframe } from '@/types/signal';

export const MOCK_SIGNALS: Signal[] = [
  {
    id: 'btc-usdt-1h',
    pair: 'BTC/USDT',
    timeframe: '1h',
    edge: 'long',
    regime: 'trending',
    score: 92,
    price: 68420,
    updatedAt: '2026-04-12T10:04:00.000Z',
    summary: 'Momentum remains constructive while price holds above intraday EMAs.',
    confidence: 89,
    change24h: 2.8,
    indicators: [
      { name: 'RSI', value: 61.4, bias: 'bull', note: 'Above neutral but not overheated.' },
      { name: 'MACD', value: 'Bullish cross', bias: 'bull', note: 'Histogram expanding.' },
      { name: 'ADX', value: 28.1, bias: 'bull', note: 'Trend strength is improving.' },
      { name: 'Volume', value: '1.34x', bias: 'bull', note: 'Participation supports continuation.' },
      { name: 'Funding', value: 'Balanced', bias: 'neutral', note: 'No crowded positioning signal.' },
    ],
    scoreBreakdown: {
      trend: 94,
      momentum: 90,
      regime: 87,
      volume: 88,
      risk: 73,
      total: 92,
    },
    supportResistance: [
      { label: 'S1', value: 67180, type: 'support', distancePct: -1.8 },
      { label: 'S2', value: 66440, type: 'support', distancePct: -2.9 },
      { label: 'R1', value: 68990, type: 'resistance', distancePct: 0.8 },
      { label: 'R2', value: 70120, type: 'resistance', distancePct: 2.5 },
    ],
    nlpSummary:
      'BTC yapısı şu an alıcı lehine. Trend bozulmadan devam ederse kısa vadede yukarı yönlü denemeler daha olası görünüyor, ama 69k üstünde takip alımı zayıflarsa hareket sınırlı kalabilir.',
  },
  {
    id: 'eth-usdt-4h',
    pair: 'ETH/USDT',
    timeframe: '4h',
    edge: 'long',
    regime: 'range',
    score: 78,
    price: 3528,
    updatedAt: '2026-04-12T09:42:00.000Z',
    summary: 'Recovery bias is building, but higher timeframe range highs still matter.',
    confidence: 74,
    change24h: 1.6,
    indicators: [
      { name: 'RSI', value: 56.2, bias: 'bull', note: 'Gentle positive slope.' },
      { name: 'MACD', value: 'Neutral+', bias: 'neutral', note: 'Cross is early.' },
      { name: 'ADX', value: 19.6, bias: 'neutral', note: 'Trend strength still modest.' },
      { name: 'Volume', value: '1.08x', bias: 'neutral', note: 'Average participation.' },
      { name: 'Funding', value: 'Mild positive', bias: 'neutral', note: 'Manageable optimism.' },
    ],
    scoreBreakdown: {
      trend: 76,
      momentum: 79,
      regime: 68,
      volume: 72,
      risk: 65,
      total: 78,
    },
    supportResistance: [
      { label: 'S1', value: 3440, type: 'support', distancePct: -2.5 },
      { label: 'S2', value: 3388, type: 'support', distancePct: -4 },
      { label: 'R1', value: 3595, type: 'resistance', distancePct: 1.9 },
      { label: 'R2', value: 3678, type: 'resistance', distancePct: 4.3 },
    ],
    nlpSummary:
      'ETH toparlanıyor ama tam bir trend kırılımı henüz teyitli değil. 4 saatlik grafikte güçlü görünüm sürüyor, yine de range tepesine yakın bölgelerde hız kesme riski var.',
  },
  {
    id: 'sol-usdt-15m',
    pair: 'SOL/USDT',
    timeframe: '15m',
    edge: 'limited',
    regime: 'range',
    score: 61,
    price: 168.4,
    updatedAt: '2026-04-12T10:11:00.000Z',
    summary: 'Fast tape is active, but follow-through remains inconsistent.',
    confidence: 58,
    change24h: 0.7,
    indicators: [
      { name: 'RSI', value: 52.4, bias: 'neutral', note: 'Mid-range.' },
      { name: 'MACD', value: 'Flat', bias: 'neutral', note: 'Little expansion.' },
      { name: 'ADX', value: 15.2, bias: 'neutral', note: 'Weak directional strength.' },
      { name: 'Volume', value: '0.93x', bias: 'bear', note: 'Below average participation.' },
      { name: 'Funding', value: 'Cool', bias: 'neutral', note: 'Positioning is light.' },
    ],
    scoreBreakdown: {
      trend: 58,
      momentum: 62,
      regime: 55,
      volume: 49,
      risk: 57,
      total: 61,
    },
    supportResistance: [
      { label: 'S1', value: 165.9, type: 'support', distancePct: -1.5 },
      { label: 'S2', value: 163.2, type: 'support', distancePct: -3.1 },
      { label: 'R1', value: 170.6, type: 'resistance', distancePct: 1.3 },
      { label: 'R2', value: 173.1, type: 'resistance', distancePct: 2.8 },
    ],
    nlpSummary:
      'SOL tarafında hareket var ama kalite orta düzeyde. Kısa vadeli trade fırsatı oluşabilir, ancak net yön teyidi gelmeden agresif takip riskli olur.',
  },
  {
    id: 'xrp-usdt-1h',
    pair: 'XRP/USDT',
    timeframe: '1h',
    edge: 'short',
    regime: 'trending',
    score: 84,
    price: 0.91,
    updatedAt: '2026-04-12T09:26:00.000Z',
    summary: 'Lower highs and persistent supply pressure keep the short bias active.',
    confidence: 82,
    change24h: -2.1,
    indicators: [
      { name: 'RSI', value: 41.8, bias: 'bear', note: 'Momentum sits below neutral.' },
      { name: 'MACD', value: 'Bearish spread', bias: 'bear', note: 'Signal line widening.' },
      { name: 'ADX', value: 25.3, bias: 'bear', note: 'Downtrend has structure.' },
      { name: 'Volume', value: '1.21x', bias: 'bear', note: 'Sellers still engaged.' },
      { name: 'Funding', value: 'Flat', bias: 'neutral', note: 'Positioning not stretched.' },
    ],
    scoreBreakdown: {
      trend: 86,
      momentum: 81,
      regime: 79,
      volume: 77,
      risk: 70,
      total: 84,
    },
    supportResistance: [
      { label: 'S1', value: 0.894, type: 'support', distancePct: -1.8 },
      { label: 'S2', value: 0.879, type: 'support', distancePct: -3.4 },
      { label: 'R1', value: 0.927, type: 'resistance', distancePct: 1.9 },
      { label: 'R2', value: 0.944, type: 'resistance', distancePct: 3.7 },
    ],
    nlpSummary:
      'XRP tarafında satış baskısı halen baskın. Yapı bozulmadıkça tepki yükselişleri daha çok kısa vadeli rahatlama gibi duruyor.',
  },
  {
    id: 'bnb-usdt-4h',
    pair: 'BNB/USDT',
    timeframe: '4h',
    edge: 'none',
    regime: 'low',
    score: 49,
    price: 612.8,
    updatedAt: '2026-04-12T08:58:00.000Z',
    summary: 'Compression dominates, and neither side has enough conviction yet.',
    confidence: 47,
    change24h: 0.2,
    indicators: [
      { name: 'RSI', value: 49.1, bias: 'neutral', note: 'Exactly mid-band.' },
      { name: 'MACD', value: 'Flatline', bias: 'neutral', note: 'No signal separation.' },
      { name: 'ADX', value: 12.3, bias: 'neutral', note: 'Trend absent.' },
      { name: 'Volume', value: '0.74x', bias: 'bear', note: 'Thin participation.' },
      { name: 'Funding', value: 'Neutral', bias: 'neutral', note: 'No crowding.' },
    ],
    scoreBreakdown: {
      trend: 45,
      momentum: 48,
      regime: 43,
      volume: 39,
      risk: 69,
      total: 49,
    },
    supportResistance: [
      { label: 'S1', value: 603.4, type: 'support', distancePct: -1.5 },
      { label: 'S2', value: 596.9, type: 'support', distancePct: -2.6 },
      { label: 'R1', value: 619.8, type: 'resistance', distancePct: 1.1 },
      { label: 'R2', value: 627.6, type: 'resistance', distancePct: 2.4 },
    ],
    nlpSummary:
      'BNB şu an bekleme bölgesinde. Hacim düşük ve yön zayıf olduğu için net edge üretmek için biraz daha veri görmek daha sağlıklı.',
  },
  {
    id: 'doge-usdt-15m',
    pair: 'DOGE/USDT',
    timeframe: '15m',
    edge: 'short',
    regime: 'range',
    score: 67,
    price: 0.182,
    updatedAt: '2026-04-12T10:08:00.000Z',
    summary: 'Short-term exhaustion is visible near local resistance.',
    confidence: 63,
    change24h: -0.9,
    indicators: [
      { name: 'RSI', value: 46.9, bias: 'bear', note: 'Rolling over from neutral.' },
      { name: 'MACD', value: 'Bearish turn', bias: 'bear', note: 'Momentum easing.' },
      { name: 'ADX', value: 17.8, bias: 'neutral', note: 'Move still young.' },
      { name: 'Volume', value: '1.11x', bias: 'neutral', note: 'Normal activity.' },
      { name: 'Funding', value: 'Slightly positive', bias: 'bear', note: 'Some late longs visible.' },
    ],
    scoreBreakdown: {
      trend: 65,
      momentum: 71,
      regime: 58,
      volume: 61,
      risk: 56,
      total: 67,
    },
    supportResistance: [
      { label: 'S1', value: 0.179, type: 'support', distancePct: -1.7 },
      { label: 'S2', value: 0.176, type: 'support', distancePct: -3.3 },
      { label: 'R1', value: 0.184, type: 'resistance', distancePct: 1.1 },
      { label: 'R2', value: 0.187, type: 'resistance', distancePct: 2.7 },
    ],
    nlpSummary:
      'DOGE kısa vadede yorulmuş görünüyor. Hareket tamamen bitmiş değil ama yukarı denemelerin kalite skoru zayıfladığı için satış baskısı öne çıkıyor.',
  },
];

const timeframeToMs = (timeframe: Timeframe) => {
  if (timeframe === '15m') return 15 * 60 * 1000;
  if (timeframe === '4h') return 4 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
};

export const applyMockSignalFilters = (signals: Signal[], filters: SignalFilters = {}) => {
  const search = filters.search?.trim().toLowerCase() ?? '';

  const filtered = signals.filter((signal) => {
    const edgeMatch = !filters.edge || filters.edge === 'all' || signal.edge === filters.edge;
    const timeframeMatch = !filters.timeframe || filters.timeframe === 'all' || signal.timeframe === filters.timeframe;
    const searchMatch =
      search.length === 0 ||
      signal.pair.toLowerCase().includes(search) ||
      signal.summary.toLowerCase().includes(search);

    return edgeMatch && timeframeMatch && searchMatch;
  });

  const sortBy = filters.sortBy ?? 'updatedAt';
  const direction = filters.sortOrder === 'asc' ? 1 : -1;

  filtered.sort((left, right) => {
    const getComparable = (signal: Signal) => {
      if (sortBy === 'pair') return signal.pair;
      if (sortBy === 'price') return signal.price;
      if (sortBy === 'score') return signal.score;
      return new Date(signal.updatedAt).getTime();
    };

    const leftValue = getComparable(left);
    const rightValue = getComparable(right);

    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return leftValue.localeCompare(rightValue) * direction;
    }

    return ((Number(leftValue) || 0) - (Number(rightValue) || 0)) * direction;
  });

  return filtered;
};

export const getMockSignalById = (id: string) =>
  MOCK_SIGNALS.find((signal) => signal.id === id) ?? MOCK_SIGNALS[0];

export const buildMockCandles = (pair: string, timeframe: Timeframe): SignalCandle[] => {
  const baseSignal = MOCK_SIGNALS.find((signal) => signal.pair === pair) ?? MOCK_SIGNALS[0];
  const stepMs = timeframeToMs(timeframe);
  const points = 42;
  const base = baseSignal.price;
  const start = Date.now() - points * stepMs;

  return Array.from({ length: points }).map((_, index) => {
    const wave = Math.sin(index / 3.2) * base * 0.008;
    const drift = (index - points / 2) * base * 0.00055;
    const close = Number((base + wave + drift).toFixed(4));
    const open = Number((close - Math.cos(index / 2.4) * base * 0.0024).toFixed(4));
    const spread = Math.max(base * 0.0035, Math.abs(close - open) * 1.4);
    const high = Number((Math.max(open, close) + spread * 0.55).toFixed(4));
    const low = Number((Math.min(open, close) - spread * 0.45).toFixed(4));

    return {
      time: new Date(start + index * stepMs).toISOString(),
      open,
      high,
      low,
      close,
    };
  });
};
