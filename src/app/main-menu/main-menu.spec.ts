import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { MainMenu } from './main-menu';
import { Game } from '../interfaces/game';
import { Auth } from '../services/auth';
import { CardPull } from '../services/card-pull';
import { DixitRealtime } from '../services/dixit-realtime';
import { GamesPull } from '../services/games-pull';

describe('MainMenu', () => {
  let component: MainMenu;
  let fixture: ComponentFixture<MainMenu>;
  let cardPullSpy: jasmine.SpyObj<CardPull>;
  let gamesPullSpy: jasmine.SpyObj<GamesPull>;
  let realtimeSpy: jasmine.SpyObj<DixitRealtime>;
  let routerSpy: jasmine.SpyObj<Router>;
  let authStub: {
    isLoggedIn: jasmine.Spy<() => boolean>;
    session: jasmine.Spy<() => { user: { id: string } } | null>;
  };

  beforeEach(async () => {
    cardPullSpy = jasmine.createSpyObj<CardPull>('CardPull', ['getCards']);
    cardPullSpy.getCards.and.resolveTo(createCardsFixture());
    gamesPullSpy = jasmine.createSpyObj<GamesPull>('GamesPull', [
      'getGameDetails',
      'startLobby',
    ]);
    gamesPullSpy.getGameDetails.and.resolveTo(createLobbyFixture());
    gamesPullSpy.startLobby.and.resolveTo({
      message: 'Partida iniciada',
      lobbyCode: 'A1B2',
      status: 'starting',
      route: '/dixit/A1B2',
    });
    realtimeSpy = jasmine.createSpyObj<DixitRealtime>('DixitRealtime', [
      'ensureLobbyConnection',
      'joinLobby',
      'startLobby',
      'lobbyState',
      'activeLobbyCode',
      'lastError',
      'gameStarted',
      'connectionStatus',
    ]);
    realtimeSpy.ensureLobbyConnection.and.resolveTo();
    realtimeSpy.joinLobby.and.resolveTo();
    realtimeSpy.lobbyState.and.returnValue(null);
    realtimeSpy.activeLobbyCode.and.returnValue('');
    realtimeSpy.lastError.and.returnValue('');
    realtimeSpy.gameStarted.and.returnValue(null);
    realtimeSpy.connectionStatus.and.returnValue('idle');
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);
    authStub = {
      isLoggedIn: jasmine.createSpy().and.returnValue(true),
      session: jasmine.createSpy().and.returnValue({ user: { id: 'u_111' } }),
    };

    await TestBed.configureTestingModule({
      imports: [MainMenu],
      providers: [
        { provide: CardPull, useValue: cardPullSpy },
        { provide: GamesPull, useValue: gamesPullSpy },
        { provide: DixitRealtime, useValue: realtimeSpy },
        { provide: Router, useValue: routerSpy },
        { provide: Auth, useValue: authStub },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'A1B2' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads user cards on init', () => {
    expect(cardPullSpy.getCards).toHaveBeenCalledOnceWith(undefined, {
      forceRefresh: true,
    });
    expect(component.collections.length).toBe(1);
    expect(component.collectedCards).toBe(3);
    expect(component.totalCards).toBe(3);
    expect(component.collections.every((collection) => collection.expanded)).toBeTrue();
  });

  it('toggles a collection accordion without affecting the others', () => {
    component.toggleCollection('user-cards');

    expect(component.collections[0].expanded).toBeFalse();
  });

  it('loads lobby players from the route id', () => {
    expect(gamesPullSpy.getGameDetails).toHaveBeenCalledOnceWith('A1B2', {
      forceRefresh: true,
    });
    expect(realtimeSpy.ensureLobbyConnection).toHaveBeenCalledOnceWith('A1B2');
    expect(realtimeSpy.joinLobby).not.toHaveBeenCalled();
    expect(component.playersInRoom).toBe(2);
    expect(component.roomCapacity).toBe(4);
    expect(component.roomSlots).toEqual([
      { slotId: 1, name: 'u_111', state: 'anfitrion' },
      { slotId: 2, name: 'u_222', state: 'jugador' },
      { slotId: 3, name: 'slot libre', state: 'abierto' },
      { slotId: 4, name: 'slot libre', state: 'abierto' },
    ]);
  });

  it('shows the host action when the authenticated player owns the lobby', () => {
    expect(component.isHost).toBeTrue();
    expect(component.primaryActionButtonText).toBe('Empezar partida');
    expect(component.shouldShowJoinOverlay).toBeTrue();
  });

  it('does not restore realtime when the authenticated user is not in the lobby', async () => {
    authStub.session.and.returnValue({ user: { id: 'u_999' } });
    gamesPullSpy.getGameDetails.calls.reset();
    realtimeSpy.ensureLobbyConnection.calls.reset();

    const freshFixture = TestBed.createComponent(MainMenu);
    const freshComponent = freshFixture.componentInstance;
    freshFixture.detectChanges();
    await freshFixture.whenStable();

    expect(gamesPullSpy.getGameDetails).toHaveBeenCalledOnceWith('A1B2', {
      forceRefresh: true,
    });
    expect(realtimeSpy.ensureLobbyConnection).not.toHaveBeenCalled();
    expect(freshComponent.shouldShowJoinOverlay).toBeTrue();
  });

  it('shows the ready action for non-host players', () => {
    authStub.session.and.returnValue({ user: { id: 'u_222' } });

    expect(component.isHost).toBeFalse();
    expect(component.primaryActionButtonText).toBe('Listo');
  });

  it('joins the lobby only when the user requests it', async () => {
    await component.joinCurrentLobby();

    expect(realtimeSpy.joinLobby).toHaveBeenCalledOnceWith('A1B2');
  });

  it('starts the lobby when the host presses the main action after joining', async () => {
    realtimeSpy.connectionStatus.and.returnValue('connected');
    realtimeSpy.activeLobbyCode.and.returnValue('A1B2');

    await component.onPrimaryAction();

    expect(realtimeSpy.startLobby).toHaveBeenCalledTimes(1);
    expect(component.primaryActionMessage).toContain('Solicitud de inicio enviada');
    expect(component.primaryActionButtonText).toBe('Empezar partida');
  });

  it('normalizes the minimum players placeholder error when starting the lobby', async () => {
    realtimeSpy.connectionStatus.and.returnValue('connected');
    realtimeSpy.activeLobbyCode.and.returnValue('A1B2');
    realtimeSpy.startLobby.and.callFake(() => {
      throw new Error('Se requieren al menos ${LOBBY_MIN_PLAYERS} jugadores para iniciar.');
    });

    await component.onPrimaryAction();

    expect(component.primaryActionError).toBe(
      'Se requieren al menos 3 jugadores para iniciar.'
    );
  });
});

function createCardsFixture() {
  return [
    {
      code: 'col_set1_card_001',
      image: 'https://ejemplo.com/dragon-fuego.jpg',
      value: 'Dragon de Fuego',
      suit: 'DIXIT',
    },
    {
      code: 'col_set1_card_002',
      image: 'https://ejemplo.com/guardian-lago.jpg',
      value: 'Guardian del Lago',
      suit: 'DIXIT',
    },
    {
      code: 'col_set2_card_001',
      image: 'https://ejemplo.com/espectro-lunar.jpg',
      value: 'Espectro Lunar',
      suit: 'DIXIT',
    },
  ];
}

function createLobbyFixture(): Game {
  return {
    id: 'A1B2',
    title: 'Sala de Novatos',
    description: 'Classic - 2/4 jugadores - Esperando jugadores - Publica',
    image: '/assets/Tablero.png',
    hostId: 'u_111',
    players: ['u_111', 'u_222'],
    playerCount: 2,
    maxPlayers: 4,
    engine: 'Classic',
    status: 'waiting',
    isPrivate: false,
  };
}
