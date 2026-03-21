import type { BacktestResponse, ChatMessagePayload, ChatResponse, SignalResponse } from '@/services/api';
import {
  fetchBacktest as fetchBacktestFromServices,
  fetchSignal as fetchSignalFromServices,
  sendChat as sendChatFromServices,
  triggerAutoTrade as triggerAutoTradeFromServices,
} from '@/services/api';

// Deprecated compatibility wrappers. Protected API calls must flow through
// services/api.ts so they inherit the shared axios base URL and Bearer auth.
export const fetchSignal = async <T = SignalResponse>(symbol: string) => {
  return (await fetchSignalFromServices(symbol)) as T;
};

export const triggerAutoTrade = async <T = { executed: boolean; note?: string; reason?: string; score: number }>(
  symbol: string,
  params: { threshold: number; qty: number }
) => {
  return (await triggerAutoTradeFromServices(symbol, params.threshold, params.qty)) as T;
};

export const fetchBacktest = async <T = BacktestResponse>(
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
  return (await fetchBacktestFromServices(symbol, params)) as T;
};

export const sendChat = async <T = ChatResponse>(payload: { messages: ChatMessagePayload[]; model?: string }) => {
  return (await sendChatFromServices(payload)) as T;
};
