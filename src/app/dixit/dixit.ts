import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CardPull } from '../services/card-pull';
import type { DeckCard } from '../services/card-pull';
import { DixitTrackBoard } from './components/track-board';
import type { TrackBoardToken } from './components/track-board';
import type { DixitRankingRow, DixitRevealedCard } from './phases/points-phase';

type DixitPhase = 'hand' | 'choice' | 'points';
type PointsStage = 'waiting' | 'reveal' | 'ranking';

interface PhaseStep {
  id: DixitPhase;
  title: string;
  description: string;
}

interface RosterPlayer {
  id: string;
  name: string;
  color: string;
}

interface RoundPlayer extends RosterPlayer {
  pointsBefore: number;
}

interface PlayerPanelRow extends RosterPlayer {
  points: number;
  isCurrentPlayer: boolean;
}

interface WildcardReward {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
}

interface BoardEffectPopup {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface SpecialCellResolutionOptions {
  allowWildcardReward?: boolean;
}

const PHASE_STEPS: readonly PhaseStep[] = [
  {
    id: 'hand',
    title: 'Elegir carta',
    description: 'Arrastra una carta desde tu mano hasta el tablero para dejarla preparada.',
  },
  {
    id: 'choice',
    title: 'Votacion',
    description: 'Con la pista visible, escoge la carta que quieres votar y confirma tu seleccion.',
  },
  {
    id: 'points',
    title: 'Puntuacion',
    description: 'Simula los eventos de votos, revelado y ranking mientras el tablero sigue visible.',
  },
];

const ROUND_CLUES = [
  'Una mirada perdida.',
  'El eco de un bosque dormido.',
  'Nadie vio venir la tormenta.',
  'La ultima luz antes del silencio.',
] as const;

const WILDCARD_CELL_POSITIONS = [3, 8, 11, 15, 19, 23, 27, 31, 35, 39, 41, 42] as const;
const EVENT_BACK_CELL_POSITIONS = [6, 14, 22, 30, 38] as const;
const EVENT_FORWARD_CELL_POSITIONS = [10, 18, 26, 34, 40] as const;

const WILDCARD_REWARDS: readonly Omit<WildcardReward, 'id'>[] = [
  {
    name: 'Suma 1 punto',
    description: 'Al usarlo durante la fase de mano avanzas 1 casilla.',
    icon: '+1',
    points: 1,
  },
  {
    name: 'Suma 2 puntos',
    description: 'Al usarlo durante la fase de mano avanzas 2 casillas.',
    icon: '+2',
    points: 2,
  },
] as const;

@Component({
  selector: 'app-dixit',
  standalone: true,
  imports: [DixitTrackBoard],
  template: `
    <section class="dixit-table">
      <nav class="dixit-topbar" aria-label="Barra de partida">
        <button type="button" class="topbar-button small" (click)="goHome()">Home</button>

        <div class="phase-banner">
          <p class="eyebrow">Sala {{ id || 'demo' }}</p>
          <div class="phase-current">
            <span class="phase-chip">{{ currentPhaseMeta.title }}</span>
            <p>{{ currentPhaseInstruction }}</p>
          </div>
        </div>

        <div class="topbar-actions">
          <button type="button" class="topbar-button" (click)="goToProfile()">Perfil</button>
          <button type="button" class="topbar-button" (click)="goToSettings()">Ajustes</button>
        </div>
      </nav>

      @if (loading) {
        <article class="status-card">
          <p>Cargando cartas...</p>
        </article>
      } @else if (errorMessage) {
        <article class="status-card error">
          <p>{{ errorMessage }}</p>
        </article>
      } @else if (cards.length === 0) {
        <article class="status-card">
          <p>No se recibieron cartas para la demo.</p>
        </article>
      } @else {
        <div class="table-main">
          @if (phase === 'choice') {
            <section class="phase-stage-screen choice-stage-screen">
              <div class="phase-stage-header">
                <div class="phase-stage-copy">
                  <p class="overlay-label">Votacion</p>
                  <h2>{{ currentClue }}</h2>
                  <p>
                    @if (selectedChoiceCard) {
                      Has elegido {{ selectedChoiceCard.code }}. Puedes cambiarla antes de confirmar.
                    } @else {
                      Elige una carta para votar y confirma tu decision.
                    }
                  </p>
                </div>

                @if (voteSubmitted) {
                  <span class="status-pill">Voto confirmado</span>
                }
              </div>

              <div class="choice-stage-grid">
                @for (card of choiceCards; track card.code) {
                  <button
                    type="button"
                    class="vote-card stage-vote-card"
                    [class.selected]="card.code === selectedChoiceCardCode"
                    [class.locked]="voteSubmitted"
                    (click)="onChoiceCardSelected(card)"
                  >
                    <img
                      draggable="false"
                      [src]="card.image"
                      [alt]="card.value + ' de ' + card.suit"
                    />
                  </button>
                }
              </div>

              <div class="phase-stage-footer">
                <p>
                  @if (selectedChoiceCard) {
                    Tu voto actual es {{ selectedChoiceCard.code }}.
                  } @else {
                    Selecciona una de las cartas para continuar.
                  }
                </p>

                <button
                  type="button"
                  class="sidebar-action"
                  [disabled]="!selectedChoiceCardCode || voteSubmitted"
                  (click)="submitVoteSelection()"
                >
                  Confirmar voto
                </button>
              </div>
            </section>
          } @else if (phase === 'points' && pointsStage !== 'ranking') {
            <section
              class="phase-stage-screen points-stage-screen"
              [class.reveal-stage]="pointsStage === 'reveal'"
              (click)="pointsStage === 'reveal' && simulateRankingShown()"
            >
              <div class="phase-stage-header">
                <div class="phase-stage-copy">
                  <p class="overlay-label">Puntuacion</p>
                  <h2>{{ currentClue }}</h2>
                  @if (pointsStage === 'waiting') {
                    <p>Esperando votos antes de resolver la ronda.</p>
                  } @else if (pointsStage === 'reveal') {
                    <p>Revisa cartas, dueños y votos. Haz clic o espera 3 segundos.</p>
                  }
                </div>

                @if (pointsStage === 'reveal') {
                  <button
                    type="button"
                    class="secondary-action"
                    (click)="$event.stopPropagation(); simulateRankingShown()"
                  >
                    Mostrar puntos ahora
                  </button>
                }
              </div>

              @if (pointsStage === 'waiting') {
                <div class="points-stage-waiting">
                  <p>{{ pointsVotesReceived }} / {{ pointsVotesTotal }} jugadores han votado.</p>
                  <progress [value]="pointsVotesReceived" [max]="pointsVotesTotal || 1"></progress>
                </div>
              } @else if (pointsStage === 'reveal') {
                <div class="reveal-grid stage-reveal-grid">
                  @for (result of pointsRevealedCards; track result.card.code) {
                    <article class="reveal-card stage-reveal-card">
                      <img
                        draggable="false"
                        [src]="result.card.image"
                        [alt]="result.card.value + ' de ' + result.card.suit"
                      />
                      <p class="owner-label">Carta de {{ result.ownerName }}</p>
                      <p class="votes">{{ result.votes }} voto{{ result.votes === 1 ? '' : 's' }}</p>
                    </article>
                  }
                </div>
              }
            </section>
          }

          <app-dixit-track-board
            [title]="''"
            [subtitle]="''"
            [tokens]="boardTokens"
            [wildcardCells]="wildcardCellPositions"
            [eventBackCells]="eventBackCellPositions"
            [eventForwardCells]="eventForwardCellPositions"
            [showControls]="false"
            [interactive]="false"
          >
            @if (phase === 'hand') {
              <div board-overlay class="board-overlay-content">
                <section class="board-overlay-shell" [attr.data-phase]="phase">
                  <div class="story-card hand-overlay">
                    <div class="clue-copy">
                      <span class="overlay-label">Pista actual</span>
                      <h2>{{ currentClue }}</h2>
                      <p>Arrastra una carta al hueco central.</p>
                    </div>

                    <div
                      class="drop-zone"
                      [class.has-card]="!!selectedHandCard"
                      [class.is-dragover]="isDropZoneActive"
                      (dragover)="onDropZoneDragOver($event)"
                      (dragleave)="onDropZoneDragLeave()"
                      (drop)="onDropZoneDrop($event)"
                    >
                      @if (selectedHandCard; as selectedCard) {
                        <img
                          draggable="false"
                          [src]="selectedCard.image"
                          [alt]="selectedCard.value + ' de ' + selectedCard.suit"
                        />
                        <p>Seleccionada: {{ selectedCard.code }}</p>
                      } @else {
                        <p>Suelta aqui tu carta</p>
                      }
                    </div>
                  </div>
                </section>
              </div>
            }
          </app-dixit-track-board>

          @if (phase === 'hand') {
            <section class="table-support">
              <div class="chat-reserved" aria-hidden="true"></div>

              <div class="cards-column">
                <section class="cards-panel hand-cards-panel">
                  <div class="section-header">
                    <div class="section-header-copy">
                      <p class="overlay-label">Tu mano</p>
                      <h3>Cartas disponibles</h3>
                    </div>

                    <div class="section-header-side">
                      <div class="section-header-copy aligned-right">
                        <p class="overlay-label">Comodines</p>
                        <p class="strip-text section-header-note">
                          @if (wildcards.length === 0) {
                            Sin comodines todavia.
                          } @else {
                            Usa uno antes de cerrar tu jugada.
                          }
                        </p>
                      </div>

                      @if (selectedHandCard) {
                        <button type="button" class="secondary-action" (click)="clearHandSelection()">
                          Quitar
                        </button>
                      }
                    </div>
                  </div>

                  <div class="hand-layout">
                    <div class="hand-main">
                      <div class="hand-cards">
                        @for (card of cards; track card.code) {
                          <button
                            type="button"
                            class="hand-card"
                            [class.selected]="card.code === selectedHandCardCode"
                            draggable="true"
                            (dragstart)="onHandCardDragStart(card, $event)"
                            (dragend)="onHandCardDragEnd()"
                            (click)="onHandCardSelected(card)"
                          >
                            <img
                              draggable="false"
                              [src]="card.image"
                              [alt]="card.value + ' de ' + card.suit"
                            />
                          </button>
                        }
                      </div>
                    </div>

                    <aside class="wildcards-strip">
                      @if (wildcards.length > 0) {
                        <div class="wildcards-list">
                          @for (wildcard of wildcards; track wildcard.id) {
                            <button
                              type="button"
                              class="wildcard-card"
                              [disabled]="phase !== 'hand'"
                              (click)="useWildcard(wildcard.id)"
                            >
                              <span class="wildcard-icon" aria-hidden="true">{{ wildcard.icon }}</span>
                              <div class="wildcard-copy">
                                <strong>{{ wildcard.name }}</strong>
                                <p>{{ wildcard.description }}</p>
                              </div>
                            </button>
                          }
                        </div>
                      }
                    </aside>
                  </div>
                </section>
              </div>

              <aside class="players-panel">
                <p class="overlay-label">Jugadores</p>
                <h3>Mesa actual</h3>

                <div class="players-list">
                  @for (player of playerRows; track player.id) {
                    <div class="player-row" [class.self]="player.isCurrentPlayer">
                      <span class="player-dot" [style.background]="player.color"></span>
                      <span class="player-name">{{ player.name }}</span>
                      @if (player.isCurrentPlayer) {
                        <span class="player-tag">Tu</span>
                      }
                    </div>
                  }
                </div>
              </aside>
            </section>
          }
        </div>

        @if (isSimulationDrawerOpen) {
          <button
            type="button"
            class="sim-drawer-backdrop"
            aria-label="Cerrar panel de simulacion"
            (click)="closeSimulationDrawer()"
          ></button>
        }

        <button
          type="button"
          class="sim-drawer-toggle"
          [class.open]="isSimulationDrawerOpen"
          (click)="toggleSimulationDrawer()"
        >
          {{ isSimulationDrawerOpen ? 'Cerrar' : 'Simular' }}
        </button>

        <aside class="sim-drawer" [class.open]="isSimulationDrawerOpen">
          <article class="sim-card">
            <p class="overlay-label">Eventos simulados</p>
            <h3>Websocket</h3>

            <button type="button" class="secondary-action sim-bonus-action" (click)="simulateWildcardReward()">
              Simular: ganar comodin
            </button>

            @if (phase === 'hand') {
              <p>Abre la votacion cuando ya tengas carta.</p>
              <button
                type="button"
                class="sidebar-action"
                [disabled]="!selectedHandCardCode"
                (click)="simulateChoicePhaseOpened()"
              >
                Abrir votacion
              </button>
            } @else if (phase === 'choice') {
              <p>Cierra la votacion y abre la resolucion.</p>
              <button
                type="button"
                class="sidebar-action"
                [disabled]="!voteSubmitted"
                (click)="simulatePointsPhaseOpened()"
              >
                Abrir puntuacion
              </button>
            } @else if (pointsStage === 'waiting') {
              <p>Controla manualmente la llegada de votos.</p>
              <button
                type="button"
                class="sidebar-action"
                [disabled]="pointsVotesReceived >= pointsVotesTotal"
                (click)="simulateVoteReceived()"
              >
                Voto recibido
              </button>
              <button
                type="button"
                class="sidebar-action"
                [disabled]="pointsVotesTotal === 0 || pointsVotesReceived >= pointsVotesTotal"
                (click)="simulateAllVotesReceived()"
              >
                Todos votaron
              </button>
              <button
                type="button"
                class="sidebar-action"
                [disabled]="pointsVotesReceived < pointsVotesTotal"
                (click)="simulateResultsReveal()"
              >
                Revelar cartas
              </button>
            } @else if (pointsStage === 'reveal') {
              <p>Las cartas ya se ven. Puedes forzar ya el movimiento del tablero.</p>
              <button type="button" class="sidebar-action" (click)="simulateRankingShown()">
                Mostrar puntos
              </button>
            } @else {
              <p>Inicia una ronda nueva desde aqui.</p>
              <button type="button" class="sidebar-action" (click)="prepareNextRound()">
                Siguiente ronda
              </button>
            }
          </article>
        </aside>
      }
    </section>

    @if (activeEffectPopup; as popup) {
      <div class="wildcard-popup-backdrop" (click)="closeEffectPopup()">
        <article
          class="wildcard-popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="effect-popup-title"
          (click)="$event.stopPropagation()"
        >
          <p class="overlay-label">Casilla especial</p>
          <h2 id="effect-popup-title">{{ popup.title }}</h2>
          <div class="wildcard-popup-card">
            <span class="wildcard-icon large" aria-hidden="true">{{ popup.icon }}</span>
            <div class="wildcard-copy">
              <strong>{{ popup.title }}</strong>
              <p>{{ popup.description }}</p>
            </div>
          </div>
          <button type="button" class="sidebar-action" (click)="closeEffectPopup()">
            Continuar
          </button>
        </article>
      </div>
    }
  `,
  styleUrl: './dixit.css',
})
export class Dixit implements OnInit, OnDestroy {
  readonly wildcardCellPositions: number[] = [...WILDCARD_CELL_POSITIONS];
  readonly eventBackCellPositions: number[] = [...EVENT_BACK_CELL_POSITIONS];
  readonly eventForwardCellPositions: number[] = [...EVENT_FORWARD_CELL_POSITIONS];

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cardPull = inject(CardPull);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly maxPlayersPerMatch = 6;
  private readonly playerRoster: readonly RosterPlayer[] = [
    { id: 'you', name: 'hackeeper', color: '#ff7725' },
    { id: 'ana', name: 'Azzal-e', color: '#27c93f' },
    { id: 'bruno', name: 'Natur4', color: '#2b79ff' },
    { id: 'carla', name: 'Eduss28', color: '#d645ff' },
    { id: 'diego', name: 'FSPPX', color: '#ff3a3a' },
  ];

  private readonly pointsByPlayer = new Map<string, number>([
    ['you', 12],
    ['ana', 14],
    ['bruno', 19],
    ['carla', 9],
    ['diego', 11],
  ]);

  private currentRoundPlayers: RoundPlayer[] = [];

  id = '';
  phase: DixitPhase = 'hand';
  pointsStage: PointsStage = 'waiting';
  roundNumber = 1;
  cards: DeckCard[] = [];
  choiceCards: DeckCard[] = [];
  boardTokens: TrackBoardToken[] = this.buildBoardTokensFromScores();
  loading = true;
  errorMessage = '';
  selectedHandCardCode = '';
  selectedChoiceCardCode = '';
  draggedHandCardCode = '';
  isDropZoneActive = false;
  voteSubmitted = false;
  currentClue: (typeof ROUND_CLUES)[number] = ROUND_CLUES[0];

  pointsVotesReceived = 0;
  pointsVotesTotal = 0;
  pointsRevealedCards: DixitRevealedCard[] = [];
  pointsRanking: DixitRankingRow[] = [];
  wildcards: WildcardReward[] = [];
  activeEffectPopup: BoardEffectPopup | null = null;
  isSimulationDrawerOpen = false;
  private readonly effectPopupQueue: BoardEffectPopup[] = [];
  private revealRankingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingBoardTokens: TrackBoardToken[] | null = null;

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id')?.trim() ?? '';

    try {
      this.cards = await this.cardPull.getCards(this.maxPlayersPerMatch);
      this.choiceCards = [...this.cards];
      this.boardTokens = this.buildBoardTokensFromScores();
    } catch (error: unknown) {
      console.error('Error al cargar las cartas:', error);
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudieron cargar las cartas';
      this.cards = [];
      this.choiceCards = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.clearRevealRankingTimer();
  }

  get currentPhaseMeta(): PhaseStep {
    return PHASE_STEPS.find((phaseStep) => phaseStep.id === this.phase) ?? PHASE_STEPS[0];
  }

  get selectedHandCard(): DeckCard | undefined {
    return this.cards.find((card) => card.code === this.selectedHandCardCode);
  }

  get selectedChoiceCard(): DeckCard | undefined {
    return this.choiceCards.find((card) => card.code === this.selectedChoiceCardCode);
  }

  get currentPhaseInstruction(): string {
    if (this.phase === 'hand') {
      return 'Elige una carta y colocala en la mesa.';
    }

    if (this.phase === 'choice') {
      return 'Vota arriba y confirma tu decision.';
    }

    if (this.pointsStage === 'waiting') {
      return 'Esperando votos para resolver la ronda.';
    }

    if (this.pointsStage === 'reveal') {
      return 'Revisa cartas, votos y dueños.';
    }

    return 'Tablero actualizado. Prepara la siguiente ronda.';
  }

  get playerRows(): PlayerPanelRow[] {
    return this.playerRoster.map((player) => ({
      ...player,
      points: this.pointsByPlayer.get(player.id) ?? 0,
      isCurrentPlayer: player.id === 'you',
    }));
  }

  onHandCardSelected(card: DeckCard): void {
    this.selectedHandCardCode = card.code;
  }

  onHandCardDragStart(card: DeckCard, event?: DragEvent): void {
    this.draggedHandCardCode = card.code;
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.code);
    }
  }

  onHandCardDragEnd(): void {
    this.draggedHandCardCode = '';
    this.isDropZoneActive = false;
  }

  onDropZoneDragOver(event: DragEvent): void {
    if (this.phase !== 'hand') {
      return;
    }

    event.preventDefault();
    this.isDropZoneActive = true;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDropZoneDragLeave(): void {
    this.isDropZoneActive = false;
  }

  onDropZoneDrop(event: DragEvent): void {
    if (this.phase !== 'hand') {
      return;
    }

    event.preventDefault();
    this.isDropZoneActive = false;

    const droppedCode = event.dataTransfer?.getData('text/plain') || this.draggedHandCardCode;
    const droppedCard = this.cards.find((card) => card.code === droppedCode);
    if (!droppedCard) {
      return;
    }

    this.selectedHandCardCode = droppedCard.code;
    this.draggedHandCardCode = '';
  }

  clearHandSelection(): void {
    this.selectedHandCardCode = '';
  }

  goHome(): void {
    void this.router.navigate(['/']);
  }

  goToProfile(): void {
    void this.router.navigate(['/profile']);
  }

  goToSettings(): void {
    void this.router.navigate(['/settings']);
  }

  toggleSimulationDrawer(): void {
    this.isSimulationDrawerOpen = !this.isSimulationDrawerOpen;
  }

  closeSimulationDrawer(): void {
    this.isSimulationDrawerOpen = false;
  }

  simulateWildcardReward(): void {
    this.grantWildcardReward();
  }

  simulateChoicePhaseOpened(): void {
    if (!this.selectedHandCardCode) {
      return;
    }

    this.phase = 'choice';
    this.selectedChoiceCardCode = '';
    this.voteSubmitted = false;
  }

  onChoiceCardSelected(card: DeckCard): void {
    if (this.phase !== 'choice') {
      return;
    }

    if (this.selectedChoiceCardCode === card.code) {
      this.selectedChoiceCardCode = '';
      this.voteSubmitted = false;
      return;
    }

    this.selectedChoiceCardCode = card.code;
    this.voteSubmitted = false;
  }

  submitVoteSelection(): void {
    if (this.phase !== 'choice' || !this.selectedChoiceCardCode) {
      return;
    }

    this.voteSubmitted = true;
  }

  simulatePointsPhaseOpened(): void {
    if (this.phase !== 'choice' || !this.voteSubmitted) {
      return;
    }

    this.phase = 'points';
    this.initializePointsPhase();
  }

  simulateVoteReceived(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'waiting') {
      return;
    }

    this.pointsVotesReceived = Math.min(this.pointsVotesReceived + 1, this.pointsVotesTotal);
  }

  simulateAllVotesReceived(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'waiting') {
      return;
    }

    this.pointsVotesReceived = this.pointsVotesTotal;
  }

  simulateResultsReveal(): void {
    if (
      this.phase !== 'points' ||
      this.pointsStage !== 'waiting' ||
      this.pointsVotesReceived < this.pointsVotesTotal
    ) {
      return;
    }

    const { revealedCards, ranking } = this.buildRevealAndRanking(this.currentRoundPlayers);
    this.pointsRevealedCards = revealedCards;
    this.pointsRanking = ranking;
    this.pointsStage = 'reveal';
    this.scheduleRevealRanking();
  }

  simulateRankingShown(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'reveal') {
      return;
    }

    this.clearRevealRankingTimer();
    this.applyRevealRankingToBoard();
  }

  prepareNextRound(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'ranking') {
      return;
    }

    this.clearRevealRankingTimer();
    this.roundNumber += 1;
    this.phase = 'hand';
    this.pointsStage = 'waiting';
    this.selectedHandCardCode = '';
    this.selectedChoiceCardCode = '';
    this.draggedHandCardCode = '';
    this.voteSubmitted = false;
    this.isDropZoneActive = false;
    this.pointsVotesReceived = 0;
    this.pointsVotesTotal = 0;
    this.pointsRevealedCards = [];
    this.pointsRanking = [];
    this.currentRoundPlayers = [];
    this.pendingBoardTokens = null;
    this.currentClue = ROUND_CLUES[(this.roundNumber - 1) % ROUND_CLUES.length];
    this.cards = this.rotateCards(this.cards);
    this.choiceCards = [...this.cards];
  }

  closeEffectPopup(): void {
    this.activeEffectPopup = this.effectPopupQueue.shift() ?? null;

    if (this.activeEffectPopup === null && this.pendingBoardTokens !== null) {
      this.boardTokens = this.pendingBoardTokens;
      this.pendingBoardTokens = null;
    }
  }

  useWildcard(wildcardId: string): void {
    if (this.phase !== 'hand') {
      return;
    }

    const wildcard = this.wildcards.find((entry) => entry.id === wildcardId);
    if (!wildcard) {
      return;
    }

    const currentPoints = this.pointsByPlayer.get('you') ?? 0;
    const updatedPoints = currentPoints + wildcard.points;

    this.pointsByPlayer.set('you', updatedPoints);
    this.wildcards = this.wildcards.filter((entry) => entry.id !== wildcardId);
    const resolvedPoints = this.resolveCurrentPlayerSpecialCells(currentPoints, updatedPoints, {
      allowWildcardReward: false,
    });
    this.pointsByPlayer.set('you', resolvedPoints);
    this.boardTokens = this.buildBoardTokensFromScores();
  }

  private initializePointsPhase(): void {
    this.clearRevealRankingTimer();
    this.pointsStage = 'waiting';
    this.pointsRevealedCards = [];
    this.pointsRanking = [];
    this.pendingBoardTokens = null;
    this.currentRoundPlayers = this.getRoundPlayers();
    this.pointsVotesTotal = this.currentRoundPlayers.length;
    this.pointsVotesReceived = this.voteSubmitted && this.pointsVotesTotal > 0 ? 1 : 0;
  }

  private getRoundPlayers(): RoundPlayer[] {
    const totalPlayers = Math.min(this.choiceCards.length, this.playerRoster.length);

    return this.playerRoster.slice(0, totalPlayers).map((player) => ({
      ...player,
      pointsBefore: this.pointsByPlayer.get(player.id) ?? 0,
    }));
  }

  private buildRevealAndRanking(roundPlayers: RoundPlayer[]): {
    revealedCards: DixitRevealedCard[];
    ranking: DixitRankingRow[];
  } {
    const cardsInRound = this.choiceCards.slice(0, roundPlayers.length);
    if (cardsInRound.length === 0) {
      return {
        revealedCards: [],
        ranking: [],
      };
    }

    const activePlayers = roundPlayers.slice(0, cardsInRound.length);
    const voteCounts = new Map<string, number>();
    for (const card of cardsInRound) {
      voteCounts.set(card.code, 0);
    }

    for (let voterIndex = 0; voterIndex < activePlayers.length; voterIndex += 1) {
      const ownCardCode = cardsInRound[voterIndex].code;
      const targetCode = this.resolveVoteCardCode(cardsInRound, voterIndex, ownCardCode);
      if (!targetCode) {
        continue;
      }

      voteCounts.set(targetCode, (voteCounts.get(targetCode) ?? 0) + 1);
    }

    const revealedCards = cardsInRound.map((card, index) => ({
      card,
      ownerName: activePlayers[index].name,
      votes: voteCounts.get(card.code) ?? 0,
    }));

    const ranking = activePlayers
      .map((player, index) => {
        const ownerCardCode = cardsInRound[index].code;
        const pointsEarned = voteCounts.get(ownerCardCode) ?? 0;
        const totalPoints = player.pointsBefore + pointsEarned;

        return {
          playerId: player.id,
          playerName: player.name,
          pointsBefore: player.pointsBefore,
          pointsEarned,
          totalPoints,
        };
      })
      .sort((left, right) => right.totalPoints - left.totalPoints);

    return { revealedCards, ranking };
  }

  private scheduleRevealRanking(): void {
    this.clearRevealRankingTimer();
    this.revealRankingTimer = setTimeout(() => {
      this.applyRevealRankingToBoard();
      this.cdr.detectChanges();
    }, 3000);
  }

  private clearRevealRankingTimer(): void {
    if (this.revealRankingTimer === null) {
      return;
    }

    clearTimeout(this.revealRankingTimer);
    this.revealRankingTimer = null;
  }

  private applyRevealRankingToBoard(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'reveal') {
      return;
    }

    const resolvedRanking = this.pointsRanking.map((row) => ({ ...row }));
    for (const row of resolvedRanking) {
      this.pointsByPlayer.set(row.playerId, row.totalPoints);
    }

    this.applyCurrentPlayerSpecialCells(resolvedRanking);
    this.pointsRanking = resolvedRanking;
    const nextBoardTokens = this.buildBoardTokensFromScores();
    this.pointsStage = 'ranking';

    if (this.activeEffectPopup !== null || this.effectPopupQueue.length > 0) {
      this.pendingBoardTokens = nextBoardTokens;
    } else {
      this.boardTokens = nextBoardTokens;
      this.pendingBoardTokens = null;
    }

    this.revealRankingTimer = null;
  }

  private resolveVoteCardCode(
    cardsInRound: DeckCard[],
    voterIndex: number,
    ownCardCode: string
  ): string | null {
    if (cardsInRound.length <= 1) {
      return null;
    }

    const voter = this.playerRoster[voterIndex];
    if (
      voter?.id === 'you' &&
      this.selectedChoiceCardCode &&
      this.selectedChoiceCardCode !== ownCardCode &&
      cardsInRound.some((card) => card.code === this.selectedChoiceCardCode)
    ) {
      return this.selectedChoiceCardCode;
    }

    let targetIndex = (voterIndex + 1) % cardsInRound.length;
    if (cardsInRound[targetIndex].code === ownCardCode) {
      targetIndex = (targetIndex + 1) % cardsInRound.length;
    }

    const candidate = cardsInRound[targetIndex];
    return candidate.code === ownCardCode ? null : candidate.code;
  }

  private rotateCards(cards: DeckCard[]): DeckCard[] {
    if (cards.length <= 1) {
      return [...cards];
    }

    const [firstCard, ...rest] = cards;
    return [...rest, firstCard];
  }

  private buildBoardTokensFromScores(): TrackBoardToken[] {
    return this.playerRoster.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      position: this.pointsByPlayer.get(player.id) ?? 0,
    }));
  }

  private applyCurrentPlayerSpecialCells(ranking: DixitRankingRow[]): void {
    const currentPlayerPreviousPoints = this.boardTokens.find((token) => token.id === 'you')?.position ?? 0;
    const currentPlayerRow = ranking.find((row) => row.playerId === 'you');

    if (!currentPlayerRow) {
      return;
    }

    const resolvedPoints = this.resolveCurrentPlayerSpecialCells(
      currentPlayerPreviousPoints,
      currentPlayerRow.totalPoints
    );

    if (resolvedPoints === currentPlayerRow.totalPoints) {
      return;
    }

    this.pointsByPlayer.set('you', resolvedPoints);
    currentPlayerRow.pointsEarned = resolvedPoints - currentPlayerRow.pointsBefore;
    currentPlayerRow.totalPoints = resolvedPoints;
    ranking.sort((left, right) => right.totalPoints - left.totalPoints);
  }

  private grantWildcardReward(): void {
    const template =
      WILDCARD_REWARDS[(this.wildcards.length + this.roundNumber - 1) % WILDCARD_REWARDS.length];
    const reward: WildcardReward = {
      id: `wildcard-${this.roundNumber}-${this.wildcards.length + 1}`,
      ...template,
    };

    this.wildcards = [...this.wildcards, reward];
    this.enqueueEffectPopup({
      id: reward.id,
      title: 'Te ha tocado un comodin',
      description: reward.description,
      icon: reward.icon,
    });
  }

  private resolveCurrentPlayerSpecialCells(
    previousPoints: number,
    nextPoints: number,
    options: SpecialCellResolutionOptions = {}
  ): number {
    if (nextPoints === previousPoints) {
      return nextPoints;
    }

    const { allowWildcardReward = true } = options;
    let resolvedPoints = nextPoints;
    const visitedPositions = new Set<number>();
    let safety = 0;

    while (safety < 8 && !visitedPositions.has(resolvedPoints)) {
      visitedPositions.add(resolvedPoints);
      safety += 1;

      if (allowWildcardReward && this.wildcardCellPositions.includes(resolvedPoints)) {
        this.grantWildcardReward();
        break;
      }

      if (this.eventBackCellPositions.includes(resolvedPoints)) {
        resolvedPoints = Math.max(0, resolvedPoints - 1);
        this.enqueueEffectPopup({
          id: `event-back-${this.roundNumber}-${safety}`,
          title: 'Casilla de evento',
          description: 'Has caido en una casilla de evento y retrocedes 1 casilla.',
          icon: '-1',
        });
        continue;
      }

      if (this.eventForwardCellPositions.includes(resolvedPoints)) {
        resolvedPoints += 1;
        this.enqueueEffectPopup({
          id: `event-forward-${this.roundNumber}-${safety}`,
          title: 'Casilla de evento',
          description: 'Has caido en una casilla de evento y avanzas 1 casilla extra.',
          icon: '+1',
        });
        continue;
      }

      break;
    }

    return resolvedPoints;
  }

  private enqueueEffectPopup(popup: BoardEffectPopup): void {
    if (this.activeEffectPopup === null) {
      this.activeEffectPopup = popup;
      return;
    }

    this.effectPopupQueue.push(popup);
  }
}
