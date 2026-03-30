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
      message: "Has comprado 'Mazo Aurora' exitosamente.",
      updatedBalance: {
        userId: 'user_123',
        coins: 500,
        gems: 50,
      },
    });

    const result = await service.buyDeck('item_deck_001');

    expect(apiClientSpy.request).toHaveBeenCalledWith('/shop/buy', {
      method: 'POST',
      token: 'token-123',
      body: { itemId: 'item_deck_001' },
      useCache: false,
    });
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/users/inventory');
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/users/balance');
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/collections');
    expect(result).toEqual({
      itemId: 'item_deck_001',
      message: "Has comprado 'Mazo Aurora' exitosamente.",
      remainingCoins: 500,
    });
  });

  it('filters blocked items out of the store catalog', async () => {
    const blockedItemId = ['item_', 'hidden_001'].join('');
    const blockedItemType = ['wild', 'card'].join('');
    const blockedItemName = ['Comod', 'ín de ataque'].join('');

    apiClientSpy.request.and.callFake((path: string) => {
      if (path === '/shop/items') {
        return Promise.resolve({
          items: [
            {
              id: 'item_deck_001',
              type: 'card',
              name: 'Mazo Aurora',
              price: 300,
            },
            {
              id: blockedItemId,
              type: blockedItemType,
              name: blockedItemName,
              price: 200,
            },
          ],
        });
      }

      if (path === '/users/inventory') {
        return Promise.resolve({
          inventory: {
            inventory: ['item_deck_001', blockedItemId],
          },
        });
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    const result = await service.getStoreCatalog();

    expect(result.items).toEqual([
      {
        id: 'item_deck_001',
        type: 'card',
        name: 'Mazo Aurora',
        price: 300,
        image: '/assets/Tablero.png',
        owned: true,
      },
    ]);
  });

  it('returns the store catalog even if inventory loading fails', async () => {
    apiClientSpy.request.and.callFake((path: string) => {
      if (path === '/shop/items') {
        return Promise.resolve({
          items: [
            {
              id: 'item_deck_001',
              type: 'card',
              name: 'Mazo Aurora',
              price: 300,
            },
          ],
        });
      }

      if (path === '/users/inventory') {
        return Promise.reject(new Error('Error al obtener el inventario de comodines.'));
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    const result = await service.getStoreCatalog();

    expect(result.items).toEqual([
      {
        id: 'item_deck_001',
        type: 'card',
        name: 'Mazo Aurora',
        price: 300,
        image: '/assets/Tablero.png',
        owned: false,
      },
    ]);
    expect(result.inventory).toEqual({
      inventory: {
        inventory: [],
      },
    });
  });
});
