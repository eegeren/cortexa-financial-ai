import { create } from 'zustand';
import {
  fetchBillingProfile,
  fetchInvoices,
  fetchPlans,
  fetchPortalUrl,
  fetchSubscription,
  SubscriptionWithAccess,
  BillingProfile,
  InvoiceSummary,
  PlanSummary,
} from '@/services/api';

interface SubscriptionState {
  loading: boolean;
  error: string | null;
  data: SubscriptionWithAccess['subscription'] | null;
  access: SubscriptionWithAccess['access'] | null;
  invoices: InvoiceSummary[];
  plans: PlanSummary[];
  profile: BillingProfile | null;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
  loadPlans: () => Promise<PlanSummary[]>;
  loadInvoices: () => Promise<InvoiceSummary[]>;
  loadProfile: () => Promise<BillingProfile>;
  getPortalUrl: () => Promise<string>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  loading: false,
  error: null,
  data: null,
  access: null,
  invoices: [],
  plans: [],
  profile: null,
  hydrate: async () => {
    if (get().loading) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const payload = await fetchSubscription();
      set({
        data: payload.subscription ?? null,
        access: payload.access ?? null,
        loading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Subscription fetch failed';
      set({ error: message, loading: false });
    }
  },
  refresh: async () => {
    try {
      const payload = await fetchSubscription();
      set({
        data: payload.subscription ?? null,
        access: payload.access ?? null,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Subscription fetch failed';
      set({ error: message });
      throw error;
    }
  },
  clear: () => set({ data: null, access: null, invoices: [], profile: null, error: null, loading: false }),
  loadPlans: async () => {
    const plans = await fetchPlans();
    set({ plans });
    return plans;
  },
  loadInvoices: async () => {
    const invoices = await fetchInvoices();
    set({ invoices });
    return invoices;
  },
  loadProfile: async () => {
    const profile = await fetchBillingProfile();
    set({ profile });
    return profile;
  },
  getPortalUrl: async () => {
    const url = await fetchPortalUrl();
    return url;
  },
}));
