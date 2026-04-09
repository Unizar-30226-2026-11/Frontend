import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AuthSession,
  LoginPayload,
  LoginResponse,
  RefreshResponse,
  RegisterPayload,
  RegisterResponse,
} from '../interfaces/auth';
import { ApiClient } from './api-client';

const AUTH_STORAGE_KEY = 'ator.auth.session';
const REALTIME_SESSION_STORAGE_KEY = 'ator.dixit.realtime.session';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly apiClient = inject(ApiClient);
  private readonly sessionState = signal<AuthSession | null>(this.restoreSession());
  private readonly initializedState = signal(false);
  private refreshPromise: Promise<AuthSession | null> | null = null;

  readonly session = computed(() => this.sessionState());
  readonly isLoggedIn = computed(() => this.sessionState() !== null);
  readonly token = computed(() => this.sessionState()?.token ?? null);
  readonly username = computed(() => this.sessionState()?.user.username ?? '');
  readonly email = computed(() => this.sessionState()?.user.email ?? '');
  readonly activeGameId = computed(() => this.sessionState()?.activeGameId ?? null);
  readonly hasActiveGame = computed(() => !!this.activeGameId());
  readonly isInitialized = computed(() => this.initializedState());

  async register(email: string, username: string, password: string): Promise<RegisterResponse> {
    const payload: RegisterPayload = {
      email: email.trim(),
      username: username.trim(),
      password,
    };

    try {
      return await this.apiClient.request<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: payload,
        useCache: false,
      });
    } catch (error: unknown) {
      throw this.resolveRegisterError(error);
    }
  }

  async logIn(email: string, password: string): Promise<AuthSession> {
    const payload: LoginPayload = {
      email: email.trim(),
      password,
    };

    const response = await this.apiClient.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      useCache: false,
    });

    const session = this.buildSession(response, {
      email: payload.email,
      existingSession: null,
    });
    this.applySession(session);
    this.initializedState.set(true);
    return session;
  }

  async ensureInitialized(): Promise<AuthSession | null> {
    if (this.initializedState()) {
      return this.sessionState();
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const existingSession = this.sessionState();
    this.refreshPromise = this.apiClient
      .request<RefreshResponse>('/auth/refresh-session', {
        method: 'POST',
        token: existingSession?.token ?? null,
        credentials: 'include',
        useCache: false,
      })
      .then((response) => {
        const session = this.buildSession(response, { existingSession });
        this.applySession(session);
        return session;
      })
      .catch((error: unknown) => {
        console.warn(
          '[Auth] /auth/refresh no pudo completarse. Se mantiene la sesion local existente.',
          error
        );
        return existingSession;
      })
      .finally(() => {
        this.initializedState.set(true);
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  logOut(): void {
    this.clearSessionState();
    this.initializedState.set(true);
  }

  updateSessionUser(username: string): void {
    const currentSession = this.sessionState();
    if (!currentSession) {
      return;
    }

    const nextSession: AuthSession = {
      ...currentSession,
      user: {
        ...currentSession.user,
        username,
      },
    };

    this.applySession(nextSession);
  }

  setActiveGameId(activeGameId: string | null): void {
    const currentSession = this.sessionState();
    if (!currentSession) {
      return;
    }

    const normalizedActiveGameId = this.normalizeOptionalString(activeGameId);
    if (currentSession.activeGameId === normalizedActiveGameId) {
      return;
    }

    this.applySession({
      ...currentSession,
      activeGameId: normalizedActiveGameId,
    });
  }

  private buildSession(
    response: LoginResponse | RefreshResponse,
    options: {
      email?: string;
      existingSession: AuthSession | null;
    }
  ): AuthSession {
    const token = this.extractToken(response);
    if (!token) {
      throw new Error('La API no devolvio un token de sesion valido');
    }

    const tokenPayload = this.decodeJwtPayload(token);
    const responseUser = 'user' in response ? response.user : undefined;
    const existingUser = options.existingSession?.user;

    const userId =
      this.normalizeOptionalString(responseUser?.id) ??
      this.readClaim(tokenPayload, ['userId', 'id', 'sub']) ??
      existingUser?.id;
    const username =
      this.normalizeOptionalString(responseUser?.username) ??
      this.readClaim(tokenPayload, ['username', 'preferred_username', 'name']) ??
      existingUser?.username;
    const email =
      options.email ??
      this.normalizeOptionalString(responseUser?.email) ??
      this.readClaim(tokenPayload, ['email']) ??
      existingUser?.email;

    if (!userId || !username) {
      throw new Error('No se pudo reconstruir la sesion del usuario');
    }

    return {
      token,
      user: {
        id: userId,
        username,
        email,
      },
      activeGameId:
        this.normalizeOptionalString(response.activeGameId) ??
        options.existingSession?.activeGameId ??
        null,
    };
  }

  private extractToken(response: LoginResponse | RefreshResponse): string {
    if (typeof response.token === 'string' && response.token.trim()) {
      return response.token.trim();
    }

    if ('accessToken' in response && typeof response.accessToken === 'string' && response.accessToken.trim()) {
      return response.accessToken.trim();
    }

    return '';
  }

  private applySession(session: AuthSession): void {
    this.sessionState.set(session);
    this.persistSession(session);
  }

  private clearSessionState(): void {
    this.sessionState.set(null);
    this.clearPersistedSession();
    this.apiClient.invalidateCache();
  }

  private restoreSession(): AuthSession | null {
    try {
      const rawSession = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!rawSession) {
        return null;
      }

      const parsed = JSON.parse(rawSession) as Partial<AuthSession>;
      if (
        typeof parsed.token !== 'string' ||
        typeof parsed.user !== 'object' ||
        parsed.user === null ||
        typeof parsed.user.id !== 'string' ||
        typeof parsed.user.username !== 'string'
      ) {
        this.clearPersistedSession();
        return null;
      }

      return {
        token: parsed.token,
        user: {
          id: parsed.user.id,
          username: parsed.user.username,
          email: typeof parsed.user.email === 'string' ? parsed.user.email : undefined,
        },
        activeGameId:
          typeof parsed.activeGameId === 'string' && parsed.activeGameId.trim()
            ? parsed.activeGameId.trim()
            : null,
      };
    } catch {
      this.clearPersistedSession();
      return null;
    }
  }

  private persistSession(session: AuthSession): void {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }

  private clearPersistedSession(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    try {
      const [, payload = ''] = token.split('.');
      if (!payload) {
        return {};
      }

      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padding = normalizedPayload.length % 4 === 0 ? '' : '='.repeat(4 - (normalizedPayload.length % 4));
      const decodedPayload = atob(`${normalizedPayload}${padding}`);
      return JSON.parse(decodedPayload) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private readClaim(
    payload: Record<string, unknown>,
    keys: readonly string[]
  ): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private normalizeOptionalString(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private resolveRegisterError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error('No se pudo completar el registro');
    }

    const normalizedMessage = error.message.trim().toLowerCase();
    const isDuplicatedUser =
      normalizedMessage.includes('already used') ||
      normalizedMessage.includes('already exists') ||
      normalizedMessage.includes('duplicate') ||
      normalizedMessage.includes('ya existe') ||
      normalizedMessage.includes('ya esta en uso') ||
      normalizedMessage.includes('ya estan en uso') ||
      normalizedMessage.includes('email/username already used');

    if (isDuplicatedUser) {
      return new Error('El usuario ya existe');
    }

    return error;
  }
}
