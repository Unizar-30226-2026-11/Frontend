import { TestBed } from '@angular/core/testing';

import { WordCardPull } from './word-card-pull';

describe('WordCardPull', () => {
  let service: WordCardPull;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WordCardPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns the requested number of word cards', async () => {
    const cards = await service.getCards(4);

    expect(cards.length).toBe(4);
    expect(cards[0].terms).toEqual(['Aurora', 'Espejo']);
    expect(cards[3].terms).toEqual(['Vertigo', 'Constelacion']);
  });
});
