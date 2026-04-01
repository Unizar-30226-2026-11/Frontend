import { TestBed } from '@angular/core/testing';

import { GamesPull } from './games-pull';
import { ApiClient } from './api-client';
import { Auth } from './auth';

describe('GamesPull', () => {
  let service: GamesPull;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GamesPull,
        {
          provide: ApiClient,
          useValue: jasmine.createSpyObj<ApiClient>('ApiClient', ['request', 'invalidateCache']),
        },
        {
          provide: Auth,
          useValue: {
            token: () => 'token-123',
          },
        },
      ],
    });
    service = TestBed.inject(GamesPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
