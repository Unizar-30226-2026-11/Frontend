import { Component, DestroyRef, Injector, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { buildGameRoute, Game, type LobbyEngine } from '../interfaces/game';
import {
  RealtimeGameStarted,
  RealtimeLobbyPlayer,
  RealtimeLobbyState,
} from '../interfaces/dixit-realtime';
import { Auth } from '../services/auth';
import { DecksPull, type UserDeckSummary } from '../services/decks-pull';
import { DixitRealtime } from '../services/dixit-realtime';
import { GamesPull } from '../services/games-pull';
import { MenuShowcase } from '../menu-showcase/menu-showcase';
import { MenuShowcaseState } from '../menu-showcase/menu-showcase-base';
import { readLocalStorage, writeLocalStorage } from '../utils/browser-storage';

const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';
const LOBBY_MIN_PLAYERS = 3;

interface RoomSlot {
  slotId: number;
  name: string;
  state: string;
}

@Component({
  selector: 'app-lobby-menu',
  standalone: true,
  imports: [MenuShowcase],
  templateUrl: './lobby-menu.html',
  styleUrl: './lobby-menu.css',
})
export class LobbyMenu extends MenuShowcaseState implements OnInit {
  readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gamesPull = inject(GamesPull);
  private readonly decksPull = inject(DecksPull);
  private readonly realtime = inject(DixitRealtime);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private currentLobbyCode = '';
  private currentLobby: Game | null = null;
  private currentLobbyPlayers: RealtimeLobbyPlayer[] = [];
  private handledGameStartedAt = 0;

  roomCapacity = 0;
  playersInRoom = 0;
  roomLoading = true;
  roomError = '';
  primaryActionLoading = false;
  primaryActionError = '';
  primaryActionMessage = '';
  joinLobbyLoading = false;
  joinOverlayError = '';
  isReady = false;
  useDynamicPool = true;
  deckOptions: UserDeckSummary[] = [];
  selectedDeckId = '';
  deckSelectionLoading = false;
  deckSelectionError = '';

  roomSlots: RoomSlot[] = [];

  constructor() {
    super();
    effect(
      () => {
        const lobbyState = this.realtime.lobbyState();
        if (!lobbyState || lobbyState.code !== this.currentLobbyCode) {
          return;
        }

        this.applyRealtimeLobbyState(lobbyState);
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const activeLobbyCode = this.realtime.activeLobbyCode();
        const realtimeError = this.realtime.lastError();
        if (!realtimeError || activeLobbyCode !== this.currentLobbyCode) {
          return;
        }

        this.primaryActionLoading = false;
        if (this.currentLobby === null) {
          this.roomError = realtimeError;
          this.roomLoading = false;
        }

        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const gameStarted = this.realtime.gameStarted();
        if (
          !gameStarted ||
          gameStarted.lobbyCode !== this.currentLobbyCode ||
          gameStarted.receivedAt <= this.handledGameStartedAt
        ) {
          return;
        }

        this.handledGameStartedAt = gameStarted.receivedAt;
        this.primaryActionLoading = false;
        this.primaryActionMessage = 'La partida ha comenzado. Entrando en la mesa.';
        void this.router.navigateByUrl(
          buildGameRoute(gameStarted.lobbyCode, this.resolveStartedGameEngine(gameStarted))
        );
      },
      { injector: this.injector }
    );
  }

  get isHost(): boolean {
    return !!this.currentLobby && this.currentPlayerId === this.currentLobby.hostId;
  }

  get lobbyDisplayName(): string {
    return (
      this.currentLobby?.title?.trim() ||
      (this.roomLoading ? 'Cargando sala...' : 'Sala sin nombre')
    );
  }

  get lobbyDisplayCode(): string {
    return this.currentLobbyCode || '----';
  }

  get primaryActionButtonText(): string {
    if (this.primaryActionLoading) {
      return this.isHost ? 'Iniciando partida...' : 'Actualizando...';
    }

    if (this.isHost) {
      return this.currentLobby?.status === 'waiting' ? 'Empezar partida' : 'Partida en curso';
    }

    return this.isReady ? 'Cancelar listo' : 'Listo';
  }

  get primaryActionHint(): string {
    if (this.isRealtimeConnecting) {
      return 'Estamos recuperando la conexion realtime del lobby.';
    }

    if (!this.hasJoinedLobby) {
      return 'Primero unete al lobby para abrir la conexion realtime.';
    }

    if (this.isHost) {
      return 'Al pulsar este boton se emitira el evento realtime para arrancar la partida.';
    }

    return this.isReady
      ? 'Tu estado de listo sigue siendo local, pero el lobby ya se actualiza en tiempo real.'
      : 'Marca tu estado de listo mientras esperamos la validacion realtime de presencia.';
  }

  get realtimeStatusText(): string {
    if (this.realtime.activeLobbyCode() === this.currentLobbyCode) {
      switch (this.realtime.connectionStatus()) {
        case 'joining':
          return 'Solicitando ticket realtime para la sala...';
        case 'connecting':
          return 'Conectando al websocket del lobby...';
        case 'connected':
          return 'Lobby conectado en tiempo real.';
        case 'disconnected':
          return 'Conexion realtime perdida. Vuelve a intentarse al entrar en la sala.';
        case 'error':
          return this.realtime.lastError() || 'No se pudo establecer la conexion realtime.';
        default:
          return 'Realtime pendiente de conexion.';
      }
    }

    if (!this.hasJoinedLobby) {
      return 'Aun no te has unido a la sala en tiempo real.';
    }

    switch (this.realtime.connectionStatus()) {
      case 'joining':
      case 'connecting':
      case 'disconnected':
      case 'error':
        return 'Realtime activo en otra sala.';
      default:
        return 'Realtime sin inicializar para esta sala.';
    }
  }

  get isPrimaryActionDisabled(): boolean {
    return (
      this.roomLoading ||
      this.joinLobbyLoading ||
      this.primaryActionLoading ||
      !!this.roomError ||
      !this.currentLobby ||
      !this.auth.isLoggedIn() ||
      !this.hasJoinedLobby ||
      this.currentLobby.status !== 'waiting' ||
      this.realtime.connectionStatus() !== 'connected'
    );
  }

  get hasJoinedLobby(): boolean {
    return (
      this.realtime.activeLobbyCode() === this.currentLobbyCode &&
      this.realtime.connectionStatus() === 'connected'
    );
  }

  get shouldShowJoinOverlay(): boolean {
    return !!this.currentLobby && !this.hasJoinedLobby && !this.isRealtimeConnecting;
  }

  get joinOverlayMessage(): string {
    if (this.isRealtimeConnecting) {
      return 'Solicitando acceso y conectando al websocket de la sala.';
    }

    return 'Puedes ver la sala, pero las acciones del lobby y la partida solo se activan al unirte.';
  }

  get isRealtimeConnecting(): boolean {
    if (this.realtime.activeLobbyCode() !== this.currentLobbyCode) {
      return this.joinLobbyLoading;
    }

    const connectionStatus = this.realtime.connectionStatus();
    return (
      this.joinLobbyLoading ||
      connectionStatus === 'joining' ||
      connectionStatus === 'connecting'
    );
  }

  async ngOnInit(): Promise<void> {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const lobbyCode = params.get('id')?.trim() ?? '';
      void this.loadLobby(lobbyCode);
    });

    await this.loadShowcaseData();
  }

  async onPrimaryAction(): Promise<void> {
    if (this.isPrimaryActionDisabled) {
      return;
    }

    if (this.isHost) {
      await this.startMatch();
      return;
    }

    this.toggleReadyState();
  }

  async joinCurrentLobby(): Promise<void> {
    if (!this.currentLobbyCode || this.joinLobbyLoading || this.hasJoinedLobby) {
      return;
    }

    this.joinLobbyLoading = true;
    this.primaryActionError = '';
    this.primaryActionMessage = '';
    this.joinOverlayError = '';

    try {
      await this.realtime.joinLobby(this.currentLobbyCode);
      const realtimeLobbyState = this.realtime.lobbyState();
      if (realtimeLobbyState?.code === this.currentLobbyCode) {
        this.applyRealtimeLobbyState(realtimeLobbyState);
      }
    } catch (error) {
      console.error('[LobbyMenu] Error al unirse a la sala:', error);
      this.joinOverlayError =
        error instanceof Error
          ? error.message
          : 'No se pudo abrir la conexion realtime con la sala';
    } finally {
      this.joinLobbyLoading = false;
      this.cdr.detectChanges();
    }
  }

  private async loadLobby(lobbyCode: string): Promise<void> {
    if (!lobbyCode) {
      this.currentLobbyCode = '';
      this.currentLobby = null;
      this.roomError = 'No se encontro el codigo de la sala';
      this.roomLoading = false;
      this.roomCapacity = 0;
      this.playersInRoom = 0;
      this.currentLobbyPlayers = [];
      this.roomSlots = [];
      return;
    }

    this.currentLobbyCode = lobbyCode;
    this.currentLobby = null;
    this.roomLoading = true;
    this.roomError = '';
    this.isReady = false;
    this.resetPrimaryActionFeedback();
    this.joinOverlayError = '';
    this.deckSelectionError = '';
    this.roomCapacity = 0;
    this.playersInRoom = 0;
    this.currentLobbyPlayers = [];
    this.roomSlots = [];
    const deckOptionsPromise = this.loadDeckOptions();

    const lobbyResult = await this.gamesPull
      .getGameDetails(lobbyCode, { forceRefresh: true })
      .then((lobby) => ({ status: 'fulfilled' as const, value: lobby }))
      .catch((error: unknown) => ({ status: 'rejected' as const, reason: error }));

    if (this.currentLobbyCode !== lobbyCode) {
      return;
    }

    if (lobbyResult.status === 'fulfilled') {
      const lobby = lobbyResult.value;
      this.currentLobby = lobby;
      this.roomCapacity = lobby.maxPlayers;
      this.playersInRoom = lobby.playerCount;
      this.roomSlots = this.toRoomSlots(lobby);

      const realtimeLobbyState = this.realtime.lobbyState();
      if (this.realtime.activeLobbyCode() === lobbyCode && realtimeLobbyState?.code === lobbyCode) {
        this.applyRealtimeLobbyState(realtimeLobbyState);
      }

      this.roomLoading = false;
      this.cdr.detectChanges();

      void deckOptionsPromise.then(() => {
        if (this.currentLobbyCode !== lobbyCode || this.currentLobby?.id !== lobby.id) {
          return;
        }

        this.restoreSelectedDeck(lobbyCode, lobby.selectedDeckId ?? null);
        this.cdr.detectChanges();
      });

      this.restoreRealtimeConnectionInBackground(lobbyCode, lobby);
    } else if (this.currentLobbyPlayers.length === 0) {
      console.error('[LobbyMenu] Error al cargar la sala:', lobbyResult.reason);
      this.roomError =
        lobbyResult.reason instanceof Error
          ? lobbyResult.reason.message
          : 'No se pudo cargar la sala';
      this.roomLoading = false;
      this.cdr.detectChanges();
    }
  }

  onDynamicPoolChanged(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }

    this.useDynamicPool = target.value !== 'false';
  }

  async onDeckSelected(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement | null;
    if (!target || !this.currentLobbyCode || this.deckSelectionLoading) {
      return;
    }

    const nextDeckId = target.value.trim();
    const normalizedDeckId = nextDeckId || '';
    const previousDeckId = this.selectedDeckId;
    const selectedDeck = this.deckOptions.find((deck) => deck.id === normalizedDeckId);

    if (normalizedDeckId && !selectedDeck) {
      this.deckSelectionError = 'El mazo seleccionado no esta disponible.';
      this.selectedDeckId = previousDeckId;
      return;
    }

    this.selectedDeckId = normalizedDeckId;
    this.deckSelectionLoading = true;
    this.deckSelectionError = '';

    try {
      if (selectedDeck) {
        await this.decksPull.updateUserDeck(selectedDeck.id, {
          name: selectedDeck.name,
          cardIds: [...selectedDeck.cardIds],
        });
      }

      if (this.currentLobby) {
        this.currentLobby = {
          ...this.currentLobby,
          selectedDeckId: normalizedDeckId || null,
        };
      }
      this.selectedDeckId = normalizedDeckId;
      writeLocalStorage(this.buildLobbyDeckStorageKey(this.currentLobbyCode), this.selectedDeckId);
    } catch (error) {
      console.error('[LobbyMenu] Error al actualizar el mazo del lobby:', error);
      this.selectedDeckId = previousDeckId;
      this.deckSelectionError =
        error instanceof Error ? error.message : 'No se pudo actualizar el mazo seleccionado.';
    } finally {
      this.deckSelectionLoading = false;
      this.cdr.detectChanges();
    }
  }

  private toRoomSlots(lobby: Game): RoomSlot[] {
    const currentPlayerId = this.currentPlayerId;
    const players =
      this.currentLobbyPlayers.length > 0
        ? this.currentLobbyPlayers
        : lobby.players.map((playerId) => ({
            id: playerId,
            username: playerId,
          }));

    const occupiedSlots = players.map((player, index) => ({
      slotId: index + 1,
      name: player.username,
      state:
        player.id === lobby.hostId
          ? 'anfitrion'
          : player.id === currentPlayerId && this.isReady
            ? 'listo'
            : 'jugador',
    }));

    const freeSlots = Array.from(
      { length: Math.max(lobby.maxPlayers - occupiedSlots.length, 0) },
      (_, index) => ({
        slotId: occupiedSlots.length + index + 1,
        name: 'slot libre',
        state: 'abierto',
      })
    );

    return [...occupiedSlots, ...freeSlots];
  }

  private get currentPlayerId(): string {
    return this.auth.session()?.user.id ?? '';
  }

  private shouldRestoreRealtimeConnection(lobby: Game): boolean {
    const currentPlayerId = this.currentPlayerId;
    return !!currentPlayerId && lobby.players.includes(currentPlayerId);
  }

  private restoreRealtimeConnectionInBackground(lobbyCode: string, lobby: Game): void {
    if (!this.shouldRestoreRealtimeConnection(lobby)) {
      return;
    }

    this.joinLobbyLoading = true;
    this.cdr.detectChanges();

    void this.realtime
      .ensureLobbyConnection(lobbyCode)
      .then(() => {
        if (this.currentLobbyCode !== lobbyCode) {
          return;
        }

        const realtimeLobbyState = this.realtime.lobbyState();
        if (this.realtime.activeLobbyCode() === lobbyCode && realtimeLobbyState?.code === lobbyCode) {
          this.applyRealtimeLobbyState(realtimeLobbyState);
        }
      })
      .catch((error) => {
        console.error('[LobbyMenu] Error al restaurar la conexion realtime:', error);
        if (this.currentLobbyCode !== lobbyCode) {
          return;
        }

        this.primaryActionMessage = '';
      })
      .finally(() => {
        if (this.currentLobbyCode === lobbyCode) {
          this.joinLobbyLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private toggleReadyState(): void {
    this.isReady = !this.isReady;
    this.primaryActionError = '';
    this.primaryActionMessage = this.isReady
      ? 'Estado listo actualizado en local. Falta conectar el evento real con el backend.'
      : 'Has vuelto al estado pendiente.';

    if (this.currentLobby) {
      this.roomSlots = this.toRoomSlots(this.currentLobby);
    }
  }

  private async startMatch(): Promise<void> {
    const lobbyCode = this.currentLobbyCode;
    const currentLobby = this.currentLobby;

    if (!lobbyCode || !currentLobby || !this.isHost) {
      return;
    }

    this.primaryActionLoading = true;
    this.resetPrimaryActionFeedback();

    try {
      this.realtime.startLobby(this.useDynamicPool);
      if (this.currentLobbyCode !== lobbyCode) {
        return;
      }
      this.primaryActionMessage = 'Solicitud de inicio enviada. Esperando al servidor.';
    } catch (error) {
      console.error('[LobbyMenu] Error al iniciar la partida:', error);
      this.primaryActionError =
        error instanceof Error
          ? this.normalizePrimaryActionError(error.message)
          : 'No se pudo iniciar la partida';
    } finally {
      this.primaryActionLoading = false;
      this.cdr.detectChanges();
    }
  }

  private normalizePrimaryActionError(message: string): string {
    if (message.includes('${LOBBY_MIN_PLAYERS}')) {
      return `Se requieren al menos ${LOBBY_MIN_PLAYERS} jugadores para iniciar.`;
    }

    return message;
  }

  private resetPrimaryActionFeedback(): void {
    this.primaryActionError = '';
    this.primaryActionMessage = '';
  }

  private async loadDeckOptions(): Promise<void> {
    try {
      this.deckOptions = await this.decksPull.getUserDecks({ forceRefresh: true });
    } catch (error) {
      console.error('[LobbyMenu] Error al cargar mazos del usuario:', error);
      this.deckOptions = [];
      this.deckSelectionError =
        error instanceof Error ? error.message : 'No se pudieron cargar tus mazos.';
    }
  }

  private restoreSelectedDeck(lobbyCode: string, backendSelectedDeckId: string | null): void {
    const localDeckId = readLocalStorage(this.buildLobbyDeckStorageKey(lobbyCode)) ?? '';
    const preferredDeckId = backendSelectedDeckId?.trim() || localDeckId;
    const hasPreferredDeck = this.deckOptions.some((deck) => deck.id === preferredDeckId);
    this.selectedDeckId = hasPreferredDeck ? preferredDeckId : '';
  }

  private buildLobbyDeckStorageKey(lobbyCode: string): string {
    return `ator:lobby:${lobbyCode}:selected-deck`;
  }

  private applyRealtimeLobbyState(lobbyState: RealtimeLobbyState): void {
    this.currentLobbyPlayers = lobbyState.players;
    this.playersInRoom = lobbyState.players.length;
    this.roomCapacity =
      this.currentLobby?.maxPlayers ?? Math.max(this.playersInRoom, this.roomCapacity, 3);

    const fallbackLobby: Game = this.currentLobby ?? {
      id: lobbyState.code,
      title: `Sala ${lobbyState.code}`,
      description: `Classic - ${this.playersInRoom}/${this.roomCapacity} jugadores`,
      image: DEFAULT_CARD_IMAGE,
      hostId: lobbyState.hostId,
      players: lobbyState.players.map((player) => player.id),
      playerCount: this.playersInRoom,
      maxPlayers: this.roomCapacity,
      engine: 'Classic',
      status: 'waiting',
      isPrivate: false,
    };

    this.currentLobby = {
      ...fallbackLobby,
      id: lobbyState.code,
      hostId: lobbyState.hostId || fallbackLobby.hostId,
      players: lobbyState.players.map((player) => player.id),
      playerCount: this.playersInRoom,
      maxPlayers: this.roomCapacity,
    };
    this.roomSlots = this.toRoomSlots(this.currentLobby);
    this.roomError = '';
    this.roomLoading = false;
  }

  private resolveCurrentLobbyEngine(state?: Record<string, unknown>): LobbyEngine {
    const realtimeMode =
      typeof state?.['mode'] === 'string' ? state['mode'].trim().toUpperCase() : '';
    if (realtimeMode === 'STELLA') {
      return 'Stella';
    }

    return this.currentLobby?.engine ?? 'Classic';
  }

  private resolveStartedGameEngine(gameStarted: RealtimeGameStarted): LobbyEngine {
    return gameStarted.engine ?? this.resolveCurrentLobbyEngine(gameStarted.state);
  }
}
