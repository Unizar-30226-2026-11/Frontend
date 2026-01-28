import { TestBed } from '@angular/core/testing';

import { GamesPull } from './games-pull';

describe('GamesPull', () => {
  let service: GamesPull;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GamesPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
