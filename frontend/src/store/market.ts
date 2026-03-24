import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type MarketState = {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
};

const storage = typeof window !== 'undefined' ? createJSONStorage(() => window.localStorage) : undefined;

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      selectedSymbol: 'BTCUSDT',
      setSelectedSymbol: (symbol: string) => set({ selectedSymbol: symbol.trim().toUpperCase() || 'BTCUSDT' }),
    }),
    {
      name: 'cortexa-market',
      storage,
      partialize: (state) => ({ selectedSymbol: state.selectedSymbol }),
    }
  )
);
