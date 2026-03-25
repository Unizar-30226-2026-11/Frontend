import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Game } from '../interfaces/game';
import { CardCollectionWithCards, CollectionsPull } from '../services/collections-pull';
import { Auth } from '../services/auth';
import { GamesPull } from '../services/games-pull';

const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';

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
    </section>
  </section>
  `,
  styles: `
    :host {
      display: block;
      height: calc(100dvh - 72px);
      padding: 16px 20px 18px;
      box-sizing: border-box;
      overflow: hidden;
      --main-panel-height: calc(100dvh - 120px);
    }

    .menu-layout {
      display: grid;
      grid-template-columns: minmax(280px, 360px) minmax(300px, 430px) minmax(260px, 1fr);
      gap: 20px;
      align-items: start;
      height: 100%;
    }

    .panel {
      background: rgba(236, 234, 236, 0.92);
      border-radius: 10px;
      padding: 16px;
      box-sizing: border-box;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    h2 {
      margin: 0;
      font-size: clamp(1.4rem, 2vw, 2rem);
      font-weight: 500;
      color: #141414;
    }

    .badge {
      background: #101014;
      color: #f7f7f7;
      border-radius: 4px;
      font-weight: 700;
      font-size: 1.7rem;
      line-height: 1;
      padding: 6px 10px;
      white-space: nowrap;
    }

    .badge.small {
      font-size: 1rem;
      padding: 4px 8px;
    }

    .badge.dark {
      border-radius: 2px;
      font-size: 1.45rem;
    }

    .my-cards {
      height: var(--main-panel-height);
      display: flex;
      flex-direction: column;
    }

    .cards-scroll {
      overflow-y: auto;
      padding-right: 8px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .cards-status {
      margin: 0;
      color: #141414;
      font-size: 1rem;
    }

    .collection-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
    }

    .collection-title {
      color: #000 !important;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .card-tile {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      aspect-ratio: 3 / 4;
      background: #243428;
    }

    .locked-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 22, 19, 0.66);
      color: #f0dd9f;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.7rem;
      backdrop-filter: blur(1px);
    }

    .card-tile img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .card-id {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 7px;
      background: rgba(15, 17, 20, 0.76);
      color: #fff;
      font-size: 0.75rem;
      border-radius: 5px;
      padding: 2px 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .community-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      height: var(--main-panel-height);
      background: linear-gradient(180deg, rgba(236, 231, 229, 0.94), rgba(220, 213, 209, 0.93));
      box-shadow: 0 0 22px rgba(214, 104, 70, 0.5);
    }

    .community-figure {
      margin: 0;
      border-radius: 22px;
      overflow: hidden;
      flex: 1;
      min-height: 0;
      background: #1e2226;
    }

    .community-figure img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .community-title {
      margin: 0;
      font-size: clamp(1.5rem, 2.2vw, 2.2rem);
      font-weight: 500;
    }

    .community-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .round-btn {
      width: 48px;
      height: 48px;
      border-radius: 999px;
      border: none;
      background: #13151a;
      color: #fff;
      font-size: 1.5rem;
      cursor: pointer;
    }

    .stars {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }

    .star {
      border: none;
      background: transparent;
      font-size: 2rem;
      line-height: 1;
      color: #a7a0b5;
      cursor: pointer;
      padding: 0;
    }

    .star.active {
      color: #1a1b20;
    }

    .right-column {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding-top: 2px;
    }

    .room-panel {
      height: 300px;
      display: flex;
      flex-direction: column;
    }

    .room-scroll {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-right: 6px;
    }

    .room-status {
      margin: 0;
      color: #141414;
      font-size: 1rem;
    }

    .room-slot {
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 8px;
      background: #b0b0b2;
      padding: 10px 10px;
      color: #0f1114;
      font-size: 1rem;
    }

    .room-slot.ready {
      background: #d7ebbc;
    }

    .slot-name {
      font-weight: 700;
    }

    .slot-state {
      margin-left: auto;
      font-size: 0.95rem;
    }

    .select-label {
      font-size: 0.95rem;
      color: #dde8cf;
      margin-top: 2px;
    }

    .choice-select {
      width: 100%;
      border: 1.5px solid rgba(24, 58, 52, 0.8);
      border-radius: 14px;
      background:
        linear-gradient(180deg, rgba(210, 237, 214, 0.94), rgba(185, 222, 196, 0.92));
      color: #16312d;
      font-size: 1.45rem;
      line-height: 1.15;
      font-weight: 600;
      padding: 12px 44px 12px 14px;
      box-sizing: border-box;
      appearance: none;
      box-shadow: 0 6px 14px rgba(8, 28, 28, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5);
      background-image:
        linear-gradient(45deg, transparent 50%, #244a43 50%),
        linear-gradient(135deg, #244a43 50%, transparent 50%),
        linear-gradient(180deg, rgba(210, 237, 214, 0.94), rgba(185, 222, 196, 0.92));
      background-position:
        calc(100% - 20px) calc(50% - 4px),
        calc(100% - 14px) calc(50% - 4px),
        0 0;
      background-size: 6px 6px, 6px 6px, 100% 100%;
      background-repeat: no-repeat;
    }

    .queue-btn {
      margin: 10px auto 0;
      border: 2px solid rgba(31, 55, 62, 0.45);
      border-radius: 16px;
      background: rgba(204, 232, 199, 0.9);
      color: #1a2629;
      font-size: 2rem;
      line-height: 1.1;
      padding: 12px 18px;
      cursor: pointer;
    }

    .queue-btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .action-feedback,
    .action-hint {
      margin: 0;
      text-align: center;
    }

    .action-feedback {
      font-size: 0.96rem;
    }

    .action-feedback.success {
      color: #d5efc0;
    }

    .action-feedback.error {
      color: #ffd1d1;
    }

    .action-hint {
      color: #dde8cf;
      font-size: 0.92rem;
      line-height: 1.35;
    }

    @media (max-width: 1250px) {
      :host {
        height: auto;
        min-height: calc(100dvh - 72px);
        overflow: visible;
      }

      .menu-layout {
        grid-template-columns: 1fr 1fr;
        height: auto;
      }

      .right-column {
        grid-column: span 2;
      }

      .my-cards {
        height: 540px;
      }

      .community-card {
        height: 540px;
      }
    }

    @media (max-width: 860px) {
      :host {
        padding: 14px 14px 18px;
      }

      .menu-layout {
        grid-template-columns: 1fr;
      }

      .right-column {
        grid-column: auto;
      }

      .my-cards {
        height: 460px;
      }

      .community-card {
        height: 460px;
      }

      .cards-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .choice-select {
        font-size: 1.35rem;
      }

      .queue-btn {
        font-size: 1.5rem;
      }
    }
  `,
})
export class MainMenu implements OnInit {
  readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gamesPull = inject(GamesPull);
  private readonly destroyRef = inject(DestroyRef);
  private currentLobbyCode = '';
  private currentLobby: Game | null = null;

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
  ) {}

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
    if (this.isHost) {
      return 'Al pulsar este boton se lanzara la llamada al backend para arrancar la partida.';
    }

    return this.isReady
      ? 'Tu estado de listo queda reflejado localmente hasta conectar los eventos en tiempo real.'
      : 'Marca tu estado de listo mientras se termina la integracion de presencia con el backend.';
  }

  get isPrimaryActionDisabled(): boolean {
    return (
      this.roomLoading ||
      this.primaryActionLoading ||
      !!this.roomError ||
      !this.currentLobby ||
      !this.auth.isLoggedIn() ||
      this.currentLobby.status !== 'waiting'
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
    this.roomSlots = [];

    try {
      const lobby = await this.gamesPull.getGameDetails(lobbyCode);
      if (this.currentLobbyCode !== lobbyCode) {
        return;
      }
      this.currentLobby = lobby;
      this.roomCapacity = lobby.maxPlayers;
      this.playersInRoom = lobby.playerCount;
      this.roomSlots = this.toRoomSlots(lobby);
    } catch (error) {
      if (this.currentLobbyCode !== lobbyCode) {
        return;
      }
      console.error('[MainMenu] Error al cargar la sala:', error);
      this.currentLobby = null;
      this.roomError = error instanceof Error ? error.message : 'No se pudo cargar la sala';
      this.roomCapacity = 0;
      this.playersInRoom = 0;
      this.roomSlots = [];
    } finally {
      if (this.currentLobbyCode === lobbyCode) {
        this.roomLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  private toRoomSlots(lobby: Game): RoomSlot[] {
    const currentPlayerId = this.currentPlayerId;
    const occupiedSlots = lobby.players.map((playerId, index) => ({
      slotId: index + 1,
      name: playerId,
      state:
        playerId === lobby.hostId
          ? 'anfitrion'
          : playerId === currentPlayerId && this.isReady
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
        imageUrl: DEFAULT_CARD_IMAGE,
        locked: false,
      })),
    }));
  }

  private get currentPlayerId(): string {
    return this.auth.session()?.user.id ?? '';
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
      const startResult = await this.gamesPull.startLobby(lobbyCode);
      if (this.currentLobbyCode !== lobbyCode) {
        return;
      }
      this.primaryActionMessage = startResult.message;
      this.currentLobby = {
        ...currentLobby,
        status: startResult.status,
      };
      await this.router.navigateByUrl(startResult.route);
    } catch (error) {
      console.error('[MainMenu] Error al iniciar la partida:', error);
      this.primaryActionError =
        error instanceof Error ? error.message : 'No se pudo iniciar la partida';
    } finally {
      this.primaryActionLoading = false;
      this.cdr.detectChanges();
    }
  }

  private resetPrimaryActionFeedback(): void {
    this.primaryActionError = '';
    this.primaryActionMessage = '';
  }
}
