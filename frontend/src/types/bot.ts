export interface BotSettings {
  user_id: number;
  active: boolean;
  pairs_whitelist: string[];
  all_pairs: boolean;
  min_confidence: number;
  max_position_pct: number;
  daily_loss_limit_pct: number;
  trade_type: 'spot' | 'futures';
  has_binance_api_key: boolean;
  binance_api_key_masked?: string;
  updated_at?: string;
}

export interface BotOrder {
  id: string;
  user_id: number;
  signal_id: string;
  pair: string;
  timeframe?: string;
  side: 'long' | 'short' | string;
  quantity: number;
  entry_price: number;
  sl_price: number;
  tp_price: number;
  status: 'pending' | 'filled' | 'cancelled' | 'failed' | string;
  error_message?: string;
  exchange_order_id?: string;
  created_at: string;
  filled_price?: number | null;
}

export interface BotOrdersResponse {
  items: BotOrder[];
  page: number;
  limit: number;
  total: number;
}
