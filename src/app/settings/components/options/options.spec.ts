import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { Options } from './options';
import { SettingsPreferencesStore } from '../../../services/settings-preferences-store';
import { Auth } from '../../../services/auth';
import { PlayerStore } from '../../../services/player-store';

describe('Options', () => {
  let component: Options;
  let fixture: ComponentFixture<Options>;
  let authSpy: jasmine.SpyObj<Auth>;
  let playerStoreSpy: jasmine.SpyObj<PlayerStore>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<Auth>('Auth', ['logOut']);
    playerStoreSpy = jasmine.createSpyObj<PlayerStore>('PlayerStore', ['clearPlayer']);

    await TestBed.configureTestingModule({
      imports: [Options],
      providers: [
        provideRouter([]),
        {
          provide: SettingsPreferencesStore,
          useValue: {
            settings: signal({
              soundVolume: 100,
              musicVolume: 100,
              notificationsEnabled: false,
              showOnlineStatus: false,
            }),
            save: jasmine.createSpy('save'),
          },
        },
        { provide: Auth, useValue: authSpy },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(Options);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('clears the player store before logging out', () => {
    component.cerrarSesion();

    expect(playerStoreSpy.clearPlayer).toHaveBeenCalledBefore(authSpy.logOut);
    expect(authSpy.logOut).toHaveBeenCalledOnceWith();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/login']);
  });
});
