import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { DixitStella } from './dixit-stella';
import { Game } from '../interfaces/game';
import { Auth } from '../services/auth';
import { DeckCard } from '../services/card-pull';
import { DixitRealtime } from '../services/dixit-realtime';
import { GamesPull } from '../services/games-pull';
import { StellaCardPull } from '../services/stella-card-pull';

describe('DixitStella', () => {
  let component: DixitStella;
  let fixture: ComponentFixture<DixitStella>;
  let stellaCardPullSpy: jasmine.SpyObj<StellaCardPull>;
  let gamesPullSpy: jasmine.SpyObj<GamesPull>;
  let routerSpy: jasmine.SpyObj<Router>;
  let authStub: {
    session: jasmine.Spy<() => { user: { id: string } } | null>;
    username: jasmine.Spy<() => string>;
  };
  let realtimeStub: {
    ensureLobbyConnection: jasmine.Spy<(lobbyCode: string) => Promise<void>>;
    activeLobbyCode: jasmine.Spy<() => string>;
    gameState: jasmine.Spy<() => { state: Record<string, unknown>; receivedAt: number } | null>;
    lobbyState: jasmine.Spy<() => null>;
    lastError: jasmine.Spy<() => string>;
    connectionStatus: jasmine.Spy<() => string>;
    sendGameAction: jasmine.Spy<(actionType: string, payload?: Record<string, unknown>) => void>;
  };

  beforeEach(async () => {
    stellaCardPullSpy = jasmine.createSpyObj<StellaCardPull>('StellaCardPull', ['getCards']);
    gamesPullSpy = jasmine.createSpyObj<GamesPull>('GamesPull', ['getGameDetails']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    authStub = {
      session: jasmine.createSpy().and.returnValue({ user: { id: 'u_111' } }),
      username: jasmine.createSpy().and.returnValue('Alpha'),
    };
    realtimeStub = {
      ensureLobbyConnection: jasmine.createSpy().and.resolveTo(),
      activeLobbyCode: jasmine.createSpy().and.returnValue('STELLA1'),
      gameState: jasmine.createSpy().and.returnValue(createRealtimeState()),
      lobbyState: jasmine.createSpy().and.returnValue(null),
      lastError: jasmine.createSpy().and.returnValue(''),
      connectionStatus: jasmine.createSpy().and.returnValue('connected'),
      sendGameAction: jasmine.createSpy(),
    };

    stellaCardPullSpy.getCards.and.resolveTo(createCardsFixture(30));
    gamesPullSpy.getGameDetails.and.resolveTo(createLobbyFixture());
    routerSpy.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [DixitStella],
      providers: [
        { provide: StellaCardPull, useValue: stellaCardPullSpy },
        { provide: GamesPull, useValue: gamesPullSpy },
        { provide: Router, useValue: routerSpy },
        { provide: Auth, useValue: authStub },
        { provide: DixitRealtime, useValue: realtimeStub },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'STELLA1' }),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the realtime board from the Stella socket state', () => {
    expect(component).toBeTruthy();
    expect(realtimeStub.ensureLobbyConnection).toHaveBeenCalledOnceWith('STELLA1');
    expect(component.phase).toBe('STELLA_MARKING');
    expect(component.activeWord).toBe('Bosque Encantado');
    expect(component.boardCards.length).toBe(15);
    expect(component.players.length).toBe(4);
    expect(component.players[0]?.selectionCount).toBe(0);
    expect(component.players[1]?.selectionCount).toBe(2);
  });

  it('sends STELLA_SUBMIT_MARKS with the selected board ids', () => {
    component.onBoardCardClicked('1');
    component.onBoardCardClicked('2');
    component.onBoardCardClicked('3');

    component.submitSelection();

    expect(realtimeStub.sendGameAction).toHaveBeenCalledWith('STELLA_SUBMIT_MARKS', {
      cardIds: [1, 2, 3],
    });
  });

  it('sends STELLA_REVEAL_MARK when the current scout reveals a selected card', async () => {
    realtimeStub.gameState.and.returnValue(
      createRealtimeState({
        phase: 'STELLA_REVEAL',
        currentRound: {
          playerMarks: {
            u_111: [1, 2],
            u_222: [2],
            u_333: [3],
            u_444: [4],
          },
          revealedCards: [],
          currentScoutId: 'u_111',
        },
      })
    );

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.onBoardCardClicked('2');

    expect(realtimeStub.sendGameAction).toHaveBeenCalledWith('STELLA_REVEAL_MARK', {
      cardId: 2,
    });
  });
});

function createCardsFixture(count: number): DeckCard[] {
  return Array.from({ length: count }, (_, index) => {
    const cardId = index + 1;

    return {
      code: String(cardId),
      image: `https://picsum.photos/seed/test-${cardId}/480/720`,
      value: `Carta ${cardId}`,
      suit: 'Dream',
    };
  });
}

function createLobbyFixture(): Game {
  return {
    id: 'STELLA1',
    title: 'Sala Stella',
    description: 'Stella - 4/4 jugadores - Esperando jugadores - Publica',
    image: '/assets/Tablero.png',
    hostId: 'u_111',
    players: ['u_111', 'u_222', 'u_333', 'u_444'],
    playerCount: 4,
    maxPlayers: 4,
    engine: 'Stella',
    status: 'waiting',
    isPrivate: false,
  };
}

function createRealtimeState(
  overrides: {
    phase?: string;
    currentRound?: Partial<Record<string, unknown>>;
  } = {}
): { state: Record<string, unknown>; receivedAt: number } {
  return {
    receivedAt: 1,
    state: {
      lobbyCode: 'STELLA1',
      mode: 'STELLA',
      phase: overrides.phase ?? 'STELLA_MARKING',
      status: 'playing',
      players: ['u_111', 'u_222', 'u_333', 'u_444'],
      disconnectedPlayers: [],
      scores: {
        u_111: 0,
        u_222: 4,
        u_333: 2,
        u_444: 1,
      },
      currentRound: {
        word: 'Bosque Encantado',
        boardCards: Array.from({ length: 15 }, (_, index) => index + 1),
        playerMarks: {
          u_222: [1, 2],
        },
        revealedCards: [],
        currentScoutId: null,
        fallenPlayers: [],
        inTheDarkPlayerId: 'u_222',
        roundScores: {
          u_111: 0,
          u_222: 0,
          u_333: 0,
          u_444: 0,
        },
        successfulMarks: {
          u_111: 0,
          u_222: 0,
          u_333: 0,
          u_444: 0,
        },
        ...overrides.currentRound,
      },
    },
  };
}
