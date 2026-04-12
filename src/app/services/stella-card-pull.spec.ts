import { TestBed } from '@angular/core/testing';

import { StellaCardPull } from './stella-card-pull';

describe('StellaCardPull', () => {
  let service: StellaCardPull;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StellaCardPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns enough cards for the Stella board and replacements', async () => {
    const cards = await service.getCards();

    expect(cards.length).toBe(30);
    expect(cards[0].code).toBe('AS');
    expect(cards[29].code).toBe('8H');
  });
});
