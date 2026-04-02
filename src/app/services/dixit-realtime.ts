import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DixitConnectionStatus,
  DixitGameActionType,
  LobbyJoinResponse,
  RealtimeChatMessage,
  RealtimeGameStarted,
  RealtimeGameStateUpdate,
  RealtimeLobbyPlayer,
  RealtimeLobbyState,
  RealtimeSession,
} from '../interfaces/dixit-realtime';
import type { SocketIoClient } from '../../socket-io-client';
import { ApiClient } from './api-client';
import { Auth } from './auth';

const REALTIME_SESSION_STORAGE_KEY = 'ator.dixit.realtime.session';
const SOCKET_CONNECT_TIMEOUT_MS = 5_000;
const REALTIME_LOG_PREFIX = '[DixitRealtime]';

@Injectable({
  providedIn: 'root',
})
export class DixitRealtime {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);

  private socket: SocketIoClient | null = null;

  private readonly sessionState = signal<RealtimeSession | null>(this.restoreSession());
  private readonly connectionStatusState = signal<DixitConnectionStatus>('idle');
  private readonly lobbyStateSignal = signal<RealtimeLobbyState | null>(null);
  private readonly gameStateSignal = signal<RealtimeGameStateUpdate | null>(null);
  private readonly gameStartedSignal = signal<RealtimeGameStarted | null>(null);
  private readonly chatMessagesSignal = signal<RealtimeChatMessage[]>([]);
  private readonly lastErrorSignal = signal('');

  readonly session = computed(() => this.sessionState());
  readonly activeLobbyCode = computed(() => this.sessionState()?.lobbyCode ?? '');
  readonly connectionStatus = computed(() => this.connectionStatusState());
  readonly lobbyState = computed(() => this.lobbyStateSignal());
  readonly gameState = computed(() => this.gameStateSignal());
  readonly gameStarted = computed(() => this.gameStartedSignal());
  readonly chatMessages = computed(() => this.chatMessagesSignal());
  readonly lastError = computed(() => this.lastErrorSignal());

  async joinLobby(lobbyCode: string): Promise<void> {
    const normalizedLobbyCode = this.normalizeLobbyCode(lobbyCode);
    const activeSession = this.sessionState();

    if (
      activeSession?.lobbyCode === normalizedLobbyCode &&
      this.socket !== null &&
      this.socket.connected
    ) {
      this.connectionStatusState.set('connected');
      return;
    }

    this.connectionStatusState.set('joining');
    this.lastErrorSignal.set('');

    const response = await this.apiClient.request<LobbyJoinResponse>(
      `/lobbies/${encodeURIComponent(normalizedLobbyCode)}/join`,
      {
        method: 'POST',
        token: this.requireToken(),
        useCache: false,
      }
    );
    this.debug('join lobby response', response);

    const nextSession = this.buildSession(normalizedLobbyCode, response);
    this.sessionState.set(nextSession);
    this.persistSession(nextSession);
    await this.connectWithSession(nextSession);
  }

  async ensureLobbyConnection(lobbyCode: string): Promise<void> {
    const normalizedLobbyCode = this.normalizeLobbyCode(lobbyCode);
    const activeSession = this.sessionState();

    if (
      activeSession?.lobbyCode === normalizedLobbyCode &&
      this.socket !== null &&
      this.socket.connected
    ) {
      this.connectionStatusState.set('connected');
      return;
    }

    if (activeSession?.lobbyCode === normalizedLobbyCode) {
      await this.connectWithSession(activeSession);
      return;
    }

    const storedSession = this.restoreSession();
    if (storedSession?.lobbyCode === normalizedLobbyCode) {
      this.sessionState.set(storedSession);
      await this.connectWithSession(storedSession);
      return;
    }

    await this.joinLobby(normalizedLobbyCode);
  }

  startLobby(): void {
    this.debug('emit client:lobby:start');
    this.emit('client:lobby:start', {});
  }

  sendGameAction(actionType: DixitGameActionType, payload: Record<string, unknown>): void {
    this.debug(`emit client:game:action ${actionType}`, payload);
    this.emit('client:game:action', {
      lobbyCode: this.requireSession().lobbyCode,
      actionType,
      payload,
    });
  }

  sendChat(text: string): void {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return;
    }

    this.debug('emit client:chat:send', { text: normalizedText });
    this.emit('client:chat:send', {
      lobbyCode: this.requireSession().lobbyCode,
      text: normalizedText,
    });
  }

  leaveLobby(): void {
    if (this.socket !== null) {
      this.debug('emit client:lobby:leave');
      this.socket.emit('client:lobby:leave', {});
    }

    this.disconnect(false);
  }

  disconnect(preserveSession = true): void {
    this.socket?.disconnect();
    this.socket = null;

    if (preserveSession) {
      if (this.sessionState() !== null) {
        this.connectionStatusState.set('disconnected');
      }
      return;
    }

    this.sessionState.set(null);
    this.connectionStatusState.set('idle');
    this.lobbyStateSignal.set(null);
    this.gameStateSignal.set(null);
    this.gameStartedSignal.set(null);
    this.chatMessagesSignal.set([]);
    this.lastErrorSignal.set('');
    localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
  }

  private async connectWithSession(session: RealtimeSession): Promise<void> {
    const socketFactory = window.io;
    if (!socketFactory) {
      const error = new Error('No se pudo cargar el cliente de Socket.IO');
      this.connectionStatusState.set('error');
      this.lastErrorSignal.set(error.message);
      throw error;
    }

    this.socket?.disconnect();
    this.socket = null;
    this.connectionStatusState.set('connecting');
    this.lastErrorSignal.set('');

    const socket = socketFactory(session.socketUrl, {
      transports: ['websocket'],
      timeout: SOCKET_CONNECT_TIMEOUT_MS,
      reconnection: true,
      autoConnect: true,
      auth: {
        token: session.ticket,
        ticket: session.ticket,
        code: session.ticket,
        lobbyCode: session.lobbyCode,
      },
      query: {
        token: session.ticket,
        ticket: session.ticket,
        code: session.ticket,
        lobbyCode: session.lobbyCode,
      },
    });

    this.socket = socket;
    this.debug('opening socket connection', {
      lobbyCode: session.lobbyCode,
      socketUrl: session.socketUrl,
    });
    this.attachSocketListeners(socket, session);
    await this.waitForSocketConnection(socket);
  }

  private attachSocketListeners(socket: SocketIoClient, session: RealtimeSession): void {
    socket.on('connect', () => {
      if (this.socket !== socket) {
        return;
      }

      this.connectionStatusState.set('connected');
      this.lastErrorSignal.set('');
      this.debug('socket connected', {
        lobbyCode: session.lobbyCode,
        socketUrl: session.socketUrl,
      });
      socket.emit('client:lobby:join', { lobbyCode: session.lobbyCode });
    });

    socket.on('disconnect', () => {
      if (this.socket !== socket) {
        return;
      }

      this.connectionStatusState.set(
        this.sessionState() === null ? 'idle' : 'disconnected'
      );
      this.debug('socket disconnected', { lobbyCode: session.lobbyCode });
    });

    socket.on('connect_error', (payload: unknown) => {
      if (this.socket !== socket) {
        return;
      }

      const message = this.resolveSocketErrorMessage(payload);
      this.connectionStatusState.set('error');
      this.lastErrorSignal.set(message);
      this.debug('socket connect_error', payload);
    });

    socket.on('server:error', (payload: unknown) => {
      const message = this.resolveServerMessage(payload);
      this.lastErrorSignal.set(message);
      if (this.connectionStatusState() !== 'connected') {
        this.connectionStatusState.set('error');
      }
      this.debug('event server:error', payload);
    });

    socket.on('server:lobby:state_updated', (payload: unknown) => {
      const nextLobbyState = this.normalizeLobbyState(payload, session.lobbyCode);
      if (!nextLobbyState) {
        return;
      }

      this.lobbyStateSignal.set(nextLobbyState);
      this.debug('event server:lobby:state_updated', nextLobbyState);
    });

    socket.on('server:game:state_updated', (payload: unknown) => {
      const normalizedPayload = asRecord(payload);
      if (!normalizedPayload) {
        return;
      }

      const state = asRecord(normalizedPayload['state']);
      if (!state) {
        return;
      }

      this.gameStateSignal.set({
        state,
        lastAction: readString(normalizedPayload, 'lastAction') ?? undefined,
        receivedAt: Date.now(),
      });
      this.debug('event server:game:state_updated', {
        lastAction: readString(normalizedPayload, 'lastAction') ?? undefined,
        state,
      });
    });

    socket.on('server:game:ended', () => {
      this.gameStateSignal.update((currentState) => ({
        state: currentState?.state ?? {},
        lastAction: 'GAME_ENDED',
        receivedAt: Date.now(),
      }));
      this.debug('event server:game:ended');
    });

    socket.on('server:chat:message_received', (payload: unknown) => {
      const normalizedMessage = this.normalizeChatMessage(payload);
      if (!normalizedMessage) {
        return;
      }

      this.chatMessagesSignal.update((currentMessages) =>
        [...currentMessages, normalizedMessage].slice(-25)
      );
      this.debug('event server:chat:message_received', normalizedMessage);
    });

    socket.on('game:started', (payload: unknown) => {
      const data = asRecord(payload);
      const wrappedData = asRecord(data?.['data']) ?? data;
      const state = asRecord(wrappedData?.['state']);
      const lobbyCode =
        readString(wrappedData ?? undefined, 'lobbyCode') ??
        readString(wrappedData ?? undefined, 'code') ??
        this.sessionState()?.lobbyCode ??
        '';

      if (!lobbyCode) {
        return;
      }

      if (state) {
        this.gameStateSignal.set({
          state,
          lastAction: 'GAME_STARTED',
          receivedAt: Date.now(),
        });
      }

      this.gameStartedSignal.set({
        lobbyCode,
        state: state ?? undefined,
        receivedAt: Date.now(),
      });
      this.debug('event game:started', {
        lobbyCode,
        hasState: !!state,
      });
    });
  }

  private waitForSocketConnection(socket: SocketIoClient): Promise<void> {
    if (socket.connected) {
      this.connectionStatusState.set('connected');
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        const error = new Error('No se pudo establecer la conexion realtime con la sala');
        this.connectionStatusState.set('error');
        this.lastErrorSignal.set(error.message);
        reject(error);
      }, SOCKET_CONNECT_TIMEOUT_MS);

      socket.once('connect', () => {
        window.clearTimeout(timeoutId);
        resolve();
      });

      socket.once('connect_error', (payload: unknown) => {
        window.clearTimeout(timeoutId);
        const error = new Error(this.resolveSocketErrorMessage(payload));
        this.connectionStatusState.set('error');
        this.lastErrorSignal.set(error.message);
        reject(error);
      });
    });
  }

  private emit(event: string, payload: Record<string, unknown>): void {
    if (this.socket === null || !this.socket.connected) {
      throw new Error('La conexion realtime de la sala no esta disponible');
    }

    this.socket.emit(event, payload);
  }

  private buildSession(
    lobbyCode: string,
    response: LobbyJoinResponse
  ): RealtimeSession {
    const ticket = this.extractJoinTicket(response);
    if (!ticket) {
      throw new Error('La API no devolvio un ticket valido para el websocket');
    }

    return {
      lobbyCode,
      ticket,
      socketUrl: this.extractSocketUrl(response),
      joinedAt: new Date().toISOString(),
    };
  }

  private extractJoinTicket(response: LobbyJoinResponse): string {
    const candidates = [
      response.ticket,
      response.token,
      response.code,
      response.wsToken,
      readString(response.websocket, 'ticket'),
      readString(response.websocket, 'token'),
      readString(response.websocket, 'code'),
      readString(response.websocket, 'wsToken'),
      readString(response.ws, 'ticket'),
      readString(response.ws, 'token'),
      readString(response.ws, 'code'),
      readString(response.ws, 'wsToken'),
      readString(response.lobby, 'ticket'),
      readString(response.lobby, 'token'),
      readString(response.lobby, 'code'),
      readString(response.lobby, 'wsToken'),
    ];

    return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim())?.trim() ?? '';
  }

  private extractSocketUrl(response: LobbyJoinResponse): string {
    const candidates = [
      response.socketUrl,
      response.wsUrl,
      readString(response.websocket, 'url'),
      readString(response.websocket, 'socketUrl'),
      readString(response.ws, 'url'),
      readString(response.ws, 'socketUrl'),
    ];

    return (
      candidates.find((candidate) => typeof candidate === 'string' && candidate.trim())?.trim() ??
      this.resolveDefaultSocketUrl()
    );
  }

  private resolveDefaultSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:3000`;
  }

  private normalizeLobbyState(
    payload: unknown,
    fallbackLobbyCode: string
  ): RealtimeLobbyState | null {
    const data = asRecord(payload);
    if (!data) {
      return null;
    }

    const players = readArray(data, 'players')
      .map((player) => this.normalizeLobbyPlayer(player))
      .filter((player): player is RealtimeLobbyPlayer => player !== null);

    return {
      id: readString(data, 'id') ?? '',
      code: readString(data, 'code') ?? readString(data, 'lobbyCode') ?? fallbackLobbyCode,
      hostId: readString(data, 'hostId') ?? '',
      players,
    };
  }

  private normalizeLobbyPlayer(payload: unknown): RealtimeLobbyPlayer | null {
    if (typeof payload === 'string') {
      const normalizedId = payload.trim();
      if (!normalizedId) {
        return null;
      }

      return {
        id: normalizedId,
        username: normalizedId,
      };
    }

    const player = asRecord(payload);
    if (!player) {
      return null;
    }

    const id = readString(player, 'id') ?? readString(player, 'userId') ?? readString(player, 'playerId');
    const username =
      readString(player, 'username') ?? readString(player, 'name') ?? id ?? '';

    if (!id || !username) {
      return null;
    }

    return {
      id,
      username,
    };
  }

  private normalizeChatMessage(payload: unknown): RealtimeChatMessage | null {
    const data = asRecord(payload);
    if (!data) {
      return null;
    }

    const username = readString(data, 'username');
    const text = readString(data, 'text');
    const timestamp = readString(data, 'timestamp');

    if (!username || !text || !timestamp) {
      return null;
    }

    return {
      username,
      text,
      timestamp,
    };
  }

  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para unirte a la sala');
    }

    return token;
  }

  private requireSession(): RealtimeSession {
    const session = this.sessionState();
    if (!session) {
      throw new Error('No hay una sala realtime activa');
    }

    return session;
  }

  private normalizeLobbyCode(lobbyCode: string): string {
    const normalizedLobbyCode = lobbyCode.trim().toUpperCase();
    if (!normalizedLobbyCode) {
      throw new Error('No se encontro el codigo de la sala');
    }

    return normalizedLobbyCode;
  }

  private resolveSocketErrorMessage(payload: unknown): string {
    if (payload instanceof Error && payload.message.trim()) {
      return payload.message;
    }

    return this.resolveServerMessage(payload);
  }

  private resolveServerMessage(payload: unknown): string {
    const data = asRecord(payload);
    return readString(data, 'message') ?? 'Se produjo un error en la conexion realtime';
  }

  private restoreSession(): RealtimeSession | null {
    try {
      const rawSession = localStorage.getItem(REALTIME_SESSION_STORAGE_KEY);
      if (!rawSession) {
        return null;
      }

      const parsedSession = JSON.parse(rawSession) as Partial<RealtimeSession>;
      if (
        typeof parsedSession.lobbyCode !== 'string' ||
        typeof parsedSession.ticket !== 'string' ||
        typeof parsedSession.socketUrl !== 'string'
      ) {
        localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
        return null;
      }

      return {
        lobbyCode: parsedSession.lobbyCode,
        ticket: parsedSession.ticket,
        socketUrl: parsedSession.socketUrl,
        joinedAt:
          typeof parsedSession.joinedAt === 'string'
            ? parsedSession.joinedAt
            : new Date().toISOString(),
      };
    } catch {
      localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
      return null;
    }
  }

  private persistSession(session: RealtimeSession): void {
    localStorage.setItem(REALTIME_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private debug(message: string, payload?: unknown): void {
    if (payload === undefined) {
      console.info(`${REALTIME_LOG_PREFIX} ${message}`);
      return;
    }

    console.info(`${REALTIME_LOG_PREFIX} ${message}`, payload);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readArray(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function readString(
  source: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  if (!source) {
    return null;
  }

  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
