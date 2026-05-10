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
      redirectLoggedInHomeGuard({} as never, { url: '/' } as never)
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
      redirectLoggedInHomeGuard({} as never, { url: '/' } as never)
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/menu');
  });

  it('redirects the register route to /menu when the user is logged in', async () => {
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
      redirectLoggedInHomeGuard({} as never, { url: '/register' } as never)
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/menu');
  });

  it('redirects the root route to /games when a recovered game is active', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            ensureInitialized: () => Promise.resolve(null),
            activeGameId: () => 'ROOM-9',
            activeGameRoute: () => '/game/ROOM-9',
            isLoggedIn: () => true,
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      redirectLoggedInHomeGuard({} as never, { url: '/' } as never)
    );

    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/games');
  });

  it('redirects the register route to /games when a recovered game is active', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            ensureInitialized: () => Promise.resolve(null),
            activeGameId: () => 'ROOM-9',
            activeGameRoute: () => '/game/ROOM-9',
            isLoggedIn: () => true,
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      redirectLoggedInHomeGuard({} as never, { url: '/register' } as never)
    );

    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/games');
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
            activeGameRoute: () => '/game/ROOM-9',
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() =>
      activeGameLobbyGuard({} as never, { url: '/games/A1B2' } as never)
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/game/ROOM-9');
  });

  it('allows the games list while a game is active so the player can resume from there', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            ensureInitialized: () => Promise.resolve(null),
            activeGameId: () => 'ROOM-9',
            activeGameRoute: () => '/game/ROOM-9',
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      activeGameLobbyGuard({} as never, { url: '/games' } as never)
    );

    expect(result).toBeTrue();
  });

  it('allows the main menu while a game is active so the banner can be shown there', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            ensureInitialized: () => Promise.resolve(null),
            activeGameId: () => 'ROOM-9',
            activeGameRoute: () => '/game/ROOM-9',
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      activeGameLobbyGuard({} as never, { url: '/menu' } as never)
    );

    expect(result).toBeTrue();
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
