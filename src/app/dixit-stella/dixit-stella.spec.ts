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
  let realtimeStub: jasmine.SpyObj<DixitRealtime>;

  beforeEach(async () => {
    stellaCardPullSpy = jasmine.createSpyObj<StellaCardPull>('StellaCardPull', ['getCards']);
    gamesPullSpy = jasmine.createSpyObj<GamesPull>('GamesPull', ['getGameDetails']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    authStub = {
      session: jasmine.createSpy().and.returnValue({ user: { id: 'u_111' } }),
      username: jasmine.createSpy().and.returnValue('Alpha'),
    };
    realtimeStub = jasmine.createSpyObj<DixitRealtime>('DixitRealtime', [
      'ensureLobbyConnection',
      'activeLobbyCode',
      'gameState',
      'gameEndedResult',
      'lobbyState',
      'lastError',
      'connectionStatus',
      'privateHand',
      'sendGameAction',
      'sendMinigameScore',
      'minigameStart',
      'specialEvent',
      'activeStar',
      'starClaim',
      'clearStarClaim',
      'claimStar',
      'clearMinigameStart',
      'clearSpecialEvent',
      'endGame',
      'disconnect',
    ]);
    realtimeStub.ensureLobbyConnection.and.resolveTo();
    realtimeStub.activeLobbyCode.and.returnValue('STELLA1');
    realtimeStub.gameState.and.returnValue(createRealtimeState());
    realtimeStub.gameEndedResult.and.returnValue(null);
    realtimeStub.lobbyState.and.returnValue(null);
    realtimeStub.lastError.and.returnValue('');
    realtimeStub.connectionStatus.and.returnValue('connected');
    realtimeStub.privateHand.and.returnValue(null);
    realtimeStub.minigameStart.and.returnValue(null);
    realtimeStub.specialEvent.and.returnValue(null);
    realtimeStub.activeStar.and.returnValue(null);
    realtimeStub.starClaim.and.returnValue(null);

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

  it('sends STELLA_REVEAL_MARK after the current scout selects and confirms a card', async () => {
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

    expect(realtimeStub.sendGameAction).not.toHaveBeenCalled();
    expect(component.isPendingRevealCard('2')).toBeTrue();
    expect(component.canSubmitRevealSelection).toBeTrue();

    component.submitRevealSelection();

    expect(realtimeStub.sendGameAction).toHaveBeenCalledWith('STELLA_REVEAL_MARK', {
      cardId: 2,
    });
  });

  it('uses boardCardsDetailed image urls when Stella sends numeric boardCards plus detailed metadata', async () => {
    realtimeStub.gameState.and.returnValue(
      createRealtimeState({
        currentRound: {
          boardCards: [112, 129, 94],
          boardCardsDetailed: [
            {
              id: 'c_112',
              url_image: 'https://cdn.example.com/stella-112.webp',
              name: 'Carta URL 112',
            },
            {
              id: 'c_129',
              url_image: 'https://cdn.example.com/stella-129.webp',
              name: 'Carta URL 129',
            },
            {
              id: 'c_94',
              url_image: 'https://cdn.example.com/stella-94.webp',
              name: 'Carta URL 94',
            },
          ],
        },
      })
    );

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.boardCards[0]).toEqual(
      jasmine.objectContaining({
        code: '112',
        image: 'https://cdn.example.com/stella-112.webp',
        value: 'Carta URL 112',
      })
    );
    expect(component.boardCards[1]).toEqual(
      jasmine.objectContaining({
        code: '129',
        image: 'https://cdn.example.com/stella-129.webp',
        value: 'Carta URL 129',
      })
    );
  });

  it('uses the board image from private_hand in the Stella track board', () => {
    component['applyRealtimePrivateHand']({
      lobbyCode: 'STELLA1',
      board: {
        id: 'b_6',
        name: 'Aurora',
        url_image: 'https://cdn.example.com/boards/stella-aurora.png',
      },
      hand: [{ id: 'c_31' }],
      receivedAt: 2,
    });

    expect(component.trackBoardImageUrl).toBe('https://cdn.example.com/boards/stella-aurora.png');
  });

  it('renders playerNames from realtime state as username plus id', async () => {
    realtimeStub.gameState.and.returnValue(
      createRealtimeState({
        playerNames: {
          u_111: 'probando',
          u_222: 'TesterFullUnlock',
        },
      })
    );

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.players[0]?.name).toBe('probando (u_111)');
    expect(component.players[1]?.name).toBe('TesterFullUnlock (u_222)');
  });

  it('reuses the classic minigame components when a realtime minigame starts in stella', async () => {
    realtimeStub.minigameStart.and.returnValue({
      player1: 'u_111',
      player2: 'u_222',
      type: 0,
      duration: 15_000,
      isDuel: false,
      receivedAt: 2,
    });

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.activeMinigameDurationMs).toBe(12_000);
    expect(component.isMinigameCountdownOpen).toBeTrue();
    expect(component.isMinigame1Open).toBeFalse();
    expect(component.isMinigame2Open).toBeFalse();
    expect(fixture.nativeElement.textContent as string).toContain('Prepárate para el minijuego en...');

    component.onMinigameCountdownFinished();
    fixture.detectChanges();

    expect(component.isMinigame1Open).toBeTrue();
    expect(fixture.nativeElement.textContent as string).toContain('Golpea al topo');
  });

  it('closes the local minigame view after sending the result in stella', async () => {
    realtimeStub.minigameStart.and.returnValue({
      player1: 'u_111',
      player2: 'u_222',
      type: 0,
      duration: 15_000,
      isDuel: false,
      receivedAt: 2,
    });

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    component.onMinigameFinished({ score: 99 });

    expect(realtimeStub.sendMinigameScore).toHaveBeenCalledOnceWith(99);
    expect(component.isMinigame1Open).toBeFalse();
    expect(component.isMinigame2Open).toBeFalse();
    expect(component.isMinigame3Open).toBeFalse();
    expect(component.minigameUiState).toBe('waiting');
  });

  it('maps realtime minigame type 2 to the third shared minigame in stella', async () => {
    realtimeStub.minigameStart.and.returnValue({
      player1: 'u_111',
      player2: 'u_222',
      type: 2,
      duration: 15_000,
      isDuel: false,
      receivedAt: 2,
    });

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.isMinigameCountdownOpen).toBeTrue();
    expect(component.isMinigame1Open).toBeFalse();
    expect(component.isMinigame2Open).toBeFalse();
    expect(component.isMinigame3Open).toBeFalse();

    component.onMinigameCountdownFinished();
    fixture.detectChanges();

    expect(component.isMinigame3Open).toBeTrue();
    expect(fixture.nativeElement.textContent as string).toContain('Recoge las manzanas');
  });

  it('shows the winner name when a stella minigame is resolved', () => {
    component.activeMinigame = {
      player1: 'u_111',
      player2: 'u_222',
      type: 0,
      duration: 15_000,
      isDuel: false,
      receivedAt: 2,
    };

    component['applyRealtimeSpecialEvent']({
      effect: 'CONFLICT_RESOLVED',
      message: 'u_222 gana el desempate.',
      winnerId: 'u_222',
      loserId: 'u_111',
      isDuel: false,
      receivedAt: 3,
    });
    fixture.detectChanges();

    expect(component.minigameUiState).toBe('lost');
    expect(component.minigameStatusMessage).toBe('Ganador: u_222.');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Derrota');
    expect(text).toContain('Ganador: u_222.');
    expect(fixture.nativeElement.querySelector('.minigame-result-backdrop')).not.toBeNull();
  });

  it('reuses the shared final overlay when the stella match is finished', async () => {
    realtimeStub.gameState.and.returnValue(
      createRealtimeState({
        phase: 'FINISHED',
        currentRound: {
          successfulMarks: {
            u_111: 3,
            u_222: 2,
            u_333: 1,
            u_444: 0,
          },
        },
      })
    );

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Fin de partida');
    expect(text).toContain('Alpha');
    expect(text).toContain('Volver a salas');
  });

  it('uses gameEndedResult to finalize Stella even if the last game_state was not FINISHED', async () => {
    realtimeStub.gameState.and.returnValue(createRealtimeState());
    realtimeStub.gameEndedResult.and.returnValue({
      winnerId: 'u_222',
      winnerName: 'Beta',
      ranking: [
        { playerId: 'u_222', points: 9, place: 1, coinsEarned: 50 },
        { playerId: 'u_111', points: 7, place: 2, coinsEarned: 35 },
      ],
      receivedAt: 3,
    });

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.phase).toBe('FINISHED');
    expect(component.finalWinners.map((player) => player.id)).toEqual(['u_222']);
    expect(component.players[0]?.score).toBe(9);
  });

  it('disconnects realtime before returning to the games list from the final overlay', () => {
    component.returnToGames();

    expect(realtimeStub.disconnect).toHaveBeenCalledOnceWith(false);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/games']);
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
    playerNames?: Record<string, string>;
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
      playerNames: overrides.playerNames ?? {},
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
