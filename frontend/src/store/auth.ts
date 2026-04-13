import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { isAxiosError } from 'axios';
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
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => void;
  setHydrated: (value: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  clearError: () => void;
};

const TOKEN_KEY = 'cortexa.token';
const EMAIL_KEY = 'cortexa.email';
const FIRST_NAME_KEY = 'cortexa.first_name';
const LAST_NAME_KEY = 'cortexa.last_name';
const PERSIST_KEY = 'cortexa-auth';
const storage = typeof window !== 'undefined' ? createJSONStorage(() => window.localStorage) : undefined;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    const detail = error.response?.data;
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }
    if (detail && typeof detail === 'object') {
      const message =
        ('message' in detail && typeof detail.message === 'string' && detail.message) ||
        ('error' in detail && typeof detail.error === 'string' && detail.error) ||
        ('detail' in detail && typeof detail.detail === 'string' && detail.detail);
      if (message) {
        return message;
      }
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      email: null,
      firstName: null,
      lastName: null,
      role: null,
      hydrated: false,
      loading: false,
      error: null,
      setHydrated: (value: boolean) => set({ hydrated: value }),
      hydrate: () => {
        if (get().hydrated) {
          return;
        }
        try {
          const stateToken = get().token;
          const stateEmail = get().email;
          const stateFirstName = get().firstName;
          const stateLastName = get().lastName;
          if (stateToken) {
            setAuthToken(stateToken);
            set({ role: decodeRole(stateToken), firstName: stateFirstName, lastName: stateLastName });
            return;
          }
          if (typeof window !== 'undefined') {
            const fallbackToken = window.localStorage.getItem(TOKEN_KEY);
            const fallbackEmail = window.localStorage.getItem(EMAIL_KEY);
            const fallbackFirstName = window.localStorage.getItem(FIRST_NAME_KEY);
            const fallbackLastName = window.localStorage.getItem(LAST_NAME_KEY);
            if (fallbackToken) {
              setAuthToken(fallbackToken);
            }
            set({
              token: fallbackToken,
              email: fallbackEmail,
              firstName: fallbackFirstName,
              lastName: fallbackLastName,
              role: decodeRole(fallbackToken),
            });
          }
        } finally {
          set({ hydrated: true });
        }
      },
      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const loginPayload = {
            email: email.trim(),
            password,
          };
          const { data } = await api.post<{ token: string; email?: string; first_name?: string; last_name?: string }>('/auth/login', loginPayload);
          if (!data?.token || typeof data.token !== 'string') {
            throw new Error('Login response did not include a token.');
          }
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(TOKEN_KEY, data.token);
            window.localStorage.setItem(EMAIL_KEY, data.email ?? loginPayload.email);
            window.localStorage.setItem(FIRST_NAME_KEY, data.first_name ?? '');
            window.localStorage.setItem(LAST_NAME_KEY, data.last_name ?? '');
          }
          setAuthToken(data.token);
          set({
            token: data.token,
            email: data.email ?? loginPayload.email,
            firstName: data.first_name ?? null,
            lastName: data.last_name ?? null,
            role: decodeRole(data.token),
            loading: false,
          });
        } catch (error) {
          const message = getErrorMessage(error, 'Login failed');
          set({ error: message, loading: false });
          throw error;
        }
      },
      googleLogin: async (idToken: string) => {
        set({ loading: true, error: null });
        try {
          const { data } = await api.post<{ token: string; email?: string; first_name?: string; last_name?: string }>('/auth/google', { id_token: idToken });
          if (!data?.token || typeof data.token !== 'string') {
            throw new Error('Google login response did not include a token.');
          }
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(TOKEN_KEY, data.token);
            window.localStorage.setItem(EMAIL_KEY, data.email ?? '');
            window.localStorage.setItem(FIRST_NAME_KEY, data.first_name ?? '');
            window.localStorage.setItem(LAST_NAME_KEY, data.last_name ?? '');
          }
          setAuthToken(data.token);
          set({
            token: data.token,
            email: data.email ?? null,
            firstName: data.first_name ?? null,
            lastName: data.last_name ?? null,
            role: decodeRole(data.token),
            loading: false,
          });
        } catch (error) {
          const message = getErrorMessage(error, 'Google login failed');
          set({ error: message, loading: false });
          throw error;
        }
      },
      register: async ({ email, password, firstName, lastName, phone, kvkkAccepted }) => {
        set({ loading: true, error: null });
        try {
          const registerPayload = {
            email: email.trim(),
            password,
            first_name: firstName,
            last_name: lastName,
            phone: phone || undefined,
            kvkk_accepted: kvkkAccepted,
          };
          await api.post('/auth/register', registerPayload);
          set({ loading: false });
        } catch (error) {
          const message = getErrorMessage(error, 'Registration failed');
          set({ error: message, loading: false });
          throw error;
        }
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(EMAIL_KEY);
          window.localStorage.removeItem(FIRST_NAME_KEY);
          window.localStorage.removeItem(LAST_NAME_KEY);
          window.localStorage.removeItem(PERSIST_KEY);
        }
        setAuthToken(null);
        set({ token: null, email: null, firstName: null, lastName: null, role: null, error: null, loading: false, hydrated: true });
      },
      clearError: () => set({ error: null })
    }),
    {
      name: 'cortexa-auth',
      storage,
      partialize: (state) => ({ token: state.token, email: state.email, firstName: state.firstName, lastName: state.lastName }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setAuthToken(state.token);
        }
        state?.setHydrated(true);
      }
    }
  )
);
