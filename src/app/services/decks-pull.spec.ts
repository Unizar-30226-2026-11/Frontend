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

  it('posts purchases and invalidates the relevant caches', async () => {
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
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/shop/items');
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/users/balance');
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/collections');
    expect(result).toEqual({
      itemId: 'item_deck_001',
      message: "Has comprado 'Mazo Aurora' exitosamente.",
      remainingCoins: 500,
    });
  });

  xit('filters blocked items out of the store catalog', async () => {
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

    const result: any = await service.getStoreCatalog();

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

  xit('returns the store catalog even if inventory loading fails', async () => {
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

    const result: any = await service.getStoreCatalog();

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

  it('maps the new store catalog response into sections', async () => {
    apiClientSpy.request.and.resolveTo({
      items: {
        singleCards: [
          {
            id_card: 'c_48',
            title: 'Carta 4-12',
            rarity: 'LEGENDARY',
            price: 3000,
            url_image: 'https://ejemplo.com/legendary.jpg',
            isPurchased: true,
          },
        ],
        cardPackOffer: {
          id_pack: 'pack_daily',
          name: 'Sobre Diario',
          cards: [
            {
              id_card: 'c_32',
              title: 'Carta 3-8',
              url_image: 'https://ejemplo.com/card-32.jpg',
            },
          ],
          card_ids: [32],
          description: '5 cartas con 25% de descuento',
          price: 1350,
          isPurchased: false,
        },
        collectionOffer: {
          id_collection: 'col_3',
          name: 'Coleccion 3',
          price: 6000,
          isPurchased: true,
        },
        boardOffer: {
          id_board: 'b_2',
          name: 'NEON',
          price: 2000,
          description: 'Un estilo futurista con luces vibrantes y efectos ciberpunk.',
          url_image: 'https://midominio.com/boards/stellar.png',
          isPurchased: false,
        },
        expiresAt: '2026-04-15T00:00:00.000Z',
      },
    });

    const result = await service.getStoreCatalog();

    expect(result.singleCards).toEqual([
      {
        id: 'c_48',
        type: 'singleCard',
        name: 'Carta 4-12',
        price: 3000,
        image: 'https://ejemplo.com/legendary.jpg',
        isPurchased: true,
        subtitle: 'legendary',
      },
    ]);
    expect(result.cardPackOffer).toEqual({
      id: 'pack_daily',
      type: 'cardPack',
      name: 'Sobre Diario',
      price: 1350,
      image: 'https://ejemplo.com/card-32.jpg',
      isPurchased: false,
      description: '5 cartas con 25% de descuento',
      subtitle: '1 cartas',
      cards: [
        {
          id: 'c_32',
          title: 'Carta 3-8',
          image: 'https://ejemplo.com/card-32.jpg',
        },
      ],
    });
    expect(result.collectionOffer).toEqual({
      id: 'col_3',
      type: 'collection',
      name: 'Coleccion 3',
      price: 6000,
      image: '/assets/Tablero.png',
      isPurchased: true,
      subtitle: 'Coleccion destacada',
    });
    expect(result.boardOffer).toEqual({
      id: 'b_2',
      type: 'board',
      name: 'NEON',
      price: 2000,
      image: 'https://midominio.com/boards/stellar.png',
      isPurchased: false,
      subtitle: 'Tablero exclusivo',
      description: 'Un estilo futurista con luces vibrantes y efectos ciberpunk.',
    });
    expect(result.expiresAt).toBe('2026-04-15T00:00:00.000Z');
  });

  it('returns the requested pack when it is present in the catalog', async () => {
    apiClientSpy.request.and.resolveTo({
      items: {
        singleCards: [],
        cardPackOffer: {
          id_pack: 'pack_daily',
          name: 'Sobre Diario',
          cards: [
            {
              id_card: 'c_32',
              title: 'Carta 3-8',
              url_image: 'https://ejemplo.com/card-32.jpg',
            },
          ],
          card_ids: [32],
          description: '5 cartas con 25% de descuento',
          price: 1350,
          isPurchased: true,
        },
      },
    });

    const result = await service.getPackOffer('pack_daily');

    expect(result?.id).toBe('pack_daily');
    expect(result?.isPurchased).toBeTrue();
    expect(result?.cards).toEqual([
      {
        id: 'c_32',
        title: 'Carta 3-8',
        image: 'https://ejemplo.com/card-32.jpg',
      },
    ]);
  });
});
