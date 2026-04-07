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
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.css',
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
        name: '',
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
      const startResult = await this.gamesPull.startLobby(lobbyCode, currentLobby.engine);
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
