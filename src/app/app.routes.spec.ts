import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Auth } from './services/auth';
import { activeGameLobbyGuard, redirectLoggedInHomeGuard, requireAuthGuard } from './app.routes';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows the root route when the user is logged out', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            ensureInitialized: () => Promise.resolve(null),
            activeGameId: () => null,
            activeGameRoute: () => null,
            isLoggedIn: () => false,
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      redirectLoggedInHomeGuard({} as never, {} as never)
    );

    expect(result).toBeTrue();
  });

  it('redirects the root route to /menu when the user is logged in', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            ensureInitialized: () => Promise.resolve(null),
            activeGameId: () => null,
            activeGameRoute: () => null,
            isLoggedIn: () => true,
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() =>
      redirectLoggedInHomeGuard({} as never, {} as never)
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/menu');
  });

  it('redirects to the recovered game when one is active', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            ensureInitialized: () => Promise.resolve(null),
            activeGameId: () => 'ROOM-9',
            activeGameRoute: () => '/dixit-stella/ROOM-9',
            isLoggedIn: () => true,
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() =>
      redirectLoggedInHomeGuard({} as never, {} as never)
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/dixit-stella/ROOM-9');
  });

  it('blocks lobby routes while a game is active', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            ensureInitialized: () => Promise.resolve(null),
            activeGameId: () => 'ROOM-9',
            activeGameRoute: () => '/dixit-stella/ROOM-9',
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() =>
      activeGameLobbyGuard({} as never, {} as never)
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/dixit-stella/ROOM-9');
  });

  it('redirects protected routes to /login when the user is logged out', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            ensureInitialized: () => Promise.resolve(null),
            isLoggedIn: () => false,
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() =>
      requireAuthGuard({} as never, {} as never)
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});
