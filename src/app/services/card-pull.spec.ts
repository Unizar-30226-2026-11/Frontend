import { TestBed } from '@angular/core/testing';

import { ApiClient } from './api-client';
import { Auth } from './auth';
import { CardPull } from './card-pull';

describe('CardPull', () => {
  let service: CardPull;
  let apiClientSpy: jasmine.SpyObj<ApiClient>;

  beforeEach(() => {
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', ['request']);

    TestBed.configureTestingModule({
      providers: [
        CardPull,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: { token: () => 'demo-token' } },
      ],
    });
    service = TestBed.inject(CardPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads cards from the API by default', async () => {
    apiClientSpy.request.and.resolveTo({
      cards: [
        { cardId: 'c_101', name: 'Dragon de Fuego' },
        { cardId: 'c_102', name: 'Bosque Invertido', url_image: '/cards/c_102.png' },
      ],
    });

    const cards = await service.getCards();

    expect(apiClientSpy.request).toHaveBeenCalledOnceWith('/users/cards', {
      token: 'demo-token',
      ttlMs: 20_000,
      forceRefresh: undefined,
    });
    expect(cards).toEqual([
      {
        code: 'c_101',
        image: '/assets/Tablero.png',
        value: 'Dragon de Fuego',
        suit: 'DIXIT',
      },
      {
        code: 'c_102',
        image: '/cards/c_102.png',
        value: 'Bosque Invertido',
        suit: 'DIXIT',
      },
    ]);
  });

  it('uses url_image from the backend when present', async () => {
    apiClientSpy.request.and.resolveTo({
      cards: [
        {
          cardId: 'c_85',
          name: 'Deseos',
          url_image:
            'https://hmepdoxdbgqlodszvzkk.supabase.co/storage/v1/object/public/game-assets/cards/Mundos-Interiores/Deseos/Gemini_Generated_Image_4cteoi4cteoi4cte.png',
        },
      ],
    });

    const cards = await service.getCards();

    expect(cards[0]).toEqual({
      code: 'c_85',
      image:
        'https://hmepdoxdbgqlodszvzkk.supabase.co/storage/v1/object/public/game-assets/cards/Mundos-Interiores/Deseos/Gemini_Generated_Image_4cteoi4cteoi4cte.png',
      value: 'Deseos',
      suit: 'DIXIT',
    });
  });

  it('limits API cards when a count is provided', async () => {
    apiClientSpy.request.and.resolveTo({
      cards: {
        cards: [
          { cardId: 'c_101', name: 'Dragon de Fuego' },
          { cardId: 'c_102', name: 'Bosque Invertido' },
          { cardId: 'c_103', name: 'Reloj Sumergido' },
        ],
      },
    });

    const cards = await service.getCards(2);

    expect(cards.length).toBe(2);
    expect(cards.map((card) => card.code)).toEqual(['c_101', 'c_102']);
  });
});
