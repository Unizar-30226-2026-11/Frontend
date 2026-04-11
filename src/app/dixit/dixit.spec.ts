import { fakeAsync, ComponentFixture, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { Dixit } from './dixit';
import { Auth } from '../services/auth';
import { CardPull, DeckCard } from '../services/card-pull';
import { DixitRealtime } from '../services/dixit-realtime';

describe('Dixit', () => {
  let component: Dixit;
  let fixture: ComponentFixture<Dixit>;
  let cardPullSpy: jasmine.SpyObj<CardPull>;
  let realtimeSpy: jasmine.SpyObj<DixitRealtime>;

  beforeEach(async () => {
    cardPullSpy = jasmine.createSpyObj<CardPull>('CardPull', ['getCards']);
    cardPullSpy.getCards.and.resolveTo(createCardsFixture());
    realtimeSpy = jasmine.createSpyObj<DixitRealtime>('DixitRealtime', [
      'ensureLobbyConnection',
      'sendGameAction',
      'lobbyState',
      'gameState',
      'privateHand',
      'activeLobbyCode',
      'lastError',
      'connectionStatus',
      'chatMessages',
    ]);
    realtimeSpy.ensureLobbyConnection.and.resolveTo();
    realtimeSpy.lobbyState.and.returnValue(null);
    realtimeSpy.gameState.and.returnValue(null);
    realtimeSpy.privateHand.and.returnValue(null);
    realtimeSpy.activeLobbyCode.and.returnValue('A1B2');
    realtimeSpy.lastError.and.returnValue('');
    realtimeSpy.connectionStatus.and.returnValue('connected');
    realtimeSpy.chatMessages.and.returnValue([]);

    await TestBed.configureTestingModule({
      imports: [Dixit],
      providers: [
        { provide: CardPull, useValue: cardPullSpy },
        { provide: DixitRealtime, useValue: realtimeSpy },
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

  it('should create and load the room id', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component).toBeTruthy();
    expect(component.id).toBe('A1B2');
    expect(component.phase).toBe('hand');
    expect(realtimeSpy.ensureLobbyConnection).toHaveBeenCalledOnceWith('A1B2');
  }));

  it('updates the phase from state.phase when the server switches to voting', fakeAsync(() => {
    fixture.detectChanges();
    tick();

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
  }));

  it('updates the points stage from state.phase when the server switches to ranking', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component['applyRealtimeGameState']({
      state: {
        phase: 'ranking',
      },
      receivedAt: Date.now(),
    });

    expect(component.phase).toBe('points');
    expect(component.pointsStage).toBe('ranking');
  }));

  it('uses currentRound.boardCards during voting and renders the vote view even without a hand', fakeAsync(() => {
    fixture.detectChanges();
    tick();

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
  }));

  it('does not allow selecting your own board card during voting', fakeAsync(() => {
    fixture.detectChanges();
    tick();

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
  }));

  it('does not send a vote for the current player own card', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.phase = 'choice';
    component.currentPlayerPlayedCardCode = 'c_101';
    component.selectedChoiceCardCode = 'c_101';

    component.submitVoteSelection();

    expect(realtimeSpy.sendGameAction).not.toHaveBeenCalled();
    expect(component.voteSubmitted).toBeFalse();
  }));

  it('selects a hand card when dropped into the board zone', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.onHandCardDragStart(component.cards[1]);
    component.onDropZoneDrop(createDragDropEvent('c_102'));

    expect(component.selectedHandCardCode).toBe('c_102');

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Seleccionada: c_102');
  }));

  it('reads the storyteller from currentRound and submits the clue separately', fakeAsync(() => {
    realtimeSpy.gameState.and.returnValue({
      state: {
        currentRound: {
          storytellerId: 'u_self',
        },
      },
      receivedAt: Date.now(),
    });

    fixture.detectChanges();
    tick();

    component.onHandCardSelected(component.cards[0]);
    component.updateClueDraft('Una pista real');
    component.submitStoryClue();

    expect(component.isCurrentPlayerStoryteller).toBeTrue();
    expect(realtimeSpy.sendGameAction).toHaveBeenCalledWith('SEND_STORY', {
      cardId: 'c_101',
      clue: 'Una pista real',
    });
    expect(component.handSubmitted).toBeTrue();
  }));

  it('does not allow sending cards until a clue exists', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.onHandCardSelected(component.cards[0]);

    expect(component.currentClue).toBe('');
    expect(component.isHandSubmitDisabled).toBeTrue();
  }));

  it('submits the selected vote through the realtime service', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.onHandCardSelected(component.cards[0]);
    component.simulateChoicePhaseOpened();

    component.onChoiceCardSelected(component.choiceCards[1]);
    component.submitVoteSelection();

    expect(realtimeSpy.sendGameAction).toHaveBeenCalledOnceWith('CAST_VOTE', {
      cardId: 'c_102',
    });
    expect(component.voteSubmitted).toBeTrue();
  }));

  it('uses scoring phase data to reveal cards and ranking instead of waiting for votes', fakeAsync(() => {
    fixture.detectChanges();
    tick();

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
  }));

  it('asks the host to advance automatically after scoring', fakeAsync(() => {
    realtimeSpy.lobbyState.and.returnValue({
      id: 'lobby-1',
      code: 'A1B2',
      hostId: 'u_self',
      players: [],
    });

    fixture.detectChanges();
    tick();

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

    tick(5000);

    expect(realtimeSpy.sendGameAction).toHaveBeenCalledWith('NEXT_ROUND');
  }));

  it('clears scoring presentation when a recovered hand state for the next round arrives', fakeAsync(() => {
    fixture.detectChanges();
    tick();

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
  }));

  it('returns to the first storytelling step after scoring when the next hand has no clue yet', fakeAsync(() => {
    realtimeSpy.gameState.and.returnValue({
      state: {
        currentRound: {
          storytellerId: 'u_self',
          clue: 'Pista vieja',
        },
      },
      receivedAt: Date.now() - 1,
    });

    fixture.detectChanges();
    tick();

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
  }));

  it('advances automatically from reveal to ranking after 3 seconds', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.onHandCardSelected(component.cards[0]);
    component.simulateChoicePhaseOpened();
    component.onChoiceCardSelected(component.choiceCards[1]);
    component.submitVoteSelection();
    component.simulatePointsPhaseOpened();
    component.simulateAllVotesReceived();

    const positionsBeforeReveal = component.boardTokens.map((token) => token.position);

    component.simulateResultsReveal();

    expect(component.pointsStage).toBe('reveal');

    tick(3000);

    expect(component.pointsStage).toBe('ranking');
    expect(component.boardTokens.map((token) => token.position)).not.toEqual(positionsBeforeReveal);
  }));

  it('prepares the next round from the ranking state', fakeAsync(() => {
    fixture.detectChanges();
    tick();

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
  }));

  it('shows the minigame simulation button in the simulation drawer', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.isSimulationDrawerOpen = true;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Simular minijuego 1');
  }));
});

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

function createDragDropEvent(cardCode: string): DragEvent {
  return {
    preventDefault: () => undefined,
    dataTransfer: {
      getData: () => cardCode,
    },
  } as unknown as DragEvent;
}
