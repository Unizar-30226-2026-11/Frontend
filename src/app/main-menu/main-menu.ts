import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Injector,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Game } from '../interfaces/game';
import { RealtimeLobbyPlayer, RealtimeLobbyState } from '../interfaces/dixit-realtime';
import { CardCollectionWithCards, CollectionsPull } from '../services/collections-pull';
import { Auth } from '../services/auth';
import { DixitRealtime } from '../services/dixit-realtime';
import { GamesPull } from '../services/games-pull';

const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';
const LOBBY_MIN_PLAYERS = 3;

interface MenuCollectionCard {
  id: string;
  title: string;
  imageUrl: string;
  locked: boolean;
}

interface MenuCardCollection {
  id: string;
  name: string;
  total: number;
  collected: number;
  cards: MenuCollectionCard[];
}

interface CommunityCard {
  id: number;
  title: string;
  imageUrl: string;
}

interface RoomSlot {
  slotId: number;
  name: string;
  state: string;
}

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [],
  template: `
  <section class="menu-layout">
    <section class="lobby-preview">
      <article class="panel my-cards">
        <header class="panel-header">
          <h2>Mis Cartas:</h2>
          <span class="badge">{{ collectedCards }}/{{ totalCards }}</span>
        </header>

        <div class="cards-scroll">
          @if (cardsLoading) {
            <p class="cards-status">Cargando colecciones...</p>
          } @else if (cardsError) {
            <p class="cards-status">{{ cardsError }}</p>
          } @else if (collections.length === 0) {
            <p class="cards-status">No hay cartas disponibles.</p>
          } @else {
            @for (collection of collections; track collection.id) {
              <section>
                <header class="collection-header">
                  <h3 class="collection-title">{{ collection.name }}</h3>
                  <span class="badge small">{{ collection.collected }}/{{ collection.total }}</span>
                </header>

                <div class="cards-grid">
                  @for (card of collection.cards; track card.id) {
                    <article class="card-tile" [attr.title]="card.title">
                      <img [src]="card.imageUrl" [alt]="card.title" loading="lazy" />
                      @if (card.locked) {
                        <div class="locked-overlay" aria-label="Carta bloqueada">🔒</div>
                      }
                      <span class="card-id">{{ card.title }}</span>
                    </article>
                  }
                </div>
              </section>
            }
          }
        </div>
      </article>

      <article class="panel community-card">
        <h2>Carta de la Comunidad:</h2>
        <figure class="community-figure">
          <img [src]="currentCommunityCard.imageUrl" [alt]="currentCommunityCard.title" />
        </figure>
        <h3 class="community-title">{{ currentCommunityCard.title }}</h3>
        <div class="community-actions">
          <button type="button" class="round-btn" (click)="previousCommunityCard()" aria-label="Carta anterior">↑</button>
          <button type="button" class="round-btn" (click)="nextCommunityCard()" aria-label="Carta siguiente">↓</button>
          <span class="badge dark">{{ currentCommunityCard.id }}</span>
          <div class="stars" aria-label="Valorar carta">
            @for (star of [1, 2, 3, 4, 5]; track star) {
              <button
                type="button"
                class="star"
                [class.active]="star <= currentRating"
                (click)="setRating(star)"
                [attr.aria-label]="'Puntuar con ' + star + ' estrellas'">
                ★
              </button>
            }
          </div>
        </div>
      </article>

      @if (shouldShowJoinOverlay) {
        <div class="join-overlay">
          <div class="join-overlay-card">
            <p class="join-overlay-eyebrow">Lobby en vista previa</p>
            <h2>Unete para abrir la conexion realtime</h2>
            <p>{{ joinOverlayMessage }}</p>
            @if (primaryActionError && !hasJoinedLobby) {
              <p class="action-feedback error">{{ primaryActionError }}</p>
            }
            <button
              type="button"
              class="join-overlay-button"
              [disabled]="roomLoading || joinLobbyLoading"
              (click)="joinCurrentLobby()"
            >
              {{ joinLobbyLoading ? 'Uniendome...' : 'Unirme' }}
            </button>
          </div>
        </div>
      }
    </section>

    <section class="right-column">
      <article class="panel room-panel">
        <header class="panel-header">
          <h2>Sala actual:</h2>
          <span class="badge">{{ playersInRoom }}/{{ roomCapacity }}</span>
        </header>
        <div class="room-scroll">
          @if (roomLoading) {
            <p class="room-status">Cargando sala...</p>
          } @else if (roomError) {
            <p class="room-status">{{ roomError }}</p>
          } @else if (roomSlots.length === 0) {
            <p class="room-status">No hay jugadores en la sala.</p>
          } @else {
            @for (slot of roomSlots; track slot.slotId) {
              <div class="room-slot" [class.ready]="slot.state === 'listo'">
                <span class="slot-name">{{ slot.name }}</span>
                <span class="slot-state">{{ slot.state }}</span>
              </div>
            }
          }
        </div>
      </article>

      <label class="select-label">
        Seleccion Mapa
        <select class="choice-select">
        @for (map of maps; track map) {
          <option>{{ map }}</option>
        }
        </select>
      </label>

      <label class="select-label">
        Seleccion Mazo
        <select class="choice-select">
        @for (deck of decks; track deck) {
          <option>{{ deck }}</option>
        }
        </select>
      </label>

      @if (primaryActionMessage) {
        <p class="action-feedback success">{{ primaryActionMessage }}</p>
      }

      @if (primaryActionError) {
        <p class="action-feedback error">{{ primaryActionError }}</p>
      }

      <button
        type="button"
        class="queue-btn"
        [disabled]="isPrimaryActionDisabled"
        (click)="onPrimaryAction()"
      >
        {{ primaryActionButtonText }}
      </button>

      <p class="action-hint">{{ primaryActionHint }}</p>

      <p class="action-hint">{{ realtimeStatusText }}</p>
    </section>
  </section>
  `,
  styleUrl: './main-menu.css',
})
export class MainMenu implements OnInit {
  readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gamesPull = inject(GamesPull);
  private readonly realtime = inject(DixitRealtime);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private currentLobbyCode = '';
  private currentLobby: Game | null = null;
  private currentLobbyPlayers: RealtimeLobbyPlayer[] = [];
  private handledGameStartedAt = 0;

  totalCards = 0;
  collectedCards = 0;
  roomCapacity = 0;
  playersInRoom = 0;
  currentRating = 3;
  currentCardIndex = 0;
  cardsLoading = true;
  cardsError = '';
  roomLoading = true;
  roomError = '';
  primaryActionLoading = false;
  primaryActionError = '';
  primaryActionMessage = '';
  joinLobbyLoading = false;
  isReady = false;
  collections: MenuCardCollection[] = [];

  maps = ['Costa Sumergida', 'Bosque Inverso', 'Ciudad Onirica'];
  decks = ['Surrealista', 'Sketch', 'Dream-Core'];

  roomSlots: RoomSlot[] = [];

  communityCards: CommunityCard[] = [
    { id: 458, title: 'Donde nacen las sombras', imageUrl: 'https://picsum.photos/seed/atr-community-458/520/700' },
    { id: 459, title: 'Sueño fractal en rojo', imageUrl: 'https://picsum.photos/seed/atr-community-459/520/700' },
    { id: 460, title: 'La puerta que respira', imageUrl: 'https://picsum.photos/seed/atr-community-460/520/700' },
    { id: 461, title: 'Jardin de cristal roto', imageUrl: 'https://picsum.photos/seed/atr-community-461/520/700' },
  ];

  constructor(
    private readonly collectionsPull: CollectionsPull,
    private readonly cdr: ChangeDetectorRef
  ) {
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
        } else {
          this.primaryActionMessage = '';
          this.primaryActionError = realtimeError;
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
        void this.router.navigateByUrl(`/dixit/${encodeURIComponent(gameStarted.lobbyCode)}`);
      },
      { injector: this.injector }
    );
  }

  get isHost(): boolean {
    return !!this.currentLobby && this.currentPlayerId === this.currentLobby.hostId;
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
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const lobbyCode = params.get('id')?.trim() ?? '';
        void this.loadLobby(lobbyCode);
      });

    await this.loadCollections();
  }

  get currentCommunityCard(): CommunityCard {
    return this.communityCards[this.currentCardIndex];
  }

  previousCommunityCard(): void {
    this.currentCardIndex = (this.currentCardIndex - 1 + this.communityCards.length) % this.communityCards.length;
  }

  nextCommunityCard(): void {
    this.currentCardIndex = (this.currentCardIndex + 1) % this.communityCards.length;
  }

  setRating(rating: number): void {
    this.currentRating = rating;
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

  private async loadCollections(): Promise<void> {
    this.cardsLoading = true;
    this.cardsError = '';

    try {
      const collections = await this.collectionsPull.getCollectionsWithCards();
      this.collections = this.toMenuCollections(collections);
      this.collectedCards = this.collections.reduce(
        (total, collection) => total + collection.collected,
        0
      );
      this.totalCards = this.collections.reduce(
        (total, collection) => total + collection.total,
        0
      );
    } catch (error) {
      console.error('[MainMenu] Error al cargar colecciones:', error);
      this.cardsError =
        error instanceof Error ? error.message : 'No se pudieron cargar las colecciones';
      this.collections = [];
      this.collectedCards = 0;
      this.totalCards = 0;
    } finally {
      this.cardsLoading = false;
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
    this.roomCapacity = 0;
    this.playersInRoom = 0;
    this.currentLobbyPlayers = [];
    this.roomSlots = [];

    const lobbyResult = await this.gamesPull.getGameDetails(lobbyCode, { forceRefresh: true })
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

      if (this.shouldRestoreRealtimeConnection(lobby)) {
        this.joinLobbyLoading = true;
        try {
          await this.realtime.ensureLobbyConnection(lobbyCode);
        } catch (error) {
          console.error('[MainMenu] Error al restaurar la conexion realtime:', error);
          this.primaryActionMessage = '';
          this.primaryActionError =
            error instanceof Error
              ? error.message
              : 'No se pudo restaurar la conexion realtime con la sala';
        } finally {
          if (this.currentLobbyCode === lobbyCode) {
            this.joinLobbyLoading = false;
          }
        }
      }

      const realtimeLobbyState = this.realtime.lobbyState();
      if (this.realtime.activeLobbyCode() === lobbyCode && realtimeLobbyState?.code === lobbyCode) {
        this.applyRealtimeLobbyState(realtimeLobbyState);
      }
    } else if (this.currentLobbyPlayers.length === 0) {
      console.error('[MainMenu] Error al cargar la sala:', lobbyResult.reason);
      this.roomError =
        lobbyResult.reason instanceof Error
          ? lobbyResult.reason.message
          : 'No se pudo cargar la sala';
    }

    if (this.currentLobbyCode === lobbyCode) {
      this.roomLoading = false;
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

  private toMenuCollections(
    collections: CardCollectionWithCards[]
  ): MenuCardCollection[] {
    return collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      total: collection.totalCards > 0 ? collection.totalCards : collection.cards.length,
      collected: collection.cards.length,
      cards: collection.cards.map((card) => ({
        id: card.idCard,
        title: card.title,
        imageUrl: card.imageUrl || DEFAULT_CARD_IMAGE,
        locked: false,
      })),
    }));
  }

  private get currentPlayerId(): string {
    return this.auth.session()?.user.id ?? '';
  }

  private shouldRestoreRealtimeConnection(lobby: Game): boolean {
    const currentPlayerId = this.currentPlayerId;
    return !!currentPlayerId && lobby.players.includes(currentPlayerId);
  }

  async joinCurrentLobby(): Promise<void> {
    if (!this.currentLobbyCode || this.joinLobbyLoading || this.hasJoinedLobby) {
      return;
    }

    this.joinLobbyLoading = true;
    this.primaryActionError = '';
    this.primaryActionMessage = '';

    try {
      await this.realtime.joinLobby(this.currentLobbyCode);
      const realtimeLobbyState = this.realtime.lobbyState();
      if (realtimeLobbyState?.code === this.currentLobbyCode) {
        this.applyRealtimeLobbyState(realtimeLobbyState);
      }
    } catch (error) {
      console.error('[MainMenu] Error al unirse a la sala:', error);
      this.primaryActionError =
        error instanceof Error
          ? error.message
          : 'No se pudo abrir la conexion realtime con la sala';
    } finally {
      this.joinLobbyLoading = false;
      this.cdr.detectChanges();
    }
  }

  private toggleReadyState(): void {
    this.isReady = !this.isReady;
    this.primaryActionError = '';
    this.primaryActionMessage = this.isReady
      ? 'Estado listo actualizado en local. Falta conectar el evento real con el backend.'
      : 'Has vuelto al estado pendiente.';
    console.info(
      '[MainMenu] El estado "Listo" sigue siendo local; todavia no hay evento websocket implementado para esto.',
      { isReady: this.isReady, lobbyCode: this.currentLobbyCode }
    );

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
      this.realtime.startLobby();
      if (this.currentLobbyCode !== lobbyCode) {
        return;
      }
      this.primaryActionMessage = 'Solicitud de inicio enviada. Esperando al servidor.';
    } catch (error) {
      console.error('[MainMenu] Error al iniciar la partida:', error);
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
}
