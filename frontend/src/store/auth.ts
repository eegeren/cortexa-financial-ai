import { create } from 'zustand';
import api, { setAuthToken } from '@/services/api';

type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  kvkkAccepted: boolean;
};

type AuthState = {
  token: string | null;
  email: string | null;
  role: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  clearError: () => void;
};

const TOKEN_KEY = 'cortexa.token';
const EMAIL_KEY = 'cortexa.email';

const decodeRole = (token: string | null): string | null => {
  if (!token || typeof window === 'undefined' || typeof window.atob !== 'function') {
    return null;
  }
  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized.padEnd(normalized.length + padLength, '=');
  try {
    const json = window.atob(padded);
    const data = JSON.parse(json) as { role?: unknown };
    return typeof data.role === 'string' ? data.role : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  email: null,
  role: null,
  hydrated: false,
  loading: false,
  error: null,
  hydrate: () => {
    if (get().hydrated) {
      return;
    }
    if (typeof window === 'undefined') {
      set({ hydrated: true });
      return;
    }
    const token = window.localStorage.getItem(TOKEN_KEY);
    const email = window.localStorage.getItem(EMAIL_KEY);
    setAuthToken(token);
    set({ token, email, role: decodeRole(token), hydrated: true });
  },
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post<{ token: string }>('/auth/login', { email, password });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOKEN_KEY, data.token);
        window.localStorage.setItem(EMAIL_KEY, email);
      }
      setAuthToken(data.token);
      set({ token: data.token, email, role: decodeRole(data.token), loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      set({ error: message, loading: false });
      throw error;
    }
  },
  register: async ({ email, password, firstName, lastName, phone, kvkkAccepted }) => {
    set({ loading: true, error: null });
    try {
      await api.post('/auth/register', {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
        kvkk_accepted: kvkkAccepted,
      });
      set({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      set({ error: message, loading: false });
      throw error;
    }
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(EMAIL_KEY);
    }
    setAuthToken(null);
    set({ token: null, email: null, role: null });
  },
  clearError: () => set({ error: null })
}));
