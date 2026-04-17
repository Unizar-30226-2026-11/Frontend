import { TestBed } from '@angular/core/testing';

import { vi } from 'vitest';
import { ApiRequestError } from '../interfaces/api';
import { Auth } from './auth';
import { ApiClient } from './api-client';
import { DixitRealtime } from './dixit-realtime';
import { PlayerStore } from './player-store';

describe('DixitRealtime', () => {
  let apiClientSpy: jasmine.SpyObj<ApiClient>;
  let playerStoreSpy: jasmine.SpyObj<PlayerStore>;
  let authStub: {
    token: jasmine.Spy<() => string | null>;
    activeGameId: jasmine.Spy<() => string | null>;
    setActiveGameId: jasmine.Spy<(activeGameId: string | null) => void>;
  };
  let originalIo: typeof window.io;

  beforeEach(() => {
    localStorage.clear();
    originalIo = window.io;
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', ['request']);
    playerStoreSpy = jasmine.createSpyObj<PlayerStore>('PlayerStore', ['updateBalance']);
    authStub = {
      token: jasmine.createSpy().and.returnValue('auth-token'),
      activeGameId: jasmine.createSpy().and.returnValue(null),
      setActiveGameId: jasmine.createSpy(),
    };
  });

  afterEach(() => {
    localStorage.clear();
    window.io = originalIo;
    vi.useRealTimers();
  });

  it('requests a fresh lobby ticket on cold start instead of reusing the stored one', async () => {
    localStorage.setItem(
      'ator.dixit.realtime.session',
      JSON.stringify({
        lobbyCode: 'A1B2',
        ticket: 'stale-ticket',
        socketUrl: 'http://stale-socket.test',
        joinedAt: '2026-04-08T10:00:00.000Z',
      })
    );

    const socket = new FakeSocketIoClient();
    const socketFactory = jasmine
      .createSpy('socketFactory')
      .and.callFake((_url: string, _options?: Record<string, unknown>) => socket);
    window.io = socketFactory as typeof window.io;

    apiClientSpy.request.and.resolveTo({
      ticket: 'fresh-ticket',
      socketUrl: 'http://fresh-socket.test',
    });

    TestBed.configureTestingModule({
      providers: [
        DixitRealtime,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.ensureLobbyConnection('A1B2');
    await flushMicrotasks();

    expect(apiClientSpy.request).toHaveBeenCalledOnceWith('/lobbies/A1B2/join', {
      method: 'POST',
      token: 'auth-token',
      useCache: false,
    });
    expect(socketFactory).toHaveBeenCalledTimes(1);
    expect(socketFactory.calls.mostRecent().args).toEqual([
      'http://fresh-socket.test',
      jasmine.objectContaining({
        auth: {
          token: 'fresh-ticket',
        },
      }),
    ]);

    socket.trigger('connect');
    await connectionPromise;

    expect(
      socket.emissions.some(
        (emission) =>
          emission.event === 'client:lobby:join' &&
          emission.payload === undefined
      )
    ).toBeTrue();
    expect(service.connectionStatus()).toBe('connected');
  });

  it('restores an active game by requesting a fresh lobby join ticket', async () => {
    const socket = new FakeSocketIoClient();
    const socketFactory = jasmine
      .createSpy('socketFactory')
      .and.callFake((_url: string, _options?: Record<string, unknown>) => socket);
    window.io = socketFactory as typeof window.io;

    apiClientSpy.request.and.resolveTo({
      ticket: 'fresh-ticket',
      socketUrl: 'http://fresh-socket.test',
    });

    TestBed.configureTestingModule({
      providers: [
        DixitRealtime,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.restoreActiveGameConnection('A1B2');
    await flushMicrotasks();

    expect(apiClientSpy.request).toHaveBeenCalledOnceWith('/lobbies/A1B2/join', {
      method: 'POST',
      token: 'auth-token',
      useCache: false,
    });
    expect(service.activeGameNotice()).toBe('Tienes una partida activa.');

    socket.trigger('connect');
    await connectionPromise;

    expect(service.connectionStatus()).toBe('connected');
  });

  it('accepts the public server:game:started event and exposes storyteller data from currentRound', async () => {
    const socket = new FakeSocketIoClient();
    const socketFactory = jasmine
      .createSpy('socketFactory')
      .and.callFake((_url: string, _options?: Record<string, unknown>) => socket);
    window.io = socketFactory as typeof window.io;

    apiClientSpy.request.and.resolveTo({
      ticket: 'fresh-ticket',
      socketUrl: 'http://fresh-socket.test',
    });

    TestBed.configureTestingModule({
      providers: [
        DixitRealtime,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.ensureLobbyConnection('A1B2');
    await flushMicrotasks();
    socket.trigger('connect');
    await connectionPromise;

    socket.trigger('server:game:started', {
      lobbyCode: 'A1B2',
      state: {
        currentRound: {
          storytellerId: 'u_story',
        },
      },
    });

    const gameState = service.gameState();
    expect(service.gameStarted()?.lobbyCode).toBe('A1B2');
    expect(gameState?.lastAction).toBe('GAME_STARTED');
    expect(gameState?.state['currentRound']).toEqual(
      jasmine.objectContaining({
        storytellerId: 'u_story',
      })
    );
    expect(authStub.setActiveGameId).toHaveBeenCalledWith('A1B2');
    expect(
      JSON.parse(localStorage.getItem('ator.dixit.realtime.game-state') ?? '{}')
    ).toEqual(
      jasmine.objectContaining({
        lobbyCode: 'A1B2',
        state: jasmine.objectContaining({
          currentRound: jasmine.objectContaining({
            storytellerId: 'u_story',
          }),
        }),
      })
    );
  });

  it('stores private hand updates from the documented server event', async () => {
    const socket = new FakeSocketIoClient();
    const socketFactory = jasmine
      .createSpy('socketFactory')
      .and.callFake((_url: string, _options?: Record<string, unknown>) => socket);
    window.io = socketFactory as typeof window.io;

    apiClientSpy.request.and.resolveTo({
      ticket: 'fresh-ticket',
      socketUrl: 'http://fresh-socket.test',
    });

    TestBed.configureTestingModule({
      providers: [
        DixitRealtime,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.ensureLobbyConnection('A1B2');
    await flushMicrotasks();
    socket.trigger('connect');
    await connectionPromise;

    socket.trigger('server:game:private_hand', { hand: [1, '2', null, ''] });

    expect(service.privateHand()).toEqual(
      jasmine.objectContaining({
        lobbyCode: 'A1B2',
        hand: [1, '2'],
      })
    );
  });

  it('stores the active minigame when server:game:minigame_start arrives', async () => {
    const socket = new FakeSocketIoClient();
    const socketFactory = jasmine
      .createSpy('socketFactory')
      .and.callFake((_url: string, _options?: Record<string, unknown>) => socket);
    window.io = socketFactory as typeof window.io;

    apiClientSpy.request.and.resolveTo({
      ticket: 'fresh-ticket',
      socketUrl: 'http://fresh-socket.test',
    });

    TestBed.configureTestingModule({
      providers: [
        DixitRealtime,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.ensureLobbyConnection('A1B2');
    await flushMicrotasks();
    socket.trigger('connect');
    await connectionPromise;

    socket.trigger('server:game:minigame_start', {
      type: 1,
      isDuel: true,
      durationSeconds: 15,
    });

    expect(service.activeMinigame()).toEqual(
      jasmine.objectContaining({
        type: 1,
        isDuel: true,
        durationSeconds: 15,
      })
    );
  });

  it('clears the active minigame when CONFLICT_CANCELLED arrives', async () => {
    const socket = new FakeSocketIoClient();
    const socketFactory = jasmine
      .createSpy('socketFactory')
      .and.callFake((_url: string, _options?: Record<string, unknown>) => socket);
    window.io = socketFactory as typeof window.io;

    apiClientSpy.request.and.resolveTo({
      ticket: 'fresh-ticket',
      socketUrl: 'http://fresh-socket.test',
    });

    TestBed.configureTestingModule({
      providers: [
        DixitRealtime,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.ensureLobbyConnection('A1B2');
    await flushMicrotasks();
    socket.trigger('connect');
    await connectionPromise;

    socket.trigger('server:game:minigame_start', {
      type: 0,
      isDuel: false,
      durationSeconds: 15,
    });
    socket.trigger('CONFLICT_CANCELLED', {
      message: 'El rival se ha desconectado.',
    });

    expect(service.activeMinigame()).toBeNull();
    expect(service.toast()).toEqual(
      jasmine.objectContaining({
        message: 'El rival se ha desconectado.',
      })
    );
  });

  it('keeps the final ranking available after server:game:ended and clears the active game id', async () => {
    const socket = new FakeSocketIoClient();
    const socketFactory = jasmine
      .createSpy('socketFactory')
      .and.callFake((_url: string, _options?: Record<string, unknown>) => socket);
    window.io = socketFactory as typeof window.io;

    apiClientSpy.request.and.resolveTo({
      ticket: 'fresh-ticket',
      socketUrl: 'http://fresh-socket.test',
    });

    TestBed.configureTestingModule({
      providers: [
        DixitRealtime,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.ensureLobbyConnection('A1B2');
    await flushMicrotasks();
    socket.trigger('connect');
    await connectionPromise;

    socket.trigger('server:game:ended', {
      ranking: [
        { playerId: 'u_1', points: 17, place: 1, coinsEarned: 50 },
        { playerId: 'u_2', points: 12, place: 2, coinsEarned: 35 },
      ],
    });

    expect(service.gameEndedResult()).toEqual(
      jasmine.objectContaining({
        ranking: [
          jasmine.objectContaining({ playerId: 'u_1', place: 1, coinsEarned: 50 }),
          jasmine.objectContaining({ playerId: 'u_2', place: 2, coinsEarned: 35 }),
        ],
      })
    );
    expect(service.gameState()).toEqual(
      jasmine.objectContaining({
        lastAction: 'GAME_ENDED',
        state: jasmine.objectContaining({
          phase: 'FINISHED',
        }),
      })
    );
    expect(authStub.setActiveGameId).toHaveBeenCalledWith(null);
    expect(service.connectionStatus()).toBe('connected');
  });

  it('updates the wallet balance when server:economy:wallet_updated arrives', async () => {
    const socket = new FakeSocketIoClient();
    const socketFactory = jasmine
      .createSpy('socketFactory')
      .and.callFake((_url: string, _options?: Record<string, unknown>) => socket);
    window.io = socketFactory as typeof window.io;

    apiClientSpy.request.and.resolveTo({
      ticket: 'fresh-ticket',
      socketUrl: 'http://fresh-socket.test',
    });

    TestBed.configureTestingModule({
      providers: [
        DixitRealtime,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.ensureLobbyConnection('A1B2');
    await flushMicrotasks();
    socket.trigger('connect');
    await connectionPromise;

    socket.trigger('server:economy:wallet_updated', {
      balance: 320,
    });

    expect(service.walletUpdated()).toEqual(
      jasmine.objectContaining({
        balance: 320,
      })
    );
    expect(playerStoreSpy.updateBalance).toHaveBeenCalledOnceWith(320);
  });

  it('clears the active game when the join endpoint returns 404', async () => {
    localStorage.setItem(
      'ator.dixit.realtime.session',
      JSON.stringify({
        lobbyCode: 'A1B2',
        ticket: 'stale-ticket',
        socketUrl: 'http://stale-socket.test',
        joinedAt: '2026-04-08T10:00:00.000Z',
      })
    );
    authStub.activeGameId.and.returnValue('A1B2');
    apiClientSpy.request.and.rejectWith(new ApiRequestError('Sala no encontrada', 404));

    TestBed.configureTestingModule({
      providers: [
        DixitRealtime,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: authStub },
        { provide: PlayerStore, useValue: playerStoreSpy },
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    let rejectedError: unknown = null;
    try {
      await service.ensureLobbyConnection('A1B2');
    } catch (error) {
      rejectedError = error;
    }

    expect(rejectedError).toEqual(jasmine.any(ApiRequestError));
    expect(authStub.setActiveGameId).toHaveBeenCalledOnceWith(null);
    expect(localStorage.getItem('ator.dixit.realtime.session')).toBeNull();
    expect(service.activeGameNotice()).toBe('');
  });
});

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

class FakeSocketIoClient {
  connected = false;
  readonly emissions: Array<{ event: string; payload?: unknown }> = [];

  private readonly listeners = new Map<string, Array<(payload?: unknown) => void>>();
  private readonly oneTimeListeners = new Map<string, Array<(payload?: unknown) => void>>();

  on(event: string, listener: (payload?: unknown) => void): FakeSocketIoClient {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  once(event: string, listener: (payload?: unknown) => void): FakeSocketIoClient {
    const listeners = this.oneTimeListeners.get(event) ?? [];
    listeners.push(listener);
    this.oneTimeListeners.set(event, listeners);
    return this;
  }

  emit(event: string, payload?: unknown): FakeSocketIoClient {
    this.emissions.push({ event, payload });
    return this;
  }

  disconnect(): FakeSocketIoClient {
    this.connected = false;
    return this;
  }

  trigger(event: string, payload?: unknown): void {
    if (event === 'connect') {
      this.connected = true;
    }

    if (event === 'disconnect') {
      this.connected = false;
    }

    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }

    const oneTimeListeners = this.oneTimeListeners.get(event) ?? [];
    this.oneTimeListeners.delete(event);
    for (const listener of oneTimeListeners) {
      listener(payload);
    }
  }
}
