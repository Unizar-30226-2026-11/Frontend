import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AuthSession,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
} from '../interfaces/auth';
import { ApiClient } from './api-client';

const AUTH_STORAGE_KEY = 'ator.auth.session';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly apiClient = inject(ApiClient);
  private readonly sessionState = signal<AuthSession | null>(this.restoreSession());

  readonly session = computed(() => this.sessionState());
  readonly isLoggedIn = computed(() => this.sessionState() !== null);
  readonly token = computed(() => this.sessionState()?.token ?? null);
  readonly username = computed(() => this.sessionState()?.user.username ?? '');
  readonly email = computed(() => this.sessionState()?.user.email ?? '');

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

    const session: AuthSession = {
      token: response.token,
      user: {
        id: response.user.id,
        username: response.user.username,
        email: payload.email,
      },
    };

    this.sessionState.set(session);
    this.persistSession(session);
    return session;
  }

  logOut(): void {
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
