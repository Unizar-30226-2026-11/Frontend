import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { Auth } from './services/auth';
import { FriendsPull } from './services/friends-pull';
import { DixitRealtime } from './services/dixit-realtime';
import { ApiRequestError } from './interfaces/api';

@Component({
  standalone: true,
  template: '<p>home</p>',
})
class TestHome {}

@Component({
  standalone: true,
  template: '<p>store</p>',
})
class TestStore {}

@Component({
  standalone: true,
  template: '<p>menu</p>',
})
class TestMenu {}

@Component({
  standalone: true,
  template: '<p>games</p>',
})
class TestGames {}

@Component({
  standalone: true,
  template: '<p>dixit</p>',
})
class TestDixit {}

@Component({
  standalone: true,
  template: '<p>dixit stella</p>',
})
class TestDixitStella {}

@Component({
  standalone: true,
  template: '<p>game shell</p>',
})
class TestGameShell {}

describe('App', () => {
  let authStub: {
    ensureInitialized: jasmine.Spy<
      () => Promise<{ activeGameId: string | null; activeGameEngine?: 'Classic' | 'Stella' | null } | null>
    >;
    activeGameId: jasmine.Spy<() => string | null>;
    activeGameRoute: jasmine.Spy<() => string | null>;
    setActiveGameId: jasmine.Spy<
      (activeGameId: string | null, activeGameEngine?: 'Classic' | 'Stella' | null) => void
    >;
  };
  let realtimeStub: {
    toast: jasmine.Spy<() => null>;
    clearToast: jasmine.Spy<() => void>;
    restoreActiveGameConnection: jasmine.Spy<(lobbyCode: string) => Promise<void>>;
    activeGameNotice: jasmine.Spy<() => string>;
  };

  beforeEach(async () => {
    authStub = {
      ensureInitialized: jasmine.createSpy().and.resolveTo(null),
      activeGameId: jasmine.createSpy().and.returnValue(null),
      activeGameRoute: jasmine.createSpy().and.returnValue(null),
      setActiveGameId: jasmine.createSpy(),
    };
    realtimeStub = {
      toast: jasmine.createSpy().and.returnValue(null),
      clearToast: jasmine.createSpy(),
      restoreActiveGameConnection: jasmine.createSpy().and.resolveTo(),
      activeGameNotice: jasmine.createSpy().and.returnValue(''),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', component: TestHome },
          { path: 'menu', component: TestMenu },
          { path: 'store', component: TestStore },
          { path: 'games', component: TestGames },
          { path: 'game/:id', component: TestGameShell },
          { path: 'dixit/:id', component: TestDixit },
          { path: 'dixit-stella/:id', component: TestDixitStella },
          { path: 'test/stella/:id', component: TestDixitStella },
          { path: 'test/unif/:id', component: TestGameShell },
        ]),
        {
          provide: Auth,
          useValue: authStub,
        },
        {
          provide: DixitRealtime,
          useValue: realtimeStub,
        },
        {
          provide: FriendsPull,
          useValue: {
            getFriendsPanelData: () =>
              Promise.resolve({
                friends: [],
                pendingRequests: [],
              }),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should hide the navigation bar on the home route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeNull();
  });

  it('should render the navigation bar on app routes', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/store');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeTruthy();
  });

  it('should hide the navigation bar on game routes', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/game/demo-room');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeNull();
  });

  it('should hide the navigation bar on dixit stella routes', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dixit-stella/demo-room');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeNull();
  });

  it('should hide the navigation bar on the stella test route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/test/stella/TEST-STELLA');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeNull();
  });

  it('should hide the navigation bar on the unified test route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/test/unif/TEST-UNIF');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeNull();
  });

  it('clears a stale active game and returns to /games when recovery gets a 404', async () => {
    authStub.ensureInitialized.and.resolveTo({ activeGameId: 'ROOM-9', activeGameEngine: 'Stella' });
    authStub.activeGameId.and.returnValue('ROOM-9');
    authStub.activeGameRoute.and.returnValue('/game/ROOM-9');
    realtimeStub.restoreActiveGameConnection.and.rejectWith(
      new ApiRequestError('Sala no encontrada', 404)
    );

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/game/ROOM-9');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(authStub.setActiveGameId).toHaveBeenCalledOnceWith(null);
    expect(router.url).toBe('/games');
  });

  it('keeps the user on /games after recovering an active game and shows the resume banner', async () => {
    authStub.ensureInitialized.and.resolveTo({ activeGameId: 'ROOM-9', activeGameEngine: 'Stella' });
    authStub.activeGameId.and.returnValue('ROOM-9');
    authStub.activeGameRoute.and.returnValue('/game/ROOM-9');
    realtimeStub.activeGameNotice.and.returnValue('Tienes una partida activa. Vuelve cuando quieras.');

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/games');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(router.url).toBe('/games');
    expect(realtimeStub.restoreActiveGameConnection).toHaveBeenCalledOnceWith('ROOM-9');
    expect(compiled.textContent).toContain('Partida activa detectada');
    expect(compiled.textContent).toContain('Vuelve cuando quieras.');
    expect(compiled.textContent).toContain('Volver a la partida');
  });

  it('keeps the user on /menu after recovering an active game and shows the resume banner', async () => {
    authStub.ensureInitialized.and.resolveTo({ activeGameId: 'ROOM-9', activeGameEngine: 'Stella' });
    authStub.activeGameId.and.returnValue('ROOM-9');
    authStub.activeGameRoute.and.returnValue('/game/ROOM-9');
    realtimeStub.activeGameNotice.and.returnValue('La partida sigue abierta para este usuario.');

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/menu');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(router.url).toBe('/menu');
    expect(compiled.textContent).toContain('Partida activa detectada');
    expect(compiled.textContent).toContain('La partida sigue abierta para este usuario.');
    expect(compiled.textContent).toContain('Volver a la partida');
  });

  it('redirects the user away from / when recovering an active game', async () => {
    authStub.ensureInitialized.and.resolveTo({ activeGameId: 'ROOM-9', activeGameEngine: 'Stella' });
    authStub.activeGameId.and.returnValue('ROOM-9');
    authStub.activeGameRoute.and.returnValue('/game/ROOM-9');

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(router.url).toBe('/game/ROOM-9');
    expect(compiled.textContent).not.toContain('Partida activa detectada');
  });
});
