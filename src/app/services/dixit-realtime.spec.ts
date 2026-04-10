import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ApiRequestError } from '../interfaces/api';
import { Auth } from './auth';
import { ApiClient } from './api-client';
import { DixitRealtime } from './dixit-realtime';

describe('DixitRealtime', () => {
  let apiClientSpy: jasmine.SpyObj<ApiClient>;
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
    authStub = {
      token: jasmine.createSpy().and.returnValue('auth-token'),
      activeGameId: jasmine.createSpy().and.returnValue(null),
      setActiveGameId: jasmine.createSpy(),
    };
  });

  afterEach(() => {
    localStorage.clear();
    window.io = originalIo;
  });

  it('requests a fresh lobby ticket on cold start instead of reusing the stored one', fakeAsync(() => {
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
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.ensureLobbyConnection('A1B2');
    let isResolved = false;
    void connectionPromise.then(() => {
      isResolved = true;
    });

    tick();

    expect(apiClientSpy.request).toHaveBeenCalledOnceWith('/lobbies/A1B2/join', {
      method: 'POST',
      token: 'auth-token',
      useCache: false,
    });
    expect(socketFactory).toHaveBeenCalledOnce();
    expect(socketFactory.calls.mostRecent().args).toEqual([
      'http://fresh-socket.test',
      jasmine.objectContaining({
        auth: jasmine.objectContaining({
          ticket: 'fresh-ticket',
          token: 'fresh-ticket',
          code: 'fresh-ticket',
          lobbyCode: 'A1B2',
        }),
        query: jasmine.objectContaining({
          ticket: 'fresh-ticket',
          token: 'fresh-ticket',
          code: 'fresh-ticket',
          lobbyCode: 'A1B2',
        }),
      }),
    ]);

    socket.trigger('connect');
    tick();

    expect(isResolved).toBeTrue();
    expect(service.connectionStatus()).toBe('connected');
  }));

  it('restores an active game by requesting a fresh lobby join ticket', fakeAsync(() => {
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
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    const connectionPromise = service.restoreActiveGameConnection('A1B2');
    let isResolved = false;
    void connectionPromise.then(() => {
      isResolved = true;
    });

    tick();

    expect(apiClientSpy.request).toHaveBeenCalledOnceWith('/lobbies/A1B2/join', {
      method: 'POST',
      token: 'auth-token',
      useCache: false,
    });
    expect(service.activeGameNotice()).toBe('Tienes una partida activa.');

    socket.trigger('connect');
    tick();

    expect(isResolved).toBeTrue();
    expect(service.connectionStatus()).toBe('connected');
  }));

  it('accepts the public server:game:started event and exposes storyteller data from currentRound', fakeAsync(() => {
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
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    void service.ensureLobbyConnection('A1B2');

    tick();
    socket.trigger('connect');
    tick();

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
  }));

  it('clears the active game when the join endpoint returns 404', fakeAsync(() => {
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
      ],
    });

    const service = TestBed.inject(DixitRealtime);
    let rejectedError: unknown = null;
    void service.ensureLobbyConnection('A1B2').catch((error) => {
      rejectedError = error;
    });

    tick();

    expect(rejectedError).toEqual(jasmine.any(ApiRequestError));
    expect(authStub.setActiveGameId).toHaveBeenCalledOnceWith(null);
    expect(localStorage.getItem('ator.dixit.realtime.session')).toBeNull();
    expect(service.activeGameNotice()).toBe('');
  }));
});

class FakeSocketIoClient {
  connected = false;

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

  emit(_event: string, _payload?: unknown): FakeSocketIoClient {
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
