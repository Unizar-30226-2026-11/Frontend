import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { Games } from './games';
import { Auth } from '../services/auth';
import { GamesPull } from '../services/games-pull';

describe('Games', () => {
  let component: Games;
  let fixture: ComponentFixture<Games>;
  let gamesPullSpy: jasmine.SpyObj<GamesPull>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    gamesPullSpy = jasmine.createSpyObj<GamesPull>('GamesPull', [
      'getGames',
      'createLobby',
      'getGameDetails',
    ]);
    gamesPullSpy.getGames.and.resolveTo([]);
    gamesPullSpy.createLobby.and.resolveTo({
      message: 'Sala creada',
      lobbyCode: 'A1B2',
      route: '/games/A1B2',
    });
    gamesPullSpy.getGameDetails.and.resolveTo({
      id: 'A1B2',
      title: 'Sala privada',
      description: 'Classic - 1/4 jugadores - Esperando jugadores - Privada',
      image: '/assets/Tablero.png',
      hostId: 'user-host',
      players: ['user-host'],
      playerCount: 1,
      maxPlayers: 4,
      engine: 'Classic',
      status: 'waiting',
      isPrivate: true,
      selectedDeckId: null,
    });
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [Games],
      providers: [
        { provide: GamesPull, useValue: gamesPullSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: Auth,
          useValue: {
            isLoggedIn: () => true,
            token: () => 'token-123',
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Games);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates a classic lobby and navigates to it', async () => {
    component.createLobbyName = 'Sala de prueba';
    component.createLobbyMaxPlayers = 5;
    component.createLobbyEngine = 'Classic';
    component.createLobbyPrivate = true;

    await component.submitCreateLobby();

    expect(gamesPullSpy.createLobby).toHaveBeenCalledOnceWith({
      name: 'Sala de prueba',
      maxPlayers: 5,
      engine: 'Classic',
      isPrivate: true,
    });
    expect(routerSpy.navigateByUrl).toHaveBeenCalledOnceWith('/games/A1B2');
  });

  it('creates a stella lobby when that mode is selected', async () => {
    component.createLobbyName = 'Sala Stella';
    component.createLobbyMaxPlayers = 4;
    component.createLobbyEngine = 'Stella';
    component.createLobbyPrivate = false;

    await component.submitCreateLobby();

    expect(gamesPullSpy.createLobby).toHaveBeenCalledWith({
      name: 'Sala Stella',
      maxPlayers: 4,
      engine: 'Stella',
      isPrivate: false,
    });
  });

  it('refreshes the lobby list forcing fresh data', async () => {
    gamesPullSpy.getGames.calls.reset();

    await component.refreshLobbies();

    expect(gamesPullSpy.getGames).toHaveBeenCalledOnceWith(1, 20, {
      forceRefresh: true,
    });
  });

  it('normalizes a private lobby code and navigates to it', async () => {
    component.privateLobbyCode = 'a1-b2';

    await component.submitPrivateLobbyCode();

    expect(gamesPullSpy.getGameDetails).toHaveBeenCalledOnceWith('A1B2', {
      forceRefresh: true,
    });
    expect(routerSpy.navigateByUrl).toHaveBeenCalledOnceWith('/games/A1B2');
  });

  it('does not request a lobby when the private code is invalid', async () => {
    component.privateLobbyCode = 'AB';

    await component.submitPrivateLobbyCode();

    expect(gamesPullSpy.getGameDetails).not.toHaveBeenCalled();
    expect(component.privateLobbyError()).toBe(
      'El codigo debe tener entre 4 y 6 caracteres alfanumericos.'
    );
  });
});
