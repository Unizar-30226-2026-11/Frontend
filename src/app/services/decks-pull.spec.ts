import { TestBed } from '@angular/core/testing';

import { Auth } from './auth';
import { ApiClient } from './api-client';
import { DecksPull } from './decks-pull';

describe('DecksPull', () => {
  let service: DecksPull;
  let apiClientSpy: jasmine.SpyObj<ApiClient>;

  beforeEach(() => {
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', ['request', 'invalidateCache']);

    TestBed.configureTestingModule({
      providers: [
        DecksPull,
        { provide: ApiClient, useValue: apiClientSpy },
        {
          provide: Auth,
          useValue: {
            token: () => 'token-123',
          },
        },
      ],
    });

    service = TestBed.inject(DecksPull);
  });

  it('posts purchases and invalidates balance, inventory and collection caches', async () => {
    apiClientSpy.request.and.resolveTo({
      message: "Has comprado 'Comodin de ataque' exitosamente.",
      updatedBalance: {
        userId: 'user_123',
        coins: 500,
        gems: 50,
      },
    });

    const result = await service.buyDeck('item_wildcard_001');

    expect(apiClientSpy.request).toHaveBeenCalledWith('/shop/buy', {
      method: 'POST',
      token: 'token-123',
      body: { itemId: 'item_wildcard_001' },
      useCache: false,
    });
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/users/inventory');
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/users/balance');
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/collections');
    expect(result).toEqual({
      itemId: 'item_wildcard_001',
      message: "Has comprado 'Comodin de ataque' exitosamente.",
      remainingCoins: 500,
    });
  });
});
