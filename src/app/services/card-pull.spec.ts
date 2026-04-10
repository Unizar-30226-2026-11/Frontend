import { TestBed } from '@angular/core/testing';

import { CardPull } from './card-pull';

describe('CardPull', () => {
  let service: CardPull;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CardPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns 6 demo cards by default', async () => {
    const cards = await service.getCards();

    expect(cards.length).toBe(6);
    expect(cards.map((card) => card.code)).toEqual(['AS', 'AH', 'AD', 'AC', 'KS', 'KH']);
  });

  it('limits the demo cards when a count is provided', async () => {
    const cards = await service.getCards(3);

    expect(cards.length).toBe(3);
    expect(cards.map((card) => card.code)).toEqual(['AS', 'AH', 'AD']);
  });

  it('returns enough poker cards for the Stella board and row replacements', async () => {
    const cards = await service.getCards(30);

    expect(cards.length).toBe(30);
    expect(cards[29].code).toBe('8H');
  });
});
