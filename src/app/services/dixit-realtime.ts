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
  RealtimePrivateHand,
  RealtimeSession,
  RealtimeToast,
} from '../interfaces/dixit-realtime';
import type { SocketIoClient } from '../../socket-io-client';
import { ApiClient } from './api-client';
import { Auth } from './auth';
import { isApiRequestErrorStatus } from '../interfaces/api';

const REALTIME_SESSION_STORAGE_KEY = 'ator.dixit.realtime.session';
const REALTIME_GAME_STATE_STORAGE_KEY = 'ator.dixit.realtime.game-state';
const SOCKET_CONNECT_TIMEOUT_MS = 5_000;
const REALTIME_LOG_PREFIX = '[DixitRealtime]';
const DEFAULT_ACTIVE_GAME_NOTICE = 'Tienes una partida activa.';

@Injectable({
  providedIn: 'root',
})
export class DixitRealtime {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);

  private socket: SocketIoClient | null = null;
  private connectionPromise: Promise<void> | null = null;
  private connectionSessionKey = '';
  private toastSequence = 0;

  private readonly sessionState = signal<RealtimeSession | null>(this.restoreSession());
  private readonly connectionStatusState = signal<DixitConnectionStatus>('idle');
  private readonly lobbyStateSignal = signal<RealtimeLobbyState | null>(null);
  private readonly gameStateSignal = signal<RealtimeGameStateUpdate | null>(
    this.restoreGameState(this.restoreSession()?.lobbyCode ?? null)
  );
  private readonly gameStartedSignal = signal<RealtimeGameStarted | null>(null);
  private readonly privateHandSignal = signal<RealtimePrivateHand | null>(null);
  private readonly chatMessagesSignal = signal<RealtimeChatMessage[]>([]);
  private readonly lastErrorSignal = signal('');
  private readonly activeGameNoticeSignal = signal('');
  private readonly toastSignal = signal<RealtimeToast | null>(null);

  readonly session = computed(() => this.sessionState());
  readonly activeLobbyCode = computed(() => this.sessionState()?.lobbyCode ?? '');
  readonly connectionStatus = computed(() => this.connectionStatusState());
  readonly lobbyState = computed(() => this.lobbyStateSignal());
  readonly gameState = computed(() => this.gameStateSignal());
  readonly gameStarted = computed(() => this.gameStartedSignal());
  readonly privateHand = computed(() => this.privateHandSignal());
  readonly chatMessages = computed(() => this.chatMessagesSignal());
  readonly lastError = computed(() => this.lastErrorSignal());
  readonly activeGameNotice = computed(() => this.activeGameNoticeSignal());
  readonly toast = computed(() => this.toastSignal());

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

    let response: LobbyJoinResponse;
    try {
      response = await this.apiClient.request<LobbyJoinResponse>(
        `/lobbies/${encodeURIComponent(normalizedLobbyCode)}/join`,
        {
          method: 'POST',
          token: this.requireToken(),
          useCache: false,
        }
      );
    } catch (error) {
      this.handleJoinLobbyError(normalizedLobbyCode, error);
      throw error;
    }
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

    // A cold start may restore a stale ticket from localStorage. Only reuse a
    // previous session when there is still a live socket instance in memory.
    if (activeSession?.lobbyCode === normalizedLobbyCode && this.socket !== null) {
      await this.connectWithSession(activeSession);
      return;
    }

    const storedSession = this.restoreSession();
    if (storedSession?.lobbyCode === normalizedLobbyCode && this.socket !== null) {
      this.sessionState.set(storedSession);
      await this.connectWithSession(storedSession);
      return;
    }

    await this.joinLobby(normalizedLobbyCode);
  }

  async restoreActiveGameConnection(lobbyCode: string): Promise<void> {
    const normalizedLobbyCode = this.normalizeLobbyCode(lobbyCode);
    const activeSession = this.sessionState();

    if (
      activeSession?.lobbyCode === normalizedLobbyCode &&
      this.socket !== null &&
      this.socket.connected
    ) {
      this.connectionStatusState.set('connected');
      this.activeGameNoticeSignal.set(DEFAULT_ACTIVE_GAME_NOTICE);
      return;
    }

    this.activeGameNoticeSignal.set(DEFAULT_ACTIVE_GAME_NOTICE);
    await this.ensureLobbyConnection(normalizedLobbyCode);
  }

  startLobby(useDynamicPool?: boolean): void {
    const payload =
      typeof useDynamicPool === 'boolean' ? { useDynamicPool } : {};
    this.debug('emit client:lobby:start', payload);
    this.emit('client:lobby:start', payload);
  }

  triggerStar(): void {
    this.debug('emit client:game:trigger_star');
    this.emit('client:game:trigger_star', {
      lobbyCode: this.requireSession().lobbyCode,
    });
  }

  claimStar(): void {
    this.debug('emit client:game:claim_star');
    this.emit('client:game:claim_star', {
      lobbyCode: this.requireSession().lobbyCode,
    });
  }

  sendGameAction(actionType: DixitGameActionType, payload: Record<string, unknown> = {}): void {
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
      this.socket.emit('client:lobby:leave');
    }

    this.disconnect(false);
  }

  clearToast(): void {
    this.toastSignal.set(null);
  }

  disconnect(preserveSession = true): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connectionPromise = null;
    this.connectionSessionKey = '';

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
    this.privateHandSignal.set(null);
    this.chatMessagesSignal.set([]);
    this.lastErrorSignal.set('');
    this.activeGameNoticeSignal.set('');
    this.toastSignal.set(null);
    localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
    localStorage.removeItem(REALTIME_GAME_STATE_STORAGE_KEY);
  }

  private connectWithSession(session: RealtimeSession): Promise<void> {
    const sessionKey = this.buildSessionKey(session);

    if (
      this.connectionPromise !== null &&
      this.connectionSessionKey === sessionKey
    ) {
      return this.connectionPromise;
    }

    if (
      this.socket !== null &&
      this.socket.connected &&
      this.sessionState() !== null &&
      this.buildSessionKey(this.sessionState() as RealtimeSession) === sessionKey
    ) {
      this.connectionStatusState.set('connected');
      return Promise.resolve();
    }

    this.connectionSessionKey = sessionKey;
    this.connectionPromise = this.openSocketConnection(session).finally(() => {
      if (this.connectionSessionKey === sessionKey) {
        this.connectionPromise = null;
      }
    });

    return this.connectionPromise;
  }

  private async openSocketConnection(session: RealtimeSession): Promise<void> {
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

    const credential = this.extractSocketCredential(session);
    const socket = socketFactory(session.socketUrl, {
      transports: ['websocket'],
      timeout: SOCKET_CONNECT_TIMEOUT_MS,
      reconnection: true,
      autoConnect: true,
      auth: {
        token: credential,
      },
    });

    this.socket = socket;
    this.debug('opening socket connection', {
      lobbyCode: session.lobbyCode,
      socketUrl: session.socketUrl,
      joinOnConnect: session.joinOnConnect !== false,
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

      if (session.joinOnConnect !== false) {
        socket.emit('client:lobby:join');
      }

      if (this.auth.activeGameId() === session.lobbyCode) {
        this.activeGameNoticeSignal.set(DEFAULT_ACTIVE_GAME_NOTICE);
      }
    });

    socket.on('disconnect', () => {
      if (this.socket !== socket) {
        return;
      }

      this.connectionStatusState.set(
        this.sessionState() === null ? 'idle' : 'disconnected'
      );
      if (this.auth.activeGameId() === session.lobbyCode) {
        this.activeGameNoticeSignal.set('Se ha perdido la conexion con la partida. Reintentando...');
      }
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

      this.setGameState({
        state,
        lastAction: readString(normalizedPayload, 'lastAction') ?? undefined,
        receivedAt: Date.now(),
      });
      this.debug('event server:game:state_updated', {
        lastAction: readString(normalizedPayload, 'lastAction') ?? undefined,
        state,
      });
    });

    const handlePrivateHand = (payload: unknown): void => {
      this.handlePrivateHand(payload, session.lobbyCode);
    };

    socket.on('server:game:private_hand', handlePrivateHand);
    socket.on('private:hand', handlePrivateHand);

    socket.on('server:game:special_event', (payload: unknown) => {
      const message = this.resolveSpecialEventMessage(payload);
      if (message) {
        this.pushToast(message);
      }
      this.debug('event server:game:special_event', payload);
    });

    socket.on('server:game:duel_available', (payload: unknown) => {
      const challengerId = readString(asRecord(payload), 'challengerId');
      this.pushToast(
        challengerId
          ? `Duelo disponible para ${challengerId}.`
          : 'Duelo disponible. Elige un rival.'
      );
      this.debug('event server:game:duel_available', payload);
    });

    socket.on('server:game:deck_reshuffled', (payload: unknown) => {
      this.pushToast('El mazo central se ha rebarajado.');
      this.debug('event server:game:deck_reshuffled', payload);
    });

    socket.on('server:game:ended', (payload: unknown) => {
      this.handleGameEnded(payload);
    });

    socket.on('game_ended', (payload: unknown) => {
      this.handleGameEnded(payload);
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
      this.handleGameStarted(payload, 'game:started');
    });

    socket.on('server:game:started', (payload: unknown) => {
      this.handleGameStarted(payload, 'server:game:started');
    });

    socket.on('server:session:recovered', (payload: unknown) => {
      this.handleSessionRecovered(payload, 'server:session:recovered');
    });

    socket.on('session_recovered', (payload: unknown) => {
      this.handleSessionRecovered(payload, 'session_recovered');
    });

    socket.on('server:lobby:recovered', (payload: unknown) => {
      this.handleLobbyRecovered(payload, session.lobbyCode);
    });

    socket.on('server:force_disconnect', (payload: unknown) => {
      const message = this.resolveServerMessage(payload);
      this.lastErrorSignal.set(message);
      this.pushToast(message);
      this.debug('event server:force_disconnect', payload);
      this.disconnect(false);
    });

    socket.on('your_turn', (payload: unknown) => {
      const message = this.resolveServerMessage(payload);
      this.pushToast(
        message === 'Se produjo un error en la conexion realtime'
          ? 'Es tu turno.'
          : message
      );
      this.debug('event your_turn', payload);
    });

    socket.on('opponent_disconnected', (payload: unknown) => {
      const message = this.resolveServerMessage(payload);
      this.activeGameNoticeSignal.set(
        message === 'Se produjo un error en la conexion realtime'
          ? 'Oponente desconectado. Esperando...'
          : message
      );
      this.debug('event opponent_disconnected', payload);
    });

    socket.on('star_spawned', (payload: unknown) => {
      this.pushToast('Ha aparecido una estrella fugaz.');
      this.debug('event star_spawned', payload);
    });

    socket.on('star_claimed', (payload: unknown) => {
      const winnerId = readString(asRecord(payload), 'winnerId');
      this.pushToast(
        winnerId
          ? `La estrella fugaz la ha capturado ${winnerId}.`
          : 'La estrella fugaz ha sido capturada.'
      );
      this.debug('event star_claimed', payload);
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
      joinOnConnect: true,
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

  private extractSocketCredential(session: RealtimeSession): string {
    return session.ticket?.trim() || session.authToken?.trim() || '';
  }

  private handleJoinLobbyError(lobbyCode: string, error: unknown): void {
    if (!isApiRequestErrorStatus(error, 404)) {
      return;
    }

    this.debug('join lobby returned 404, clearing stale active game state', { lobbyCode });
    this.clearRecoveredLobbyState(lobbyCode);
  }

  private clearRecoveredLobbyState(lobbyCode: string): void {
    if (this.sessionState()?.lobbyCode === lobbyCode) {
      this.disconnect(false);
    } else {
      const storedSession = this.restoreSession();
      if (storedSession?.lobbyCode === lobbyCode) {
        localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
      }
      const storedGameState = this.restoreGameState(lobbyCode);
      if (storedGameState) {
        localStorage.removeItem(REALTIME_GAME_STATE_STORAGE_KEY);
      }
    }

    if (this.auth.activeGameId() === lobbyCode) {
      this.auth.setActiveGameId(null);
    }

    this.activeGameNoticeSignal.set('');
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

  private handlePrivateHand(payload: unknown, lobbyCode: string): void {
    const data = asRecord(payload);
    const rawHand = data ? readArray(data, 'hand') : [];
    const hand = rawHand
      .map((cardId) => this.normalizeCardId(cardId))
      .filter((cardId): cardId is number | string => cardId !== null);

    if (hand.length === 0) {
      return;
    }

    this.privateHandSignal.set({
      lobbyCode,
      hand,
      receivedAt: Date.now(),
    });
    this.debug('event server:game:private_hand', { lobbyCode, hand });
  }

  private normalizeCardId(value: unknown): number | string | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    return null;
  }

  private handleSessionRecovered(payload: unknown, eventName: string): void {
    const data = asRecord(payload);
    const wrappedData = asRecord(data?.['data']) ?? data;
    const state = asRecord(wrappedData?.['state']);
    const recoveredGameId =
      readString(wrappedData, 'gameId') ??
      readString(wrappedData, 'lobbyCode') ??
      this.sessionState()?.lobbyCode ??
      '';

    if (!recoveredGameId) {
      return;
    }

    this.auth.setActiveGameId(recoveredGameId);
    this.activeGameNoticeSignal.set(DEFAULT_ACTIVE_GAME_NOTICE);

    if (state) {
      this.setGameState({
        state,
        lastAction: 'SESSION_RECOVERED',
        receivedAt: Date.now(),
      });
    }

    this.debug(`event ${eventName}`, {
      gameId: recoveredGameId,
      hasState: !!state,
    });
  }

  private handleLobbyRecovered(payload: unknown, fallbackLobbyCode: string): void {
    const data = asRecord(payload);
    const wrappedData = asRecord(data?.['data']) ?? data;
    const lobbyData =
      asRecord(wrappedData?.['lobby']) ??
      asRecord(wrappedData?.['state']) ??
      wrappedData;
    const lobbyState = this.normalizeLobbyState(lobbyData, fallbackLobbyCode);

    if (lobbyState) {
      this.lobbyStateSignal.set(lobbyState);
      this.debug('event server:lobby:recovered', lobbyState);
    }
  }

  private handleGameStarted(payload: unknown, eventName: string): void {
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
      this.setGameState({
        state,
        lastAction: 'GAME_STARTED',
        receivedAt: Date.now(),
      });
    }

    this.auth.setActiveGameId(lobbyCode);
    this.activeGameNoticeSignal.set(DEFAULT_ACTIVE_GAME_NOTICE);
    this.gameStartedSignal.set({
      lobbyCode,
      state: state ?? undefined,
      receivedAt: Date.now(),
    });
    this.debug(`event ${eventName}`, {
      lobbyCode,
      hasState: !!state,
    });
  }

  private handleGameEnded(payload: unknown): void {
    const message = this.resolveGameEndedMessage(payload);

    this.gameStateSignal.update((currentState) => ({
      state: currentState?.state ?? {},
      lastAction: 'GAME_ENDED',
      receivedAt: Date.now(),
    }));
    this.auth.setActiveGameId(null);
    this.activeGameNoticeSignal.set('');
    this.pushToast(message);
    this.debug('event game ended', payload);
    this.disconnect(false);
  }

  private resolveGameEndedMessage(payload: unknown): string {
    const data = asRecord(payload);
    const winner =
      readString(data, 'winner') ??
      readString(data, 'winnerUsername') ??
      readString(asRecord(data?.['data']), 'winner');

    if (winner) {
      return `La partida ha terminado. Ganador: ${winner}.`;
    }

    const serverMessage = this.resolveServerMessage(payload);
    if (serverMessage !== 'Se produjo un error en la conexion realtime') {
      return serverMessage;
    }

    return 'La partida ha terminado.';
  }

  private resolveSpecialEventMessage(payload: unknown): string {
    const data = asRecord(payload);
    const effect = readString(data, 'effect');
    if (!effect) {
      return '';
    }

    const playerId = readString(data, 'pId');
    const points = readNumber(data, 'points');
    const squareId = readNumber(data, 'squareId');
    const amount = readNumber(data, 'amount');
    const message = readString(data, 'message');

    switch (effect) {
      case 'ODD':
      case 'EVEN':
        return [
          playerId ?? 'Jugador',
          points !== null ? `${points > 0 ? '+' : ''}${points} pts` : 'casilla especial',
          squareId !== null ? `(casilla ${squareId})` : '',
        ].filter(Boolean).join(' ');
      case 'EQUILIBRIUM':
        return 'Equilibrio: todos avanzan por posicion en el ranking.';
      case 'SHUFFLE':
        return `${playerId ?? 'Un jugador'} cambio toda su mano.`;
      case 'CARD_BONUS':
        return `${playerId ?? 'Un jugador'}: ${amount !== null && amount > 0 ? '+' : ''}${amount ?? 0} cartas por 2 rondas.`;
      default:
        return message ?? `Evento especial: ${effect}.`;
    }
  }

  private pushToast(message: string): void {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      return;
    }

    this.toastSequence += 1;
    this.toastSignal.set({
      id: this.toastSequence,
      message: normalizedMessage,
    });
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

  private buildSessionKey(session: RealtimeSession): string {
    return [
      session.lobbyCode,
      session.socketUrl,
      session.ticket ?? '',
      session.authToken ?? '',
      session.joinOnConnect === false ? 'recovery' : 'join',
    ].join('|');
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

  private setGameState(nextGameState: RealtimeGameStateUpdate): void {
    this.gameStateSignal.set(nextGameState);
    this.persistGameState(nextGameState);
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
        typeof parsedSession.socketUrl !== 'string' ||
        (typeof parsedSession.ticket !== 'string' && typeof parsedSession.authToken !== 'string')
      ) {
        localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
        return null;
      }

      return {
        lobbyCode: parsedSession.lobbyCode,
        ticket:
          typeof parsedSession.ticket === 'string' && parsedSession.ticket.trim()
            ? parsedSession.ticket
            : undefined,
        authToken:
          typeof parsedSession.authToken === 'string' && parsedSession.authToken.trim()
            ? parsedSession.authToken
            : undefined,
        socketUrl: parsedSession.socketUrl,
        joinedAt:
          typeof parsedSession.joinedAt === 'string'
            ? parsedSession.joinedAt
            : new Date().toISOString(),
        joinOnConnect: parsedSession.joinOnConnect !== false,
      };
    } catch {
      localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
      return null;
    }
  }

  private restoreGameState(lobbyCode: string | null): RealtimeGameStateUpdate | null {
    if (!lobbyCode) {
      return null;
    }

    try {
      const rawGameState = localStorage.getItem(REALTIME_GAME_STATE_STORAGE_KEY);
      if (!rawGameState) {
        return null;
      }

      const parsedGameState = JSON.parse(rawGameState) as Partial<RealtimeGameStateUpdate> & {
        lobbyCode?: string;
      };
      if (
        parsedGameState.lobbyCode !== lobbyCode ||
        typeof parsedGameState.state !== 'object' ||
        parsedGameState.state === null ||
        (typeof parsedGameState.lastAction !== 'string' &&
          typeof parsedGameState.lastAction !== 'undefined') ||
        typeof parsedGameState.receivedAt !== 'number'
      ) {
        localStorage.removeItem(REALTIME_GAME_STATE_STORAGE_KEY);
        return null;
      }

      return {
        state: parsedGameState.state as Record<string, unknown>,
        lastAction: parsedGameState.lastAction,
        receivedAt: parsedGameState.receivedAt,
      };
    } catch {
      localStorage.removeItem(REALTIME_GAME_STATE_STORAGE_KEY);
      return null;
    }
  }

  private persistSession(session: RealtimeSession): void {
    if (!session.ticket) {
      localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      REALTIME_SESSION_STORAGE_KEY,
      JSON.stringify({
        lobbyCode: session.lobbyCode,
        ticket: session.ticket,
        socketUrl: session.socketUrl,
        joinedAt: session.joinedAt,
        joinOnConnect: session.joinOnConnect !== false,
      })
    );
  }

  private persistGameState(gameState: RealtimeGameStateUpdate): void {
    const lobbyCode = this.sessionState()?.lobbyCode;
    if (!lobbyCode) {
      localStorage.removeItem(REALTIME_GAME_STATE_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      REALTIME_GAME_STATE_STORAGE_KEY,
      JSON.stringify({
        lobbyCode,
        state: gameState.state,
        lastAction: gameState.lastAction,
        receivedAt: gameState.receivedAt,
      })
    );
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

function readNumber(
  source: Record<string, unknown> | null | undefined,
  key: string
): number | null {
  if (!source) {
    return null;
  }

  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
