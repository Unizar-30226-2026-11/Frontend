import { TestBed } from '@angular/core/testing';

import { PlayerInfoPull } from './player-info-pull';

describe('PlayerInfoPull', () => {
  let service: PlayerInfoPull;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlayerInfoPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
