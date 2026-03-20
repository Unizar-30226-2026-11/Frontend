import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Profile } from './profile';
import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';
import { PlayerInfo } from '../interfaces/player-info';

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;
  let playerStoreMock: {
    player: ReturnType<typeof signal<PlayerInfo | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    loadPlayer: jasmine.Spy;
  };
  let authMock: {
    isLoggedIn: jasmine.Spy;
  };

  beforeEach(async () => {
    playerStoreMock = {
      player: signal<PlayerInfo | null>(null),
      loading: signal(false),
      error: signal<string | null>(null),
      loadPlayer: jasmine.createSpy('loadPlayer').and.resolveTo(),
    };

    authMock = {
      isLoggedIn: jasmine.createSpy('isLoggedIn').and.returnValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: authMock },
        { provide: PlayerStore, useValue: playerStoreMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads the profile when the user is logged in', () => {
    expect(playerStoreMock.loadPlayer).toHaveBeenCalledOnceWith({ forceRefresh: false });
  });

  it('shows USER_ID data returned by the API', async () => {
    playerStoreMock.player.set({
      id: 'u_12',
      legacyUserId: 12,
      username: 'tester',
      email: 'tester@example.com',
      experienceLevel: 7,
      progressLevel: 45,
      state: 'online',
      personalState: 'ready',
      balance: 250,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('USER_ID');
    expect(text).toContain('12');
    expect(text).toContain('tester@example.com');
  });
});
