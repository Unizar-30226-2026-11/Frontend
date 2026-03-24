export interface ApiErrorPayload {
  message: string;
  required?: number;
  currentBalance?: number;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: ApiMethod;
  token?: string | null;
  body?: unknown;
  forceRefresh?: boolean;
  ttlMs?: number;
  cacheKey?: string;
  useCache?: boolean;
}
