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
});
