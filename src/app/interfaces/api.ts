export interface ApiErrorPayload {
  message: string;
  required?: number;
  currentBalance?: number;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function isApiRequestErrorStatus(error: unknown, status: number): error is ApiRequestError {
  return error instanceof ApiRequestError && error.status === status;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: ApiMethod;
  token?: string | null;
  body?: unknown;
  forceRefresh?: boolean;
  ttlMs?: number;
  timeoutMs?: number;
  cacheKey?: string;
  useCache?: boolean;
  credentials?: RequestCredentials;
}
