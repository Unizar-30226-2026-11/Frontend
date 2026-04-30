import { TestBed } from '@angular/core/testing';

import { ApiClient } from './api-client';
import { Auth } from './auth';
import { GamesPull } from './games-pull';

describe('GamesPull', () => {
  let service: GamesPull;
  let apiClientSpy: jasmine.SpyObj<ApiClient>;
  let authStub: {
    token: jasmine.Spy<() => string | null>;
  };

  beforeEach(() => {
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', ['request', 'invalidateCache']);
    authStub = {
      token: jasmine.createSpy().and.returnValue('session-token'),
    };

    TestBed.configureTestingModule({
      providers: [
        GamesPull,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
      ],
    });
    service = TestBed.inject(GamesPull);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('falls back to the classic board route when the backend omits it', async () => {
    apiClientSpy.request.and.resolveTo({
      message: 'Partida iniciada',
      lobby: { lobbyCode: 'ABCD', status: 'starting' },
      game: { id: 'classic-1', engine: 'Classic' },
    });

    const result = await service.startLobby('ABCD', 'Classic');

    expect(result.route).toBe('/game/classic-1');
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/lobbies');
  });

  it('falls back to the stella board route when the engine is Stella', async () => {
    apiClientSpy.request.and.resolveTo({
      message: 'Partida iniciada',
      lobby: { lobbyCode: 'ST99', status: 'starting' },
      game: { id: 'stella-9', engine: 'Stella' },
    });

    const result = await service.startLobby('ST99', 'Stella');

    expect(result.route).toBe('/game/stella-9');
  });

  it('uses the requested engine as fallback when the backend does not return one', async () => {
    apiClientSpy.request.and.resolveTo({
      lobby: { lobbyCode: 'ROOM7', status: 'starting' },
      game: { id: 'ROOM7' },
    });

    const result = await service.startLobby('ROOM7', 'Stella');

    expect(result.route).toBe('/game/ROOM7');
  });
});
