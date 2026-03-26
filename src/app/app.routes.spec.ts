import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Auth } from './services/auth';
import { redirectLoggedInHomeGuard } from './app.routes';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows the root route when the user is logged out', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            isLoggedIn: () => false,
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      redirectLoggedInHomeGuard({} as never, {} as never)
    );

    expect(result).toBeTrue();
  });

  it('redirects the root route to /games when the user is logged in', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            isLoggedIn: () => true,
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      redirectLoggedInHomeGuard({} as never, {} as never)
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/games');
  });
});
