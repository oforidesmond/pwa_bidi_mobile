import axios from 'axios';
import { storage } from '@/lib/storage';

let __reqId = 0;

const __rawBaseURL = (import.meta.env.VITE_API_URL ?? '').trim();
/** Empty string → same-origin (Vite proxy in dev). Absolute URL for production/remote. */
const __baseURL = __rawBaseURL
  ? __rawBaseURL.startsWith('http://') || __rawBaseURL.startsWith('https://')
    ? __rawBaseURL
    : `http://${__rawBaseURL}`
  : '';

const api = axios.create({
  baseURL: __baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type UnauthorizedHandler = () => void | Promise<void>;
let onUnauthorized: UnauthorizedHandler | null = null;
let handlingUnauthorized = false;

/** Register a callback invoked once per 401 (e.g. clear AuthContext + redirect). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

async function clearStoredAuth() {
  try {
    await storage.multiRemove(['access_token', 'user']);
  } catch {
    // ignore storage errors
  }
  delete api.defaults.headers.common.Authorization;
  delete (api.defaults.headers as Record<string, unknown>).Authorization;
}

api.interceptors.request.use(async (config) => {
  const token = await storage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  (config as { __reqId?: number; __startedAt?: number }).__reqId = ++__reqId;
  (config as { __reqId?: number; __startedAt?: number }).__startedAt = Date.now();

  return config;
});

api.interceptors.response.use(
  (res) => {
    const cfg = res.config as { __reqId?: number; __startedAt?: number; method?: string; baseURL?: string; url?: string; params?: unknown; data?: unknown };
    const duration = cfg.__startedAt ? Date.now() - cfg.__startedAt : undefined;

    console.log('✅ API success', {
      id: cfg.__reqId,
      method: cfg.method?.toUpperCase(),
      url: (cfg.baseURL || '') + (cfg.url || ''),
      params: cfg.params,
      data: cfg.data,
      status: res.status,
      responseData: res.data,
      durationMs: duration,
    });

    return res;
  },
  async (error) => {
    const cfg = (error?.config || {}) as {
      __reqId?: number;
      __startedAt?: number;
      method?: string;
      baseURL?: string;
      url?: string;
      params?: unknown;
      data?: unknown;
    };
    const resp = error?.response;
    const duration = cfg.__startedAt ? Date.now() - cfg.__startedAt : undefined;

    console.log('❌ API error', {
      id: cfg.__reqId,
      method: cfg.method?.toUpperCase(),
      url: (cfg.baseURL || '') + (cfg.url || ''),
      params: cfg.params,
      data: cfg.data,
      status: resp?.status,
      statusText: resp?.statusText,
      responseData: resp?.data,
      durationMs: duration,
    });

    if (resp?.status === 401 && !handlingUnauthorized) {
      handlingUnauthorized = true;
      try {
        await clearStoredAuth();
        if (onUnauthorized) await onUnauthorized();
      } finally {
        handlingUnauthorized = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
