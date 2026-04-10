import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';
import { ApiClient } from './api-client';

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
  });

  it('refreshes the session on bootstrap and restores the active game id', async () => {
    apiClientSpy.request.and.resolveTo({
      accessToken: 'token-456',
      activeGameId: 'ROOM-7',
      user: {
        id: 'user-7',
        username: 'recovered-user',
        email: 'recovered@example.com',
      },
    });

    const session = await service.ensureInitialized();

    expect(apiClientSpy.request).toHaveBeenCalledOnceWith('/auth/refresh', {
      method: 'POST',
      token: null,
      credentials: 'include',
      useCache: false,
    });
    expect(session?.activeGameId).toBe('ROOM-7');
    expect(service.activeGameId()).toBe('ROOM-7');
    expect(service.isInitialized()).toBeTrue();
  });
});
