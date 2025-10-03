import http, { setAuthHeader } from './httpClient';
import { sendChat as sendChatRequest } from '@/lib/api';

export interface SignalResponse {
  symbol: string;
  side: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  confidence?: number;
  horizon?: string;
  suggested_allocation?: string;
  entry_price?: number;
  take_profit?: number;
  stop_loss?: number;
  price?: number;
  rsi?: number;
  atr?: number;
  ema_fast?: number;
  ema_slow?: number;
  atr_pct?: number;
  adx?: number;
  sl?: number;
  tp?: number;
  mtf?: {
    votes: Record<string, number>;
    filters: Record<string, boolean>;
  };
}

export interface Trade {
  id: number;
  user_id: number;
  symbol: string;
  side: string;
  qty: number;
  price: number;
  created_at?: string;
}

export interface PortfolioAutomation {
  active_bots?: number;
  scheduled_runs?: number;
  status?: string;
}

export interface PortfolioResponse {
  user_id: number;
  trades: Trade[];
  total_value?: number;
  automation?: PortfolioAutomation | null;
  alerts?: Array<Record<string, unknown>> | null;
  assistant_threads?: number;
  webhooks?: Array<Record<string, unknown>> | null;
}

export interface HealthResponse {
  status: string;
}

export interface PriceResponse {
  symbol: string;
  interval: string;
  limit: number;
  fetchedAt: string;
  ohlcv: Array<[number, string, string, string, string, string]>;
}

export interface BacktestHistoryRow {
  time: string;
  side: string;
  score: number;
  fwd_return: number;
  gross_return?: number;
  net_return?: number;
  gross_value?: number;
  net_value?: number;
}

export interface BacktestSideBreakdown {
  trades: number;
  net_return_sum: number;
  hit_rate: number;
  avg_return: number;
  avg_score: number;
}

export interface BacktestWeekdayBreakdownRow {
  day: string;
  trades: number;
  net_return_sum: number;
  hit_rate: number;
  avg_return: number;
}

export interface BacktestStreaks {
  longest_win: number;
  longest_loss: number;
}

export interface BacktestExposure {
  bars: number;
  minutes: number;
  hours: number;
  days: number;
  ratio: number;
}

export interface BacktestResponse {
  symbol: string;
  threshold: number;
  limit: number;
  horizon: number;
  commission_bps: number;
  slippage_bps: number;
  position_size: number;
  trades: number;
  gross_value_sum?: number;
  net_value_sum?: number;
  gross_return_sum?: number;
  net_return_sum?: number;
  hit_rate: number;
  cost_return?: number;
  history: BacktestHistoryRow[];
  equity_curve?: Array<{ time: string; net_value: number }>;
  regime_metrics?: Array<{
    vol_regime: string;
    trend_regime: string;
    trades: number;
    net_return_sum: number;
    hit_rate: number;
  }>;
  sharpe?: number;
  sortino?: number;
  max_drawdown?: number;
  avg_win?: number;
  avg_loss?: number;
  expectancy?: number;
  profit_factor?: number;
  win_loss_ratio?: number;
  median_return?: number;
  return_std?: number;
  return_quantiles?: Record<string, number>;
  side_breakdown?: {
    buy: BacktestSideBreakdown;
    sell: BacktestSideBreakdown;
  };
  weekday_breakdown?: BacktestWeekdayBreakdownRow[];
  streaks?: BacktestStreaks;
  exposure?: BacktestExposure;
  score_buckets?: Array<{
    bucket: string;
    trades: number;
    net_return_avg: number;
    hit_rate: number;
  }>;
}

export interface BacktestSweepResponse {
  symbol: string;
  thresholds: number[];
  horizons: number[];
  limit: number;
  commission_bps: number;
  slippage_bps: number;
  position_size: number;
  results: BacktestResponse[];
}

export interface AdminUserSummary {
  id: number;
  email: string;
  role: string;
  plan: string;
  monthly_fee: number;
  status: string;
  seats: string;
  total_trades: number;
  volume: number;
  last_trade_at?: string | null;
  created_at: string;
  next_renewal: string;
}

export type ChatMessagePayload = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface ChatResponse {
  ok: boolean;
  reply: string;
  status: string;
  reason?: string;
}

export interface PlanSummary {
  id: number;
  code: string;
  name: string;
  description: string;
  amount_cents: number;
  currency: string;
  billing_interval: string;
  features: string[];
}

export interface CheckoutSession {
  session_id: string;
  checkout_url: string;
  provider: string;
}

export interface SubscriptionWithAccess {
  subscription: {
    id: number;
    user_id: number;
    plan_id: number;
    status: string;
    trial_ends_at?: string | null;
    current_period_start?: string | null;
    current_period_end?: string | null;
    provider_customer_id: string;
    provider_subscription_id: string;
    cancel_at_period_end: boolean;
    created_at: string;
    updated_at: string;
    plan_code: string;
    plan_name: string;
  } | null;
  access: {
    can_access: boolean;
    trial_days_remaining: number;
    status: string;
    plan: string;
    provider_subscription_id: string;
    reason?: string;
  };
}

export interface BillingProfile {
  id?: number;
  user_id?: number;
  country: string;
  vat_id: string;
  company_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
}

export interface InvoiceSummary {
  id: number;
  subscription_id: number;
  provider_invoice_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  hosted_invoice_url: string;
  pdf_url: string;
  tax_amount_cents: number;
  created_at: string;
  issued_at?: string | null;
  due_at?: string | null;
}

export const setAuthToken = setAuthHeader;

export const fetchSignal = async (symbol: string) => {
  const { data } = await http.get<SignalResponse>(`/api/signals/${symbol}`);
  return data;
};

export const triggerAutoTrade = async (symbol: string, threshold: number, qty: number) => {
  const { data } = await http.post(`/api/signals/${symbol}/auto-trade`, undefined, {
    params: { threshold, qty },
  });
  return data as { executed: boolean; note?: string; reason?: string; score: number };
};

export const fetchPortfolio = async () => {
  const { data } = await http.get<PortfolioResponse>('/api/portfolio');
  return data;
};

export const createTrade = async (payload: { symbol: string; side: 'BUY' | 'SELL'; qty: number; price: number }) => {
  const { data } = await http.post('/api/portfolio/trade', payload);
  return data as { message: string };
};

export const fetchAdminUsers = async () => {
  const { data } = await http.get<AdminUserSummary[]>('/admin/users');
  return data;
};

export const updateUserRole = async (id: number, role: string) => {
  const { data } = await http.patch(`/admin/users/${id}/role`, { role });
  return data as { id: number; role: string };
};

export const fetchHealth = async () => {
  const { data } = await http.get<HealthResponse>('/health');
  return data;
};

export const fetchHealthz = async () => {
  const { data } = await http.get<HealthResponse>('/healthz');
  return data;
};

export const fetchLatestPrice = async (symbol: string, interval = '1h') => {
  const { data } = await http.get<PriceResponse>(`/api/prices/${symbol}`, {
    params: { interval, limit: 1 },
  });
  const latest = data.ohlcv.length ? data.ohlcv[data.ohlcv.length - 1] : undefined;
  if (!latest) {
    return { symbol, price: null, time: null };
  }
  const [timestamp, , , , close] = latest;
  return {
    symbol,
    price: Number(close),
    time: typeof timestamp === 'number' ? new Date(timestamp) : null,
    interval: data.interval,
  };
};

export const fetchBacktest = async (
  symbol: string,
  params: {
    threshold?: number;
    limit?: number;
    horizon?: number;
    commission_bps?: number;
    slippage_bps?: number;
    position_size?: number;
  } = {}
) => {
  const {
    threshold = 0.6,
    limit = 400,
    horizon = 4,
    commission_bps = 4,
    slippage_bps = 1,
    position_size = 1,
  } = params;
  const { data } = await http.get<BacktestResponse>(`/api/signals/${symbol}/backtest`, {
    params: { threshold, limit, horizon, commission_bps, slippage_bps, position_size },
  });
  return data;
};

export const fetchBacktestSweep = async (
  symbol: string,
  params: {
    thresholds?: number[];
    horizons?: number[];
    limit?: number;
    commission_bps?: number;
    slippage_bps?: number;
    position_size?: number;
  } = {}
) => {
  const {
    thresholds,
    horizons,
    limit = 400,
    commission_bps = 4,
    slippage_bps = 1,
    position_size = 1,
  } = params;
  const query: Record<string, string | number> = {
    limit,
    commission_bps,
    slippage_bps,
    position_size,
  };
  if (thresholds && thresholds.length) {
    query.thresholds = thresholds.join(',');
  }
  if (horizons && horizons.length) {
    query.horizons = horizons.join(',');
  }
  const { data } = await http.get<BacktestSweepResponse>(`/api/signals/${symbol}/backtest/sweep`, {
    params: query,
  });
  return data;
};

export const sendChat = async (messages: ChatMessagePayload[], model?: string) => {
  return sendChatRequest<ChatResponse>({ messages, model });
};

export const fetchPlans = async () => {
  const { data } = await http.get<{ plans: PlanSummary[] }>('/api/billing/plans');
  return data.plans;
};

export const createCheckoutSession = async (payload: {
  plan_code: string;
  success_url?: string;
  cancel_url?: string;
}) => {
  const { data } = await http.post<CheckoutSession>('/api/billing/checkout', payload);
  return data;
};

export const fetchSubscription = async () => {
  const { data } = await http.get<SubscriptionWithAccess>('/api/billing/subscription');
  return data;
};

export const fetchPortalUrl = async () => {
  const { data } = await http.get<{ portal_url: string }>('/api/billing/portal');
  return data.portal_url;
};

export const fetchInvoices = async () => {
  const { data } = await http.get<{ invoices: InvoiceSummary[] }>('/api/billing/invoices');
  return data.invoices;
};

export const fetchBillingProfile = async () => {
  const { data } = await http.get<BillingProfile>('/api/billing/profile');
  return data;
};

export const updateBillingProfile = async (profile: BillingProfile) => {
  const { data } = await http.put<{ status: string }>('/api/billing/profile', profile);
  return data.status === 'updated';
};

export default http;
