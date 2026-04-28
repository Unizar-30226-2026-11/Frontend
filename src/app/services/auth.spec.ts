import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';
import { ApiClient } from './api-client';
import { ApiRequestError } from '../interfaces/api';

function buildJwtWithExp(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const payload = btoa(JSON.stringify({ sub: 'user-1', username: 'tester', exp }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${header}.${payload}.signature`;
}

describe('Auth', () => {
  let service: Auth;
  let apiClientSpy: jasmine.SpyObj<ApiClient>;

  beforeEach(() => {
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', ['request', 'invalidateCache']);
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        Auth,
        { provide: ApiClient, useValue: apiClientSpy },
      ],
    });

    service = TestBed.inject(Auth);
  });

  it('should be created', () => {
    const service = TestBed.inject(Auth);
    expect(service).toBeTruthy();
  });

  it('persists the session after login', async () => {
    const service = TestBed.inject(Auth);

    apiClientSpy.request.and.resolveTo({
      message: 'Login completado',
      token: 'token-123',
      activeGameId: null,
      activeGameEngine: null,
      user: {
        id: 'user-1',
        username: 'tester',
      },
    });

    await service.logIn('tester@example.com', 'secret');

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.token()).toBe('token-123');
    expect(JSON.parse(localStorage.getItem('ator.auth.session') ?? '{}')).toEqual({
      token: 'token-123',
      activeGameId: null,
      activeGameEngine: null,
      user: {
        id: 'user-1',
        username: 'tester',
        email: 'tester@example.com',
      },
    });
  });

  it('restores a persisted session from localStorage', () => {
    localStorage.setItem('ator.auth.session', JSON.stringify({
      token: 'persisted-token',
      activeGameId: 'GAME-42',
      activeGameEngine: 'Stella',
      user: {
        id: 'user-2',
        username: 'persisted-user',
        email: 'persisted@example.com',
      },
    }));

    const restoredService = TestBed.inject(Auth);

    expect(restoredService.isLoggedIn()).toBeTrue();
    expect(restoredService.token()).toBe('persisted-token');
    expect(restoredService.username()).toBe('persisted-user');
    expect(restoredService.email()).toBe('persisted@example.com');
    expect(restoredService.activeGameId()).toBe('GAME-42');
    expect(restoredService.activeGameEngine()).toBe('Stella');
    expect(restoredService.activeGameRoute()).toBe('/dixit-stella/GAME-42');
  });

  it('derives the active game engine from the persisted realtime game state', () => {
    localStorage.setItem('ator.auth.session', JSON.stringify({
      token: 'persisted-token',
      activeGameId: 'GAME-42',
      user: {
        id: 'user-2',
        username: 'persisted-user',
        email: 'persisted@example.com',
      },
    }));
    localStorage.setItem('ator.dixit.realtime.game-state', JSON.stringify({
      lobbyCode: 'GAME-42',
      state: {
        mode: 'STELLA',
      },
      receivedAt: Date.now(),
    }));

    const restoredService = TestBed.inject(Auth);

    expect(restoredService.activeGameId()).toBe('GAME-42');
    expect(restoredService.activeGameEngine()).toBe('Stella');
    expect(restoredService.activeGameRoute()).toBe('/dixit-stella/GAME-42');
  });

  it('does not restore an expired persisted session from localStorage', () => {
    localStorage.setItem('ator.auth.session', JSON.stringify({
      token: buildJwtWithExp(Math.floor(Date.now() / 1000) - 60),
      activeGameId: 'GAME-42',
      activeGameEngine: 'Stella',
      user: {
        id: 'user-2',
        username: 'persisted-user',
        email: 'persisted@example.com',
      },
    }));

    const restoredService = TestBed.inject(Auth);

    expect(restoredService.isLoggedIn()).toBeFalse();
    expect(restoredService.token()).toBeNull();
    expect(localStorage.getItem('ator.auth.session')).toBeNull();
  });

  it('refreshes the session on bootstrap and restores the active game id', async () => {
    apiClientSpy.request.and.resolveTo({
      accessToken: 'token-456',
      activeGameId: 'ROOM-7',
      activeGameEngine: 'Classic',
      user: {
        id: 'user-7',
        username: 'recovered-user',
        email: 'recovered@example.com',
      },
    });

    const session = await service.ensureInitialized();

    expect(apiClientSpy.request).toHaveBeenCalledOnceWith('/auth/refresh-session', {
      method: 'POST',
      token: null,
      credentials: 'include',
      useCache: false,
    });
    expect(session?.activeGameId).toBe('ROOM-7');
    expect(session?.activeGameEngine).toBe('Classic');
    expect(service.activeGameId()).toBe('ROOM-7');
    expect(service.activeGameEngine()).toBe('Classic');
    expect(service.isInitialized()).toBeTrue();
  });

  it('clears the session when refresh-session returns unauthorized', async () => {
    localStorage.setItem('ator.auth.session', JSON.stringify({
      token: 'persisted-token',
      user: {
        id: 'user-2',
        username: 'persisted-user',
      },
    }));

    const restoredService = TestBed.inject(Auth);
    apiClientSpy.request.and.rejectWith(new ApiRequestError('Token expirado', 401));

    const session = await restoredService.ensureInitialized();

    expect(session).toBeNull();
    expect(restoredService.isLoggedIn()).toBeFalse();
    expect(localStorage.getItem('ator.auth.session')).toBeNull();
    expect(apiClientSpy.invalidateCache).toHaveBeenCalled();
  });
});
