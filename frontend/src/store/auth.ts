import { create } from 'zustand';
import { setAuthToken } from '@/services/api';

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
    const token = window.localStorage.getItem(TOKEN_KEY);
    const email = window.localStorage.getItem(EMAIL_KEY);
    setAuthToken(token);
    set({ token, email, role: decodeRole(token), hydrated: true });
  },
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'https://cortexa-financial-ai.onrender.com'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Login failed');
      }
      const data: { token: string } = await res.json();
      window.localStorage.setItem(TOKEN_KEY, data.token);
      window.localStorage.setItem(EMAIL_KEY, email);
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
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'https://cortexa-financial-ai.onrender.com'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone,
          kvkk_accepted: kvkkAccepted
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Registration failed');
      }
      set({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      set({ error: message, loading: false });
      throw error;
    }
  },
  logout: () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(EMAIL_KEY);
    setAuthToken(null);
    set({ token: null, email: null, role: null });
  },
  clearError: () => set({ error: null })
}));
