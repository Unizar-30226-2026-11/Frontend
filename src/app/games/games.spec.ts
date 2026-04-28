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
    gamesPullSpy = jasmine.createSpyObj<GamesPull>('GamesPull', ['getGames', 'createLobby']);
    gamesPullSpy.getGames.and.resolveTo([]);
    gamesPullSpy.createLobby.and.resolveTo({
      message: 'Sala creada',
      lobbyCode: 'A1B2',
      route: '/games/A1B2',
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
});
