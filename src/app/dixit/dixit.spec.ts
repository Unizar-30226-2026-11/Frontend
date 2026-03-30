import { fakeAsync, ComponentFixture, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { Dixit } from './dixit';
import { CardPull, DeckCard } from '../services/card-pull';

describe('Dixit', () => {
  let component: Dixit;
  let fixture: ComponentFixture<Dixit>;
  let cardPullSpy: jasmine.SpyObj<CardPull>;

  beforeEach(async () => {
    cardPullSpy = jasmine.createSpyObj<CardPull>('CardPull', ['getCards']);
    cardPullSpy.getCards.and.resolveTo(createCardsFixture());

    await TestBed.configureTestingModule({
      imports: [Dixit],
      providers: [
        { provide: CardPull, useValue: cardPullSpy },
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

  it('progresses through the simulated websocket flow', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.onHandCardSelected(component.cards[0]);
    component.simulateChoicePhaseOpened();

    expect(component.phase).toBe('choice');

    component.onChoiceCardSelected(component.choiceCards[1]);
    component.submitVoteSelection();
    component.simulatePointsPhaseOpened();

    expect(component.phase).toBe('points');
    expect(component.pointsStage).toBe('waiting');
    expect(component.pointsVotesReceived).toBe(1);

    component.simulateAllVotesReceived();
    component.simulateResultsReveal();

    expect(component.pointsStage).toBe('reveal');
    expect(component.pointsRevealedCards.length).toBeGreaterThan(0);

    component.simulateRankingShown();

    expect(component.pointsStage).toBe('ranking');
    expect(component.pointsRanking.length).toBeGreaterThan(0);
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
