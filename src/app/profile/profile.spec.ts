import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Profile } from './profile';
import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';
import { PlayerInfo, PlayerPresenceStatus } from '../interfaces/player-info';

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;
  let playerStoreMock: {
    player: ReturnType<typeof signal<PlayerInfo | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    loadPlayer: jasmine.Spy;
    updateUsername: jasmine.Spy;
    updateStatus: jasmine.Spy;
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
      updateUsername: jasmine.createSpy('updateUsername').and.resolveTo('Nombre actualizado'),
      updateStatus: jasmine.createSpy('updateStatus').and.resolveTo('Estado actualizado'),
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
      state: 'CONNECTED',
      personalState: 'ready',
      balance: 250,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('USER_ID');
    expect(text).toContain('12');
    expect(text).toContain('tester@example.com');
    expect(text).toContain('Conectado');
  });

  it('submits the updated username from the profile page', async () => {
    playerStoreMock.player.set(createPlayer());

    fixture.detectChanges();
    await fixture.whenStable();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#profile-username');
    input.value = 'new_tester';
    input.dispatchEvent(new Event('input'));

    fixture.detectChanges();
    await fixture.whenStable();

    await component.saveUsername();
    fixture.detectChanges();

    expect(playerStoreMock.updateUsername).toHaveBeenCalledOnceWith('new_tester');
    expect(fixture.nativeElement.textContent as string).toContain('Nombre actualizado');
  });

  it('submits the updated player status from the profile page', async () => {
    playerStoreMock.player.set(createPlayer());

    fixture.detectChanges();
    await fixture.whenStable();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#profile-status');
    select.value = 'DISCONNECTED';
    select.dispatchEvent(new Event('change'));

    fixture.detectChanges();
    await fixture.whenStable();

    await component.saveStatus();
    fixture.detectChanges();

    expect(playerStoreMock.updateStatus).toHaveBeenCalledOnceWith('DISCONNECTED');
    expect(fixture.nativeElement.textContent as string).toContain('Estado actualizado');
  });

  it('allows changing the status when the profile starts in UNKNOWN', async () => {
    playerStoreMock.player.set(createPlayer('UNKNOWN'));

    fixture.detectChanges();
    await fixture.whenStable();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#profile-status');
    select.value = 'CONNECTED';
    select.dispatchEvent(new Event('change'));

    fixture.detectChanges();
    await fixture.whenStable();

    await component.saveStatus();

    expect(playerStoreMock.updateStatus).toHaveBeenCalledOnceWith('CONNECTED');
  });
});

function createPlayer(state: PlayerPresenceStatus = 'CONNECTED'): PlayerInfo {
  return {
    id: 'u_12',
    legacyUserId: 12,
    username: 'tester',
    email: 'tester@example.com',
    experienceLevel: 7,
    progressLevel: 45,
    state,
    personalState: 'ready',
    balance: 250,
  };
}
