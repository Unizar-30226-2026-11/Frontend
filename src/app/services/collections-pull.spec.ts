import { TestBed } from '@angular/core/testing';

import { ApiClient } from './api-client';
import { Auth } from './auth';
import { CollectionsPull } from './collections-pull';

describe('CollectionsPull', () => {
  let service: CollectionsPull;
  let apiClientSpy: jasmine.SpyObj<ApiClient>;

  beforeEach(() => {
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', ['request']);

    TestBed.configureTestingModule({
      providers: [
        CollectionsPull,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: { token: () => 'demo-token' } },
      ],
    });

    service = TestBed.inject(CollectionsPull);
  });

  function queueResponses(...responses: unknown[]): void {
    let index = 0;
    apiClientSpy.request.and.callFake(async <T>(): Promise<T> => responses[index++] as T);
  }

  it('normalizes nested collections and cards responses', async () => {
    queueResponses(
      {
        collections: {
          collections: [
            {
              id: 'col_set1',
              name: 'Set Inicial',
              description: 'Coleccion base',
              release_date: '2026-03-12',
              total_cards: 100,
            },
          ],
        },
      },
      {
        collection: {
          id: 'col_set1',
          name: 'Set Inicial',
        },
        cards: [
          {
            collection: {
              id: 'col_set1',
              name: 'Set Inicial',
            },
            cards: [
              {
                id: 'c_1',
                name: 'Dragon de Fuego',
                rarity: 'Rara',
                url_image: 'https://ejemplo.com/dragon.jpg',
              },
            ],
          },
        ],
      }
    );

    const collections = await service.getCollectionsWithCards();

    expect(apiClientSpy.request.calls.count()).toBe(2);
    expect(collections).toEqual([
      {
        id: 'col_set1',
        name: 'Set Inicial',
        description: 'Coleccion base',
        releaseDate: '2026-03-12',
        totalCards: 100,
        cards: [
          {
            idCard: 'c_1',
            idCollection: 'col_set1',
            rarity: 'Rara',
            title: 'Dragon de Fuego',
            imageUrl: 'https://ejemplo.com/dragon.jpg',
          },
        ],
      },
    ]);
  });

  it('ignores empty card containers without failing the whole lobby load', async () => {
    queueResponses(
      {
        collections: {
          collections: [
            {
              id: 'col_empty',
              name: 'Coleccion vacia',
              description: null,
              release_date: '2026-04-14',
              total_cards: 0,
            },
            {
              id: 'col_full',
              name: 'Coleccion con cartas',
              description: null,
              release_date: '2026-04-14',
              total_cards: 1,
            },
          ],
        },
      },
      {
        collection: {
          id: 'col_empty',
          name: 'Coleccion vacia',
        },
        cards: [
          {
            collection: {
              id: 'col_empty',
              name: 'Coleccion vacia',
            },
            cards: [],
          },
        ],
      },
      {
        collection: {
          id: 'col_full',
          name: 'Coleccion con cartas',
        },
        cards: [
          {
            collection: {
              id: 'col_full',
              name: 'Coleccion con cartas',
            },
            cards: [
              {
                id: 'c_99',
                name: 'Carta valida',
                rarity: 'COMMON',
                url_image: 'https://ejemplo.com/carta-valida.jpg',
              },
            ],
          },
        ],
      }
    );

    const collections = await service.getCollectionsWithCards();

    expect(collections).toEqual([
      {
        id: 'col_empty',
        name: 'Coleccion vacia',
        description: '',
        releaseDate: '2026-04-14',
        totalCards: 0,
        cards: [],
      },
      {
        id: 'col_full',
        name: 'Coleccion con cartas',
        description: '',
        releaseDate: '2026-04-14',
        totalCards: 1,
        cards: [
          {
            idCard: 'c_99',
            idCollection: 'col_full',
            rarity: 'COMMON',
            title: 'Carta valida',
            imageUrl: 'https://ejemplo.com/carta-valida.jpg',
          },
        ],
      },
    ]);
  });

  it('inherits the collection id from nested wrappers when child cards do not include it', async () => {
    queueResponses(
      {
        collections: {
          collections: [
            {
              id: 'col_1',
              name: 'Coleccion 1',
              description: null,
              release_date: '2026-04-14',
              total_cards: 84,
            },
          ],
        },
      },
      {
        collection: {
          id: 'col_1',
          name: 'Coleccion 1',
        },
        cards: [
          {
            collection: {
              id: 'col_1',
              name: 'Coleccion 1',
            },
            cards: [
              {
                id: 'c_1',
                name: 'Carta 1-1',
                rarity: 'COMMON',
                url_image: 'https://ejemplo.com/placeholder.jpg',
              },
              {
                id: 'c_2',
                name: 'Carta 1-2',
                rarity: 'COMMON',
                url_image: 'https://ejemplo.com/placeholder-2.jpg',
              },
            ],
          },
        ],
      }
    );

    const collections = await service.getCollectionsWithCards();

    expect(collections[0].cards).toEqual([
      {
        idCard: 'c_1',
        idCollection: 'col_1',
        rarity: 'COMMON',
        title: 'Carta 1-1',
        imageUrl: 'https://ejemplo.com/placeholder.jpg',
      },
      {
        idCard: 'c_2',
        idCollection: 'col_1',
        rarity: 'COMMON',
        title: 'Carta 1-2',
        imageUrl: 'https://ejemplo.com/placeholder-2.jpg',
      },
    ]);
  });
});
