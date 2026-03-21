const BASE = (import.meta.env.VITE_API_URL ?? '').trim();

if (!BASE) {
  throw new Error('VITE_API_URL tanımlı değil; frontend isteği yapılamıyor');
}

const ensureTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`);

const withBase = (path: string) => {
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  return new URL(trimmed, ensureTrailingSlash(BASE)).toString();
};

const request = async <T>(path: string | URL, init: RequestInit = {}) => {
  const signal = init.signal ?? AbortSignal.timeout(10000);
  let response: Response;
  const target = path instanceof URL ? path.toString() : withBase(path);

  try {
    response = await fetch(target, { ...init, signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'İstek başlatılamadı';
    throw new Error(message);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Endpoint bulunamadı: API base veya route yanlış');
    }
    if (response.status === 502) {
      throw new Error('Upstream 502: Backend uykuda/kapalı');
    }
    const fallback = `İstek ${response.status} ile başarısız`;
    const detail = await response.text().catch(() => fallback);
    throw new Error(detail || fallback);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const fetchSignal = async <T>(symbol: string) => {
  return request<T>(`/signals/${encodeURIComponent(symbol)}`);
};

export const triggerAutoTrade = async <T>(symbol: string, params: { threshold: number; qty: number }) => {
  const url = new URL(`signals/${encodeURIComponent(symbol)}/auto-trade`, ensureTrailingSlash(BASE));
  url.searchParams.set('threshold', params.threshold.toString());
  url.searchParams.set('qty', params.qty.toString());
  return request<T>(url, { method: 'POST' });
};

export const fetchBacktest = async <T>(
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
  const url = new URL(`signals/${encodeURIComponent(symbol)}/backtest`, ensureTrailingSlash(BASE));
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  return request<T>(url);
};

export const sendChat = async <T>(payload: { messages: Array<{ role: string; content: string }>; model?: string }) => {
  return request<T>('/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};
