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

  it('should create', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component).toBeTruthy();
    expect(component.id).toBe('A1B2');

    component.ngOnDestroy();
  }));

  it('transitions from hand to choice and then to points', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.onHandCardSelected(component.cards[0]);
    component.continueFromHandPhase();
    tick(component.phaseTransitionDurationMs);

    expect(component.phase).toBe('choice');

    component.onChoiceConfirmed(component.choiceCards[1]);
    tick(component.phaseTransitionDurationMs);

    expect(component.phase).toBe('points');
    expect(component.pointsWaitingVotes).toBeTrue();

    component.ngOnDestroy();
  }));

  it('prepares the next round after showing the ranking', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.onHandCardSelected(component.cards[0]);
    component.continueFromHandPhase();
    tick(component.phaseTransitionDurationMs);

    component.onChoiceConfirmed(component.choiceCards[1]);
    tick(component.phaseTransitionDurationMs);

    component.onPointsSkipWaitingRequested();
    component.onPointsRankingRequested();
    component.prepareNextRound();
    tick(component.phaseTransitionDurationMs);

    expect(component.phase).toBe('hand');
    expect(component.roundNumber).toBe(2);
    expect(component.selectedHandCardCode).toBe('');
    expect(component.selectedChoiceCardCode).toBe('');

    component.ngOnDestroy();
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
