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
      'activeLobbyCode',
      'lastError',
      'connectionStatus',
      'chatMessages',
    ]);
    realtimeSpy.ensureLobbyConnection.and.resolveTo();
    realtimeSpy.lobbyState.and.returnValue(null);
    realtimeSpy.gameState.and.returnValue(null);
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

  it('selects a hand card when dropped into the board zone', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.onHandCardDragStart(component.cards[1]);
    component.onDropZoneDrop(createDragDropEvent('KH'));

    expect(component.selectedHandCardCode).toBe('KH');

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Seleccionada: KH');
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
      cardId: 'AS',
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

    expect(realtimeSpy.sendGameAction).toHaveBeenCalledOnceWith('VOTE_CARD', {
      cardCode: 'KH',
      cardId: 'KH',
    });
    expect(component.voteSubmitted).toBeTrue();
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
      code: 'AS',
      image: 'https://deckofcardsapi.com/static/img/AS.png',
      value: 'ACE',
      suit: 'SPADES',
    },
    {
      code: 'KH',
      image: 'https://deckofcardsapi.com/static/img/KH.png',
      value: 'KING',
      suit: 'HEARTS',
    },
    {
      code: 'QD',
      image: 'https://deckofcardsapi.com/static/img/QD.png',
      value: 'QUEEN',
      suit: 'DIAMONDS',
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
