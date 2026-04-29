import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';

import { Dixit } from './dixit';
import { Auth } from '../services/auth';
import { CardPull, DeckCard } from '../services/card-pull';
import { DixitRealtime } from '../services/dixit-realtime';

describe('Dixit', () => {
  let component: Dixit;
  let fixture: ComponentFixture<Dixit>;
  let cardPullSpy: jasmine.SpyObj<CardPull>;
  let realtimeSpy: jasmine.SpyObj<DixitRealtime>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    cardPullSpy = jasmine.createSpyObj<CardPull>('CardPull', ['getCards']);
    cardPullSpy.getCards.and.resolveTo(createCardsFixture());
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    realtimeSpy = jasmine.createSpyObj<DixitRealtime>('DixitRealtime', [
      'ensureLobbyConnection',
      'sendGameAction',
      'endGame',
      'disconnect',
      'sendMinigameScore',
      'lobbyState',
      'gameState',
      'gameEndedResult',
      'walletUpdated',
      'privateHand',
      'duelChallenge',
      'activeStar',
      'starClaim',
      'clearStarClaim',
      'clearGameEndedResult',
      'activeLobbyCode',
      'lastError',
      'connectionStatus',
      'chatMessages',
      'minigameStart',
      'specialEvent',
      'clearSpecialEvent',
      'clearMinigameStart',
      'clearDuelChallenge',
    ]);
    realtimeSpy.ensureLobbyConnection.and.resolveTo();
    realtimeSpy.lobbyState.and.returnValue(null);
    realtimeSpy.gameState.and.returnValue(null);
    realtimeSpy.gameEndedResult.and.returnValue(null);
    realtimeSpy.walletUpdated.and.returnValue(null);
    realtimeSpy.privateHand.and.returnValue(null);
    realtimeSpy.duelChallenge.and.returnValue(null);
    realtimeSpy.activeStar.and.returnValue(null);
    realtimeSpy.starClaim.and.returnValue(null);
    realtimeSpy.activeLobbyCode.and.returnValue('A1B2');
    realtimeSpy.lastError.and.returnValue('');
    realtimeSpy.connectionStatus.and.returnValue('connected');
    realtimeSpy.chatMessages.and.returnValue([]);
    realtimeSpy.minigameStart.and.returnValue(null);
    realtimeSpy.specialEvent.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [Dixit],
      providers: [
        { provide: CardPull, useValue: cardPullSpy },
        { provide: DixitRealtime, useValue: realtimeSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: Auth,
          useValue: {
            session: () => ({ user: { id: 'u_self' } }),
            username: () => 'Jugador test',
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'A1B2' }),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dixit);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create and load the room id', async () => {
    await initializeComponent(fixture);

    expect(component).toBeTruthy();
    expect(component.id).toBe('A1B2');
    expect(component.phase).toBe('hand');
    expect(realtimeSpy.ensureLobbyConnection).toHaveBeenCalledOnceWith('A1B2');
  });

  it('updates the phase from state.phase when the server switches to voting', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'voting',
        currentRound: {
          clue: 'Una pista real',
        },
      },
      receivedAt: Date.now(),
    });

    expect(component.phase).toBe('choice');
    expect(component.pointsStage).toBe('waiting');
  });

  it('updates the points stage from state.phase when the server switches to ranking', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'ranking',
      },
      receivedAt: Date.now(),
    });

    expect(component.phase).toBe('points');
    expect(component.pointsStage).toBe('ranking');
  });

  it('hydrates players and scores from state player ids plus state.scores', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeLobbyState']({
      id: 'lobby-1',
      code: 'A1B2',
      hostId: 'u_18',
      players: [
        { id: 'u_18', username: 'Ada' },
        { id: 'u_19', username: 'Bruno' },
        { id: 'u_53', username: 'Carla' },
      ],
    });

    component['applyRealtimeGameState']({
      state: {
        players: ['u_18', 'u_19', 'u_53'],
        scores: {
          u_18: 4,
          u_19: 1,
          u_53: 7,
        },
        currentRound: {},
      },
      receivedAt: Date.now(),
    });

    expect(component.playerRows.map((player) => player.name)).toEqual(['Ada', 'Bruno', 'Carla']);
    expect(component.playerRows.map((player) => player.points)).toEqual([4, 1, 7]);
    expect(component.boardTokens.map((token) => ({ id: token.id, position: token.position }))).toEqual([
      { id: 'u_18', position: 4 },
      { id: 'u_19', position: 1 },
      { id: 'u_53', position: 7 },
    ]);
  });

  it('requests game end when the server marks the match as finished', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'FINISHED',
      },
      receivedAt: Date.now(),
    });

    expect(component.phase).toBe('finished');
    expect(realtimeSpy.endGame).toHaveBeenCalledTimes(1);
  });

  it('shows the final overlay data after server:game:ended and wallet update', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameEnded']({
      ranking: [
        { playerId: 'cpu_1', points: 16, place: 1, coinsEarned: 50 },
        { playerId: 'u_self', points: 14, place: 2, coinsEarned: 35 },
      ],
      receivedAt: Date.now(),
    });
    component['applyRealtimeWalletUpdated']({
      balance: 285,
      receivedAt: Date.now(),
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(component.phase).toBe('finished');
    expect(component.finalOverlayTitle).toContain('2');
    expect(text).toContain('+35');
    expect(text).toContain('Saldo total actualizado: 285 monedas.');
  });

  it('opens the mapped minigame overlay when a realtime minigame starts', async () => {
    await initializeComponent(fixture);

    component.activeDuelChallenge = {
      challengerId: 'cpu_1',
      receivedAt: Date.now(),
    };

    component['applyRealtimeMinigameStart']({
      player1: 'u_self',
      player2: 'cpu_1',
      type: 0,
      isDuel: false,
      duration: 15_000,
      receivedAt: Date.now(),
    });
    fixture.detectChanges();

    expect(component.activeDuelChallenge).toBeNull();
    expect(component.isMinigame1Open).toBeTrue();
    expect(component.isMinigame2Open).toBeFalse();
    expect(fixture.nativeElement.textContent as string).toContain('Golpea al topo');
  });

  it('closes the minigame overlay when the active conflict is cancelled', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeMinigameStart']({
      player1: 'u_self',
      player2: 'cpu_1',
      type: 1,
      isDuel: true,
      duration: 15_000,
      receivedAt: Date.now(),
    });
    fixture.detectChanges();

    component['closeActiveMinigame']();
    fixture.detectChanges();

    expect(component.isMinigame1Open).toBeFalse();
    expect(component.isMinigame2Open).toBeFalse();
  });

  it('uses currentRound.boardCards during voting and renders the vote view even without a hand', async () => {
    await initializeComponent(fixture);

    component.cards = [];
    component['applyRealtimeGameState']({
      state: {
        phase: 'VOTING',
        currentRound: {
          clue: 'El cielo infinito',
          boardCards: [17, 42, 89, 5],
          playedCards: {
            u_self: 42,
          },
        },
      },
      receivedAt: Date.now(),
    });
    fixture.detectChanges();

    expect(component.phase).toBe('choice');
    expect(component.choiceCards.map((card) => card.code)).toEqual(['17', '42', '89', '5']);
    expect(component.currentPlayerPlayedCardCode).toBe('42');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Votacion');
    expect(text).toContain('Tu carta');
    expect(text).not.toContain('Esperando a que el servidor envie tu mano.');
  });

  it('uses currentRound.boardCardsDetailed image urls during voting when the backend sends detailed board metadata', async () => {
    await initializeComponent(fixture);

    component.cards = [];
    component['applyRealtimeGameState']({
      state: {
        phase: 'VOTING',
        currentRound: {
          boardCards: [17, 42, 89, 5],
          boardCardsDetailed: [
            { id: 'c_17', url_image: 'https://cdn.example.com/card-17.webp', name: 'Carta 17' },
            { id: 'c_42', url_image: 'https://cdn.example.com/card-42.webp', name: 'Carta 42' },
            { id: 'c_89', url_image: 'https://cdn.example.com/card-89.webp', name: 'Carta 89' },
            { id: 'c_5', url_image: 'https://cdn.example.com/card-5.webp', name: 'Carta 5' },
          ],
          playedCards: {
            u_self: 42,
          },
        },
      },
      receivedAt: Date.now(),
    });
    fixture.detectChanges();

    expect(component.phase).toBe('choice');
    expect(component.choiceCards.map((card) => card.code)).toEqual(['c_17', 'c_42', 'c_89', 'c_5']);
    expect(component.choiceCards[0]?.image).toBe('https://cdn.example.com/card-17.webp');
    expect(component.choiceCards[1]?.image).toBe('https://cdn.example.com/card-42.webp');
    expect(component.currentPlayerPlayedCardCode).toBe('c_42');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Tu carta');
  });

  it('does not allow selecting your own board card during voting', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'VOTING',
        currentRound: {
          boardCards: [17, 42, 89],
          playedCards: {
            u_self: 42,
          },
        },
      },
      receivedAt: Date.now(),
    });

    component.onChoiceCardSelected(component.choiceCards[1]);

    expect(component.selectedChoiceCardCode).toBe('');
  });

  it('does not allow selecting your own board card when the board uses prefixed codes and playedCards uses numbers', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'VOTING',
        currentRound: {
          boardCards: [17, 42, 89],
          boardCardsDetailed: [
            { id: 'c_17', url_image: 'https://cdn.example.com/card-17.webp', name: 'Carta 17' },
            { id: 'c_42', url_image: 'https://cdn.example.com/card-42.webp', name: 'Carta 42' },
            { id: 'c_89', url_image: 'https://cdn.example.com/card-89.webp', name: 'Carta 89' },
          ],
          playedCards: {
            u_self: 42,
          },
        },
      },
      receivedAt: Date.now(),
    });

    component.onChoiceCardSelected(component.choiceCards[1]);

    expect(component.currentPlayerPlayedCardCode).toBe('c_42');
    expect(component.selectedChoiceCardCode).toBe('');
  });

  it('restores the selected vote from currentRound.selectedVoteCardId using the displayed board code', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'VOTING',
        currentRound: {
          boardCards: [17, 42, 89],
          boardCardsDetailed: [
            { id: 'c_17', url_image: 'https://cdn.example.com/card-17.webp', name: 'Carta 17' },
            { id: 'c_42', url_image: 'https://cdn.example.com/card-42.webp', name: 'Carta 42' },
            { id: 'c_89', url_image: 'https://cdn.example.com/card-89.webp', name: 'Carta 89' },
          ],
          playedCards: {
            u_self: 17,
          },
          selectedVoteCardId: 'c_42',
        },
      },
      lastAction: 'SESSION_RECOVERED',
      receivedAt: Date.now(),
    });

    expect(component.selectedChoiceCardCode).toBe('c_42');
    expect(component.voteSubmitted).toBeTrue();
  });

  it('does not send a vote for the current player own card', async () => {
    await initializeComponent(fixture);

    component.phase = 'choice';
    component.currentPlayerPlayedCardCode = 'c_101';
    component.selectedChoiceCardCode = 'c_101';

    component.submitVoteSelection();

    expect(realtimeSpy.sendGameAction).not.toHaveBeenCalled();
    expect(component.voteSubmitted).toBeFalse();
  });

  it('selects a hand card and reflects it in the UI', async () => {
    await initializeComponent(fixture);

    component.onHandCardSelected(component.cards[1]);

    expect(component.selectedHandCardCode).toBe('c_102');

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Seleccionada: c_102');
  });

  it('reads the storyteller from currentRound and submits the clue separately', async () => {
    realtimeSpy.gameState.and.returnValue({
      state: {
        currentRound: {
          storytellerId: 'u_self',
        },
      },
      receivedAt: Date.now(),
    });

    await initializeComponent(fixture);

    component.onHandCardSelected(component.cards[0]);
    component.updateClueDraft('Una pista real');
    component.submitStoryClue();

    expect(component.isCurrentPlayerStoryteller).toBeTrue();
    expect(realtimeSpy.sendGameAction).toHaveBeenCalledWith('SEND_STORY', {
      cardId: 'c_101',
      clue: 'Una pista real',
    });
    expect(component.handSubmitted).toBeTrue();
  });

  it('does not allow sending cards until a clue exists', async () => {
    await initializeComponent(fixture);

    component.onHandCardSelected(component.cards[0]);

    expect(component.currentClue).toBe('');
    expect(component.isHandSubmitDisabled).toBeTrue();
  });

  it('submits the backend cardId from private_hand when the payload also includes an internal id', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'SUBMISSION',
        currentRound: {
          storytellerId: 'cpu_1',
          clue: 'Una pista real',
        },
      },
      receivedAt: Date.now(),
    });
    component['applyRealtimePrivateHand']([
      { id: 999, cardId: 17, url_image: 'https://cdn.example.com/card-17.webp' },
    ]);

    component.onHandCardSelected(component.cards[0]);
    component.submitHandSelection();

    expect(component.selectedHandCardCode).toBe('17');
    expect(realtimeSpy.sendGameAction).toHaveBeenCalledWith('SUBMIT_CARD', {
      cardId: 17,
    });
  });

  it('keeps the same rendered hand entries when private_hand arrives with the same cards', async () => {
    await initializeComponent(fixture);

    component['applyRealtimePrivateHand']([17, 42]);
    const previousCards = component.cards;
    const previousFirstCard = component.cards[0];

    const changed = component['applyRealtimePrivateHand']([17, 42]);

    expect(changed).toBeFalse();
    expect(component.cards).toBe(previousCards);
    expect(component.cards[0]).toBe(previousFirstCard);
  });

  it('keeps the same rendered hand entry when the backend resends the same card with a different image URL', async () => {
    await initializeComponent(fixture);

    component['applyRealtimePrivateHand']([
      { cardId: 17, url_image: 'https://cdn.example.com/card-17-a.webp', name: 'Carta 17' },
    ]);
    const previousCards = component.cards;
    const previousFirstCard = component.cards[0];

    const changed = component['applyRealtimePrivateHand']([
      { cardId: 17, url_image: 'https://cdn.example.com/card-17-b.webp', name: 'Carta 17' },
    ]);

    expect(changed).toBeFalse();
    expect(component.cards).toBe(previousCards);
    expect(component.cards[0]).toBe(previousFirstCard);
  });

  it('removes only the submitted card from the visible hand without rebuilding the rest', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'SUBMISSION',
        currentRound: {
          storytellerId: 'cpu_1',
          clue: 'Una pista real',
        },
      },
      receivedAt: Date.now(),
    });

    const previousSecondCard = component.cards[1];
    const previousThirdCard = component.cards[2];

    component.onHandCardSelected(component.cards[0]);
    component.submitHandSelection();

    expect(component.cards.map((card) => card.code)).toEqual(['c_102', 'c_103']);
    expect(component.cards[0]).toBe(previousSecondCard);
    expect(component.cards[1]).toBe(previousThirdCard);
  });

  it('keeps a submitted card hidden even if the same private_hand payload is received again', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'SUBMISSION',
        currentRound: {
          storytellerId: 'cpu_1',
          clue: 'Una pista real',
        },
      },
      receivedAt: Date.now(),
    });
    component['applyRealtimePrivateHand']([17, 42]);

    component.onHandCardSelected(component.cards[0]);
    component.submitHandSelection();
    component['applyRealtimePrivateHand']([17, 42]);

    expect(component.cards.map((card) => card.code)).toEqual(['42']);
  });

  it('submits the selected vote through the realtime service', async () => {
    await initializeComponent(fixture);

    component.onHandCardSelected(component.cards[0]);
    component.simulateChoicePhaseOpened();

    component.onChoiceCardSelected(component.choiceCards[1]);
    component.submitVoteSelection();

    expect(realtimeSpy.sendGameAction).toHaveBeenCalledOnceWith('CAST_VOTE', {
      cardId: 'c_102',
    });
    expect(component.voteSubmitted).toBeTrue();
  });

  it('sends the local minigame score to the realtime service when the minigame ends', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeMinigameStart']({
      player1: 'u_self',
      player2: 'cpu_1',
      type: 0,
      isDuel: false,
      duration: 15_000,
      receivedAt: Date.now(),
    });

    component.onMinigameFinished({ score: 250 });

    expect(realtimeSpy.sendMinigameScore).toHaveBeenCalledOnceWith(250);
    expect(component.minigameUiState).toBe('waiting');
    expect(component.minigameStatusMessage).toBe('Puntuacion enviada. Esperando al rival...');
  });

  it('uses scoring phase data to reveal cards and ranking instead of waiting for votes', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'SCORING',
        scores: {
          u_self: 3,
          cpu_1: 5,
          cpu_2: 2,
        },
        currentRound: {
          storytellerId: 'cpu_1',
          storytellerCardId: '17',
          playedCards: {
            u_self: 42,
            cpu_1: 17,
            cpu_2: 89,
          },
          votes: [
            { voterId: 'u_self', targetCardId: 17 },
            { voterId: 'cpu_2', targetCardId: 17 },
          ],
        },
      },
      receivedAt: Date.now(),
    });

    expect(component.phase).toBe('points');
    expect(component.pointsStage).toBe('reveal');
    expect(component.pointsRevealedCards.length).toBe(3);
    expect(component.pointsRanking[0].playerId).toBe('cpu_1');
  });

  it('uses currentRound.boardCardsDetailed image urls during revealed scoring', async () => {
    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'SCORING',
        scores: {
          u_self: 3,
          cpu_1: 5,
          cpu_2: 2,
        },
        currentRound: {
          storytellerId: 'cpu_1',
          storytellerCardId: 17,
          boardCards: [17, 42, 89],
          boardCardsDetailed: [
            { id: 'c_17', url_image: 'https://cdn.example.com/revealed-17.webp' },
            { id: 'c_42', url_image: 'https://cdn.example.com/revealed-42.webp' },
            { id: 'c_89', url_image: 'https://cdn.example.com/revealed-89.webp' },
          ],
          playedCards: {
            u_self: 42,
            cpu_1: 17,
            cpu_2: 89,
          },
          votes: [
            { voterId: 'u_self', targetCardId: 17 },
            { voterId: 'cpu_2', targetCardId: 17 },
          ],
        },
      },
      receivedAt: Date.now(),
    });

    expect(component.pointsRevealedCards.map((entry) => entry.card.image)).toEqual([
      'https://cdn.example.com/revealed-17.webp',
      'https://cdn.example.com/revealed-42.webp',
      'https://cdn.example.com/revealed-89.webp',
    ]);
  });

  it('asks the host to advance automatically after scoring', async () => {
    vi.useFakeTimers();
    realtimeSpy.lobbyState.and.returnValue({
      id: 'lobby-1',
      code: 'A1B2',
      hostId: 'u_self',
      players: [],
    });

    await initializeComponent(fixture);

    component['applyRealtimeGameState']({
      state: {
        phase: 'SCORING',
        scores: {
          u_self: 3,
        },
        currentRound: {
          storytellerId: 'cpu_1',
          storytellerCardId: '17',
          playedCards: {
            u_self: 42,
            cpu_1: 17,
          },
        },
      },
      receivedAt: Date.now(),
    });

    await vi.advanceTimersByTimeAsync(9000);

    expect(realtimeSpy.sendGameAction).toHaveBeenCalledWith('NEXT_ROUND');
  });

  it('clears scoring presentation when a recovered hand state for the next round arrives', async () => {
    await initializeComponent(fixture);

    component.pointsStage = 'reveal';
    component.pointsVotesReceived = 2;
    component.pointsVotesTotal = 2;
    component.pointsRevealedCards = [
      {
        card: createCardsFixture()[0],
        ownerName: 'Jugador test',
        votes: 1,
      },
    ];
    component.pointsRanking = [
      {
        playerId: 'u_self',
        playerName: 'Jugador test',
        pointsBefore: 0,
        pointsEarned: 3,
        totalPoints: 3,
      },
    ];
    component.selectedChoiceCardCode = '17';
    component.voteSubmitted = true;
    component.phase = 'points';
    component.roundNumber = 1;

    component['applyRealtimeGameState']({
      state: {
        phase: 'HAND',
        roundNumber: 2,
        currentRound: {
          clue: '',
        },
      },
      lastAction: 'SESSION_RECOVERED',
      receivedAt: Date.now(),
    });

    expect(component.phase).toBe('hand');
    expect(component.roundNumber).toBe(2);
    expect(component.pointsVotesReceived).toBe(0);
    expect(component.pointsVotesTotal).toBe(0);
    expect(component.pointsRevealedCards).toEqual([]);
    expect(component.pointsRanking).toEqual([]);
    expect(component.selectedChoiceCardCode).toBe('');
    expect(component.voteSubmitted).toBeFalse();
  });

  it('returns to the first storytelling step after scoring when the next hand has no clue yet', async () => {
    realtimeSpy.gameState.and.returnValue({
      state: {
        currentRound: {
          storytellerId: 'u_self',
          clue: 'Pista vieja',
        },
      },
      receivedAt: Date.now() - 1,
    });

    await initializeComponent(fixture);

    component.phase = 'points';
    component.pointsStage = 'reveal';
    component.handSubmitted = true;
    component.selectedHandCardCode = 'c_101';
    component.storySubmitted = true;
    component.clueDraft = 'Pista vieja';
    component.currentClue = 'Pista vieja';

    component['applyRealtimeGameState']({
      state: {
        phase: 'STORYTELLING',
        roundNumber: 2,
        currentRound: {
          storytellerId: 'u_self',
        },
      },
      lastAction: 'SESSION_RECOVERED',
      receivedAt: Date.now(),
    });

    expect(component.phase).toBe('hand');
    expect(component.isCurrentPlayerStoryteller).toBeTrue();
    expect(component.currentClue).toBe('');
    expect(component.storySubmitted).toBeFalse();
    expect(component.handSubmitted).toBeFalse();
    expect(component.selectedHandCardCode).toBe('');
    expect(component.clueDraft).toBe('');
  });

  it('advances automatically from reveal to ranking after 3 seconds', async () => {
    vi.useFakeTimers();
    await initializeComponent(fixture);

    component.onHandCardSelected(component.cards[0]);
    component.simulateChoicePhaseOpened();
    component.onChoiceCardSelected(component.choiceCards[1]);
    component.submitVoteSelection();
    component.simulatePointsPhaseOpened();
    component.simulateAllVotesReceived();

    const positionsBeforeReveal = component.boardTokens.map((token) => token.position);

    component.simulateResultsReveal();

    expect(component.pointsStage).toBe('reveal');

    await vi.advanceTimersByTimeAsync(3000);

    expect(component.pointsStage).toBe('ranking');
    expect(component.boardTokens.map((token) => token.position)).not.toEqual(positionsBeforeReveal);
  });

  it('prepares the next round from the ranking state', async () => {
    await initializeComponent(fixture);

    component.onHandCardSelected(component.cards[0]);
    component.simulateChoicePhaseOpened();
    component.onChoiceCardSelected(component.choiceCards[1]);
    component.submitVoteSelection();
    component.simulatePointsPhaseOpened();
    component.simulateAllVotesReceived();
    component.simulateResultsReveal();
    component.simulateRankingShown();

    component.prepareNextRound();

    expect(component.phase).toBe('hand');
    expect(component.roundNumber).toBe(2);
    expect(component.selectedHandCardCode).toBe('');
    expect(component.selectedChoiceCardCode).toBe('');
    expect(component.voteSubmitted).toBeFalse();
  });

  it('shows the realtime state panel in the simulation drawer', async () => {
    await initializeComponent(fixture);

    component.isSimulationDrawerOpen = true;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Simular casilla de duelo backend');
  });

  it('opens the rival picker for backend duel simulation', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.isSimulationDrawerOpen = true;
    fixture.detectChanges();

    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find((candidate) => (candidate.textContent as string).includes('Simular casilla de duelo backend')) as
      | HTMLButtonElement
      | undefined;

    expect(button).toBeDefined();
    button?.click();
    fixture.detectChanges();

    expect(component.activeDuelChallenge).not.toBeNull();
    expect(component.simulationTriggerMode).toBe('duel');
    expect(component.isSimulationDrawerOpen).toBeFalse();
  }));
});

async function initializeComponent(fixture: ComponentFixture<Dixit>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function createCardsFixture(): DeckCard[] {
  return [
    {
      code: 'c_101',
      image: '/assets/Tablero.png',
      value: 'Dragon de Fuego',
      suit: 'DIXIT',
    },
    {
      code: 'c_102',
      image: '/assets/Tablero.png',
      value: 'Bosque Invertido',
      suit: 'DIXIT',
    },
    {
      code: 'c_103',
      image: '/assets/Tablero.png',
      value: 'Reloj Sumergido',
      suit: 'DIXIT',
    },
  ];
}
