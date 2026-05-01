import { TestBed } from '@angular/core/testing';

import { Auth } from './auth';
import { ApiClient } from './api-client';
import { BoardsPull } from './boards-pull';

describe('BoardsPull', () => {
  let service: BoardsPull;
  let apiClientSpy: jasmine.SpyObj<ApiClient>;

  beforeEach(() => {
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', ['request', 'invalidateCache']);

    TestBed.configureTestingModule({
      providers: [
        BoardsPull,
        { provide: ApiClient, useValue: apiClientSpy },
        {
          provide: Auth,
          useValue: {
            token: () => 'token-123',
          },
        },
      ],
    });

    service = TestBed.inject(BoardsPull);
  });

  it('maps the owned boards response', async () => {
    apiClientSpy.request.and.resolveTo({
      boards: [
        {
          id: 'b_001',
          name: 'Tablero Clasico',
          description: 'El tablero estandar del juego con diseno clasico',
          url_image: 'https://midominio.com/boards/classic.png',
        },
      ],
    });

    const result = await service.getUserBoards();

    expect(apiClientSpy.request).toHaveBeenCalledWith('/users/boards', {
      token: 'token-123',
      ttlMs: 20_000,
      forceRefresh: undefined,
    });
    expect(result).toEqual([
      {
        id: 'b_001',
        image: 'https://midominio.com/boards/classic.png',
      },
    ]);
  });

  it('activates the selected board with board_id', async () => {
    apiClientSpy.request.and.resolveTo({
      message: 'Tablero activo actualizado.',
    });

    const result = await service.activateBoard('b_001');

    expect(apiClientSpy.request).toHaveBeenCalledWith('/users/boards/active', {
      method: 'POST',
      token: 'token-123',
      body: { board_id: 'b_001' },
      useCache: false,
    });
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/users/boards');
    expect(result).toBe('Tablero activo actualizado.');
  });
});
