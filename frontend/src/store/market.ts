import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SignalResponse } from '@/services/api';

type MarketState = {
  selectedSymbol: string;
  cachedSignals: Record<string, SignalResponse>;
  setSelectedSymbol: (symbol: string) => void;
  cacheSignal: (symbol: string, signal: SignalResponse) => void;
};

const storage = typeof window !== 'undefined' ? createJSONStorage(() => window.localStorage) : undefined;

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      selectedSymbol: 'BTCUSDT',
      cachedSignals: {},
      setSelectedSymbol: (symbol: string) => set({ selectedSymbol: symbol.trim().toUpperCase() || 'BTCUSDT' }),
      cacheSignal: (symbol: string, signal: SignalResponse) =>
        set((state) => ({
          cachedSignals: {
            ...state.cachedSignals,
            [symbol.trim().toUpperCase() || 'BTCUSDT']: signal,
          },
        })),
    }),
    {
      name: 'cortexa-market',
      storage,
      partialize: (state) => ({ selectedSymbol: state.selectedSymbol, cachedSignals: state.cachedSignals }),
    }
  )
);
