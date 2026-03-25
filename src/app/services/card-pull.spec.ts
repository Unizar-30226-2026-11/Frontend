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
    expect(cards.map((card) => card.code)).toEqual(['AS', 'KH', 'QD', 'JC', '0S', '7H']);
  });

  it('limits the demo cards when a count is provided', async () => {
    const cards = await service.getCards(3);

    expect(cards.length).toBe(3);
    expect(cards.map((card) => card.code)).toEqual(['AS', 'KH', 'QD']);
  });
});
