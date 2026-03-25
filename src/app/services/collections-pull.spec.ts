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

  it('normalizes nested collections and cards responses', async () => {
    apiClientSpy.request.and.returnValues(
      Promise.resolve({
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
      }),
      Promise.resolve({
        cards: {
          collection: {
            id: 'col_set1',
            name: 'Set Inicial',
          },
          cards: [
            {
              id_card: 'col_set1_card_001',
              id_collection: 'col_set1',
              rarity: 'Rara',
              title: 'Dragon de Fuego',
            },
          ],
        },
      })
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
            idCard: 'col_set1_card_001',
            idCollection: 'col_set1',
            rarity: 'Rara',
            title: 'Dragon de Fuego',
          },
        ],
      },
    ]);
  });
});
