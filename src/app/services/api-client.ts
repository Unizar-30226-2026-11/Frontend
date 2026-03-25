import { Injectable } from '@angular/core';
import { ApiErrorPayload, ApiMethod, ApiRequestOptions } from '../interfaces/api';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class ApiClient {
  readonly baseUrl = '/api';

  private readonly defaultTtlMs = 60_000;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const useCache = method === 'GET' && options.useCache !== false;
    const cacheKey = options.cacheKey ?? this.buildCacheKey(path, method, options.token);
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;

    if (useCache && !options.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return Promise.resolve(cached.data as T);
      }

      const pending = this.inFlight.get(cacheKey);
      if (pending) {
        return pending as Promise<T>;
      }
    }

    const requestPromise = this.fetchJson<T>(path, {
      ...options,
      method,
    })
      .then((data) => {
        if (useCache) {
          this.cache.set(cacheKey, {
            data,
            expiresAt: Date.now() + ttlMs,
          });
        }

        return data;
      })
      .finally(() => {
        if (useCache) {
          this.inFlight.delete(cacheKey);
        }
      });

    if (useCache) {
      this.inFlight.set(cacheKey, requestPromise);
    }

    return requestPromise;
  }

  setCache<T>(cacheKey: string, data: T, ttlMs = this.defaultTtlMs): void {
    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  buildCacheKey(path: string, method: ApiMethod = 'GET', token: string | null = null): string {
    const cacheScope = token?.trim() ? token : 'anonymous';
    return `${method}:${path}:${cacheScope}`;
  }

  invalidateCache(match?: string): void {
    if (!match) {
      this.cache.clear();
      this.inFlight.clear();
      return;
    }

    for (const key of [...this.cache.keys()]) {
      if (key.includes(match)) {
        this.cache.delete(key);
      }
    }

    for (const key of [...this.inFlight.keys()]) {
      if (key.includes(match)) {
        this.inFlight.delete(key);
      }
    }
  }

  private async fetchJson<T>(
    path: string,
    options: Required<Pick<ApiRequestOptions, 'method'>> & ApiRequestOptions
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });

    const rawBody = await response.text();
    const parsedBody = rawBody ? this.parseBody(rawBody) : null;

    if (!response.ok) {
      throw new Error(this.resolveErrorMessage(parsedBody));
    }

    return parsedBody as T;
  }

  private parseBody(rawBody: string): unknown {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return rawBody;
    }
  }

  private resolveErrorMessage(parsedBody: unknown): string {
    if (typeof parsedBody === 'object' && parsedBody !== null && 'message' in parsedBody) {
      const candidate = parsedBody as ApiErrorPayload;
      if (typeof candidate.message === 'string' && candidate.message.trim().length > 0) {
        return candidate.message;
      }
    }

    return 'La API devolvio un error inesperado';
  }
}
