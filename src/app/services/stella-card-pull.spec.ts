import { TestBed } from '@angular/core/testing';

import { CardPull } from './card-pull';
import { StellaCardPull } from './stella-card-pull';

describe('StellaCardPull', () => {
  let service: StellaCardPull;
  let cardPullSpy: jasmine.SpyObj<CardPull>;

  beforeEach(() => {
    cardPullSpy = jasmine.createSpyObj<CardPull>('CardPull', ['getCards']);
    cardPullSpy.getCards.and.resolveTo(
      Array.from({ length: 30 }, (_, index) => ({
        code: index === 0 ? 'AS' : index === 29 ? '8H' : `CARD_${index + 1}`,
        image: `/assets/card-${index + 1}.png`,
        value: `Carta ${index + 1}`,
        suit: 'STELLA',
      }))
    );

    TestBed.configureTestingModule({
      providers: [{ provide: CardPull, useValue: cardPullSpy }],
    });
    service = TestBed.inject(StellaCardPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns enough cards for the Stella board and replacements', async () => {
    const cards = await service.getCards();

    expect(cardPullSpy.getCards).toHaveBeenCalledOnceWith(30);
    expect(cards.length).toBe(30);
    expect(cards[0].code).toBe('AS');
    expect(cards[29].code).toBe('8H');
  });
});
