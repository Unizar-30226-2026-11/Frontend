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
  RealtimeDuelChallenge,
  RealtimeStarClaim,
  RealtimeStarSpawn,
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
const LOBBY_MIN_PLAYERS = 3;

@Injectable({
  providedIn: 'root',
})
export class DixitRealtime {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);
  // Se restaura una sola vez para no leer/parsing localStorage dos veces
  // durante la construcción del servicio.
  private readonly restoredSession = this.restoreSession();

  private socket: SocketIoClient | null = null;
  private connectionPromise: Promise<void> | null = null;
  private connectionSessionKey = '';
  private toastSequence = 0;
  private lastGameStateReceivedAt = 0;

  private readonly sessionState = signal<RealtimeSession | null>(this.restoredSession);
  private readonly connectionStatusState = signal<DixitConnectionStatus>('idle');
  private readonly lobbyStateSignal = signal<RealtimeLobbyState | null>(null);
  private readonly gameStateSignal = signal<RealtimeGameStateUpdate | null>(
    this.restoreGameState(this.restoredSession?.lobbyCode ?? null)
  );
  private readonly gameStartedSignal = signal<RealtimeGameStarted | null>(null);
  private readonly privateHandSignal = signal<RealtimePrivateHand | null>(null);
  private readonly duelChallengeSignal = signal<RealtimeDuelChallenge | null>(null);
  // Estado efímero de efectos visuales del tablero.
  // activeStar representa una estrella aún disponible para capturar.
  private readonly activeStarSignal = signal<RealtimeStarSpawn | null>(null);
  // starClaim conserva el último resultado de captura para que la UI pueda
  // mostrar el banner de ganador y actualizar puntuaciones sin depender de otro evento.
  private readonly starClaimSignal = signal<RealtimeStarClaim | null>(null);
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
  readonly duelChallenge = computed(() => this.duelChallengeSignal());
  readonly activeStar = computed(() => this.activeStarSignal());
  readonly starClaim = computed(() => this.starClaimSignal());
  readonly chatMessages = computed(() => this.chatMessagesSignal());
  readonly lastError = computed(() => this.lastErrorSignal());
  readonly activeGameNotice = computed(() => this.activeGameNoticeSignal());
  readonly toast = computed(() => this.toastSignal());

  // Pide al backend un ticket/socket URL válidos para una lobby y deja preparada
  // la sesión local antes de abrir el websocket.
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

  // Reutiliza una conexión existente o una sesión restaurada si siguen siendo
  // válidas; si no, vuelve a ejecutar el flujo completo de join.
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

  // Se usa al arrancar la app cuando Auth conserva una partida activa. El objetivo
  // es volver a enlazar el websocket sin obligar al usuario a navegar manualmente.
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

  // Solicita el inicio de partida desde la sala. No toca estado local: espera
  // a que el servidor confirme con los eventos correspondientes.
  startLobby(useDynamicPool?: boolean): void {
    const payload =
      typeof useDynamicPool === 'boolean' ? { useDynamicPool } : {};
    this.debug('emit client:lobby:start', payload);
    this.emit('client:lobby:start', payload);
  }

  // Fuerza desde cliente la aparición de una estrella en entornos donde el
  // backend expone ese comando. La resolución real sigue siendo del servidor.
  triggerStar(): void {
    this.debug('emit client:game:trigger_star');
    this.emit('client:game:trigger_star', {
      lobbyCode: this.requireSession().lobbyCode,
    });
  }

  // Intenta reclamar la estrella activa. La recompensa final solo se materializa
  // cuando llega star_claimed con las puntuaciones oficiales.
  claimStar(): void {
    this.debug('emit client:game:claim_star');
    this.emit('client:game:claim_star', {
      lobbyCode: this.requireSession().lobbyCode,
    });
  }

  // Canal unificado de acciones de juego. Encapsula lobbyCode y payload para que
  // el resto de la UI no tenga que conocer detalles del socket.
  sendGameAction(actionType: DixitGameActionType, payload: Record<string, unknown> = {}): void {
    this.debug(`emit client:game:action ${actionType}`, payload);
    this.emit('client:game:action', {
      lobbyCode: this.requireSession().lobbyCode,
      actionType,
      payload,
    });
  }

  // Envía un mensaje de chat a la sala activa ignorando cadenas vacías o con
  // solo espacios.
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

  // Notifica al servidor la salida voluntaria de la lobby y limpia la conexión local.
  leaveLobby(): void {
    if (this.socket !== null) {
      this.debug('emit client:lobby:leave');
      this.socket.emit('client:lobby:leave');
    }

    this.disconnect(false);
  }

  // Descarta el toast visible una vez consumido por la UI.
  clearToast(): void {
    this.toastSignal.set(null);
  }

  // Cierra el estado efímero del duelo cuando el modal se ha gestionado.
  clearDuelChallenge(): void {
    this.duelChallengeSignal.set(null);
  }

  // La UI consume starClaim como evento efímero; después de procesarlo
  // lo limpia para no reejecutar el mismo efecto en cada render.
  clearStarClaim(): void {
    this.starClaimSignal.set(null);
  }

  // Desconecta el websocket y, opcionalmente, destruye por completo la sesión
  // recuperable guardada en memoria/localStorage.
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
    this.duelChallengeSignal.set(null);
    this.activeStarSignal.set(null);
    this.starClaimSignal.set(null);
    this.chatMessagesSignal.set([]);
    this.lastErrorSignal.set('');
    this.activeGameNoticeSignal.set('');
    this.toastSignal.set(null);
    this.lastGameStateReceivedAt = 0;
    localStorage.removeItem(REALTIME_SESSION_STORAGE_KEY);
    localStorage.removeItem(REALTIME_GAME_STATE_STORAGE_KEY);
  }

  // Evita abrir conexiones duplicadas para la misma sesión y serializa los intentos
  // de conexión concurrentes detrás de una única promesa.
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

  // Construye la instancia real de Socket.IO con la autenticación adecuada y
  // enlaza todos los listeners de la sala.
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

  // Registra todos los listeners websocket y traduce cada evento del backend al
  // estado reactivo que consume el frontend.
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
      this.duelChallengeSignal.set({
        challengerId: challengerId ?? '',
        receivedAt: Date.now(),
      });
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

    // El backend puede emitir la estrella con o sin prefijo server:game:.
    // Ambos caminos alimentan el mismo estado normalizado.
    const handleStarSpawned = (payload: unknown, eventName: string): void => {
      const star = this.normalizeStarSpawn(payload);
      if (!star) {
        return;
      }

      this.activeStarSignal.set(star);
      this.starClaimSignal.set(null);
      this.pushToast('Ha aparecido una estrella fugaz.');
      this.debug(`event ${eventName}`, star);
    };

    // Cuando alguien captura la estrella, se invalida el objetivo activo y
    // se publica el resultado con las puntuaciones completas recalculadas.
    const handleStarClaimed = (payload: unknown, eventName: string): void => {
      const claim = this.normalizeStarClaim(payload);
      if (!claim) {
        return;
      }

      this.activeStarSignal.set(null);
      this.starClaimSignal.set(claim);
      this.pushToast(
        claim.winnerId
          ? `La estrella fugaz la ha capturado ${claim.winnerId}.`
          : 'La estrella fugaz ha sido capturada.'
      );
      this.debug(`event ${eventName}`, claim);
    };

    socket.on('star_spawned', (payload: unknown) => {
      handleStarSpawned(payload, 'star_spawned');
    });

    socket.on('server:game:star_spawned', (payload: unknown) => {
      handleStarSpawned(payload, 'server:game:star_spawned');
    });

    socket.on('star_claimed', (payload: unknown) => {
      handleStarClaimed(payload, 'star_claimed');
    });

    socket.on('server:game:star_claimed', (payload: unknown) => {
      handleStarClaimed(payload, 'server:game:star_claimed');
    });
  }

  // Espera a que el socket confirme la conexión o falle por timeout/connect_error
  // antes de dar por establecida la sesión realtime.
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

  // Wrapper seguro para emitir por socket: centraliza la comprobación de conexión
  // viva y produce un error consistente si la UI intenta emitir demasiado pronto.
  private emit(event: string, payload: Record<string, unknown>): void {
    if (this.socket === null || !this.socket.connected) {
      throw new Error('La conexion realtime de la sala no esta disponible');
    }

    this.socket.emit(event, payload);
  }

  // Convierte la respuesta REST de join en una sesión websocket lista para usar.
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

  // Extrae el ticket/token de join aceptando las distintas variantes de payload
  // que puede devolver el backend.
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

  // Resuelve la URL del servidor Socket.IO a partir de la respuesta del backend
  // o, como fallback, de la ubicación actual del navegador.
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

  // Devuelve la credencial efectiva que se enviará en auth al abrir el socket.
  private extractSocketCredential(session: RealtimeSession): string {
    return session.ticket?.trim() || session.authToken?.trim() || '';
  }

  // Si el join devuelve 404, asume que la sesión recuperada era obsoleta y limpia
  // el rastro local para no dejar al usuario atrapado en una partida inexistente.
  private handleJoinLobbyError(lobbyCode: string, error: unknown): void {
    if (!isApiRequestErrorStatus(error, 404)) {
      return;
    }

    this.debug('join lobby returned 404, clearing stale active game state', { lobbyCode });
    this.clearRecoveredLobbyState(lobbyCode);
  }

  // Elimina estado persistido asociado a una lobby cuando se detecta que ya no
  // existe o ha dejado de ser válida.
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

  // Fallback para entornos donde el backend no devuelve una URL explícita de socket.
  private resolveDefaultSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:3000`;
  }

  // Normaliza el estado público de lobby para que el frontend opere siempre con
  // una estructura estable independientemente del shape original del payload.
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

  // Convierte cada jugador de lobby a un objeto homogéneo; acepta strings simples
  // o registros con varios alias de campos.
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

  // Normaliza un mensaje de chat recibido por websocket y descarta payloads incompletos.
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

  // Procesa la mano privada enviada por websocket y la publica solo si contiene
  // al menos una carta válida.
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

  // Las cartas pueden viajar como número o string según el evento de backend.
  // Aquí se conserva cualquiera de las dos formas válidas.
  private normalizeCardId(value: unknown): number | string | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    return null;
  }

  // Recupera el estado de partida incluido en session_recovered/server:session:recovered
  // y lo trata igual que un state_updated reciente.
  private handleSessionRecovered(payload: unknown, eventName: string): void {
    const data = asRecord(payload);
    const wrappedData = asRecord(data?.['data']) ?? data;
    const state = this.extractRecoveredGameState(wrappedData);
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

  // Algunas recuperaciones llegan como estado de lobby con un gameState embebido.
  // Este método actualiza ambos mundos: roster de sala y partida pública.
  private handleLobbyRecovered(payload: unknown, fallbackLobbyCode: string): void {
    const data = asRecord(payload);
    const wrappedData = asRecord(data?.['data']) ?? data;
    const recoveredGameState = this.extractRecoveredGameState(wrappedData);
    const lobbyData =
      asRecord(wrappedData?.['lobby']) ??
      asRecord(wrappedData?.['state']) ??
      wrappedData;
    const lobbyState = this.normalizeLobbyState(lobbyData, fallbackLobbyCode);

    if (lobbyState) {
      this.lobbyStateSignal.set(lobbyState);
      this.debug('event server:lobby:recovered', lobbyState);
    }

    if (recoveredGameState) {
      this.setGameState({
        state: recoveredGameState,
        lastAction: 'LOBBY_RECOVERED',
        receivedAt: Date.now(),
      });
      this.debug('event server:lobby:recovered game state', recoveredGameState);
    }
  }

  // Traduce el evento de inicio de partida a estado persistente y marca la sala
  // como juego activo dentro de Auth.
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

  // Resuelve el fin de partida: emite mensaje final, limpia activeGameId y cierra
  // la sesión realtime local.
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

  // Construye un mensaje legible de fin de partida a partir del payload del servidor.
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

  // Convierte los payloads heterogéneos de casillas/eventos especiales a un texto
  // breve para el sistema de toast global.
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

  // Publica un toast efímero incrementando un id secuencial para que la UI pueda
  // distinguir mensajes repetidos.
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

  // Garantiza que las llamadas REST previas al websocket tengan token de sesión.
  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para unirte a la sala');
    }

    return token;
  }

  // Garantiza que existe una sesión realtime antes de emitir acciones por socket.
  private requireSession(): RealtimeSession {
    const session = this.sessionState();
    if (!session) {
      throw new Error('No hay una sala realtime activa');
    }

    return session;
  }

  // Unifica el formato del código de lobby usado en toda la capa realtime.
  private normalizeLobbyCode(lobbyCode: string): string {
    const normalizedLobbyCode = lobbyCode.trim().toUpperCase();
    if (!normalizedLobbyCode) {
      throw new Error('No se encontro el codigo de la sala');
    }

    return normalizedLobbyCode;
  }

  // Genera una huella de sesión para saber cuándo dos intentos de conexión apuntan
  // exactamente al mismo contexto websocket.
  private buildSessionKey(session: RealtimeSession): string {
    return [
      session.lobbyCode,
      session.socketUrl,
      session.ticket ?? '',
      session.authToken ?? '',
      session.joinOnConnect === false ? 'recovery' : 'join',
    ].join('|');
  }

  // Da prioridad al mensaje explícito del error nativo de Socket.IO cuando existe.
  private resolveSocketErrorMessage(payload: unknown): string {
    if (payload instanceof Error && payload.message.trim()) {
      return payload.message;
    }

    return this.resolveServerMessage(payload);
  }

  // Extrae un mensaje genérico de error enviado por backend en eventos websocket.
  private resolveServerMessage(payload: unknown): string {
    const data = asRecord(payload);
    const message = readString(data, 'message');
    if (!message) {
      return 'Se produjo un error en la conexion realtime';
    }

    if (message.includes('${LOBBY_MIN_PLAYERS}')) {
      return `Se requieren al menos ${LOBBY_MIN_PLAYERS} jugadores para iniciar.`;
    }

    return message;
  }

  // Guarda el último state público recibido ignorando eventos más viejos que el
  // ya aplicado localmente.
  private setGameState(nextGameState: RealtimeGameStateUpdate): void {
    if (nextGameState.receivedAt < this.lastGameStateReceivedAt) {
      return;
    }

    this.lastGameStateReceivedAt = nextGameState.receivedAt;
    this.gameStateSignal.set(nextGameState);
    this.persistGameState(nextGameState);
  }

  // Busca el gameState utilizable dentro de los distintos envoltorios que puede
  // traer un evento de recuperación.
  private extractRecoveredGameState(
    wrappedData: Record<string, unknown> | null
  ): Record<string, unknown> | null {
    if (!wrappedData) {
      return null;
    }

    const candidates = [
      asRecord(wrappedData['gameState']),
      asRecord(wrappedData['currentGameState']),
      asRecord(wrappedData['publicGameState']),
      asRecord(wrappedData['state']),
    ];

    return candidates.find((candidate) => this.looksLikeGameState(candidate)) ?? null;
  }

  // Heurística mínima para decidir si un registro cualquiera se parece realmente
  // a un estado público de partida.
  private looksLikeGameState(state: Record<string, unknown> | null): boolean {
    if (!state) {
      return false;
    }

    return (
      typeof state['phase'] === 'string' ||
      typeof state['mode'] === 'string' ||
      asRecord(state['currentRound']) !== null ||
      asRecord(state['scores']) !== null
    );
  }

  private normalizeStarSpawn(payload: unknown): RealtimeStarSpawn | null {
    // El backend entrega start/end como porcentaje de pantalla (0..100).
    // Aquí validamos y acotamos ese rango para que el overlay pueda usarlo
    // directamente con left.% y top.% sin convertir a píxeles.
    const data = asRecord(payload);
    const path = asRecord(data?.['path']);
    const start = asRecord(path?.['start']);
    const end = asRecord(path?.['end']);
    const startX = this.clampPercentage(readNumber(start, 'x'));
    const startY = this.clampPercentage(readNumber(start, 'y'));
    const endX = this.clampPercentage(readNumber(end, 'x'));
    const endY = this.clampPercentage(readNumber(end, 'y'));

    if (startX === null || startY === null || endX === null || endY === null) {
      return null;
    }

    return {
      starId: readString(data, 'starId') ?? `star_${Date.now()}`,
      path: {
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
      },
      duration: this.normalizeStarDuration(readNumber(data, 'duration')),
      receivedAt: Date.now(),
    };
  }

  private normalizeStarClaim(payload: unknown): RealtimeStarClaim | null {
    // newScores llega como diccionario abierto. Filtramos solo números finitos
    // para no contaminar el marcador local con valores inválidos.
    const data = asRecord(payload);
    if (!data) {
      return null;
    }

    const scoreRecord = asRecord(data['newScores']) ?? {};
    const newScores: Record<string, number> = {};
    for (const [playerId, scoreValue] of Object.entries(scoreRecord)) {
      if (typeof scoreValue === 'number' && Number.isFinite(scoreValue)) {
        newScores[playerId] = scoreValue;
      }
    }

    return {
      winnerId: readString(data, 'winnerId') ?? '',
      newScores,
      receivedAt: Date.now(),
    };
  }

  private normalizeStarDuration(duration: number | null): number {
    // Se aplica una banda razonable para evitar animaciones instantáneas o
    // excesivamente largas si el payload viniera corrupto.
    if (duration === null) {
      return 2500;
    }

    return Math.max(1200, Math.min(6000, Math.round(duration)));
  }

  private clampPercentage(value: number | null): number | null {
    // Las coordenadas de la estrella están definidas como porcentaje de pantalla.
    // Cualquier valor fuera de rango se limita al viewport visible.
    if (value === null) {
      return null;
    }

    return Math.max(0, Math.min(100, value));
  }

  // Restaura una sesión websocket persistida en localStorage si sigue teniendo
  // la estructura mínima necesaria para reconectar.
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

  // Restaura el último estado público persistido de una lobby concreta para que
  // la UI arranque con contexto incluso antes del primer evento websocket.
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

  // Persiste solo la parte de sesión que sirve para reconectar en futuros refresh.
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

  // Guarda el último gameState aplicado para soportar recuperación tras F5.
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

  // Logging unificado de la capa realtime para depurar secuencia de eventos websocket.
  private debug(message: string, payload?: unknown): void {
    if (payload === undefined) {
      console.info(`${REALTIME_LOG_PREFIX} ${message}`);
      return;
    }

    console.info(`${REALTIME_LOG_PREFIX} ${message}`, payload);
  }
}

// Helper de parsing seguro para payloads websocket: solo acepta objetos no nulos.
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

// Devuelve un array solo si la clave existe y ya viene como lista.
function readArray(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

// Lee strings opcionales del payload websocket descartando vacíos.
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

// Lee números opcionales del payload websocket descartando NaN e infinitos.
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
