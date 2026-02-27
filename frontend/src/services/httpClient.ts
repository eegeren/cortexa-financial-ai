import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const resolveBaseURL = () => {
  const vite = import.meta.env.VITE_API_URL as string | undefined;
  const next = import.meta.env.NEXT_PUBLIC_API_URL as string | undefined;
  if (vite && vite.trim().length > 0) {
    return vite.trim();
  }
  if (next && next.trim().length > 0) {
    return next.trim();
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}`;
  }
  return '';
};

const apiBaseURL = resolveBaseURL();

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const client: AxiosInstance = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
});

let authToken: string | null = null;

export const setAuthHeader = (token: string | null) => {
  authToken = token;
};

client.interceptors.request.use((config) => {
  const nextConfig = config;
  if (!nextConfig.baseURL || nextConfig.baseURL.length === 0) {
    nextConfig.baseURL = apiBaseURL;
  }
  nextConfig.headers = nextConfig.headers ?? {};
  if (authToken) {
    nextConfig.headers.Authorization = `Bearer ${authToken}`;
  }
  nextConfig.headers['X-Client'] = 'cortexa-web';
  return nextConfig;
});

const RETRY_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    if (!config || config._retry) {
      throw error;
    }
    const status = error.response?.status;
    const shouldRetry = !status || RETRY_STATUS.has(status);
    if (!shouldRetry) {
      throw error;
    }
    config._retry = true;
    const delay = 400 + Math.random() * 600;
    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
    return client(config);
  }
);

export default client;
