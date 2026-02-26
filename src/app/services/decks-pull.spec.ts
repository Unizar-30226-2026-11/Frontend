import { TestBed } from '@angular/core/testing';

import { DecksPull } from './decks-pull';

describe('DecksPull', () => {
  let service: DecksPull;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DecksPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
