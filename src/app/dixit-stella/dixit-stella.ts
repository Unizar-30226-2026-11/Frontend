import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Game } from '../interfaces/game';
import { WordCard } from '../interfaces/word-card';
import { DeckCard } from '../services/card-pull';
import { GamesPull } from '../services/games-pull';
import { StellaCardPull } from '../services/stella-card-pull';
import { WordCardPull } from '../services/word-card-pull';

type StellaPhase = 'association' | 'announce' | 'reveal' | 'scoring' | 'finished';
type LanternState = 'LIGHT' | 'DARK';
type RevealOutcome = 'super-spark' | 'spark' | 'fall';

interface PhaseMeta {
  title: string;
  description: string;
}

interface StellaPlayerState {
  id: string;
  name: string;
  color: string;
  score: number;
  selection: string[];
  selectionCount: number;
  submitted: boolean;
  lanternState: LanternState;
  hasFallen: boolean;
  revealedSelectionCodes: string[];
  roundPoints: number;
  successfulAssociations: number;
  isCurrentUser: boolean;
}

interface RevealLogEntry {
  id: number;
  explorerName: string;
  cardCode: string;
  cardLabel: string;
  matchingPlayerNames: string[];
  outcome: RevealOutcome;
  outcomeLabel: string;
}

interface ScoringSummaryRow {
  playerId: string;
  playerName: string;
  scoreBefore: number;
  roundPoints: number;
  penalty: number;
  netPoints: number;
  totalScore: number;
}

const BOARD_COLUMNS = 5;
const BOARD_ROWS = 3;
const BOARD_CARD_COUNT = BOARD_COLUMNS * BOARD_ROWS;
const TOTAL_ROUNDS = 4;
const MIN_SELECTIONS = 1;
const MAX_SELECTIONS = 10;

const PHASE_META: Record<StellaPhase, PhaseMeta> = {
  association: {
    title: 'Asociacion',
    description: 'Selecciona entre 1 y 10 cartas que conecten con la palabra activa.',
  },
  announce: {
    title: 'Anuncio',
    description: 'Solo se revela cuantas cartas ha marcado cada jugador.',
  },
  reveal: {
    title: 'Revelado',
    description: 'El explorador resuelve una carta cada vez hasta caer o vaciar su seleccion.',
  },
  scoring: {
    title: 'Puntuacion',
    description: 'Se consolidan las chispas, se aplica Oscuridad y se limpia la ronda.',
  },
  finished: {
    title: 'Final',
    description: 'Tras cuatro rondas se decide la victoria, incluso compartida si hay empate.',
  },
};

const PLAYER_COLORS = ['#ff9f43', '#49dcb1', '#5b8def', '#f76ed7', '#ff6b6b', '#f4d35e'] as const;
const DEMO_PLAYER_NAMES = ['Ariel', 'Berta', 'Cael', 'Dora', 'Elio', 'Faro'] as const;

@Component({
  selector: 'app-dixit-stella',
  standalone: true,
  template: `
    <section class="stella-table">
      <nav class="stella-topbar" aria-label="Barra de partida Stella">
        <button type="button" class="topbar-button small" (click)="goHome()">Home</button>

        <div class="topbar-center">
          <p class="eyebrow">{{ roomTitle }}</p>
          <div class="round-meta">
            <span class="phase-chip">{{ currentPhaseMeta.title }}</span>
            <span class="round-chip">Ronda {{ roundNumber }}/{{ totalRounds }}</span>
          </div>
          <p class="phase-copy">{{ currentPhaseMeta.description }}</p>
        </div>

        <div class="topbar-actions">
          <button type="button" class="topbar-button" (click)="goToProfile()">Perfil</button>
          <button type="button" class="topbar-button" (click)="goToSettings()">Ajustes</button>
        </div>
      </nav>

      @if (loading) {
        <article class="status-card">
          <p>Cargando la mesa Stella...</p>
        </article>
      } @else if (errorMessage) {
        <article class="status-card error">
          <p>{{ errorMessage }}</p>
        </article>
      } @else {
        <div class="stella-layout">
          <aside class="players-panel">
            <div class="panel-header">
              <p class="eyebrow">Jugadores</p>
              <h2>Mesa actual</h2>
            </div>

            <div class="players-list">
              @for (player of players; track player.id) {
                <article
                  class="player-card"
                  [class.current-user]="player.isCurrentUser"
                  [class.first-explorer]="isFirstExplorer(player.id)"
                  [class.fallen]="player.hasFallen"
                >
                  <div class="player-head">
                    <div class="player-name-wrap">
                      <span class="player-dot" [style.background]="player.color"></span>
                      <strong>{{ player.name }}</strong>
                    </div>
                    @if (player.isCurrentUser) {
                      <span class="player-tag">Tu</span>
                    }
                  </div>

                  <div class="player-states">
                    @if (isFirstExplorer(player.id)) {
                      <span class="status-pill accent">Primer explorador</span>
                    }
                    <span class="status-pill" [class.dark]="player.lanternState === 'DARK'">
                      {{ player.lanternState === 'DARK' ? 'Oscuridad' : 'Luz' }}
                    </span>
                    <span class="status-pill" [class.fallen]="player.hasFallen">
                      {{ player.hasFallen ? 'Caido' : 'Activo' }}
                    </span>
                  </div>

                  <div class="player-metrics">
                    <span>{{ player.score }} estrellas</span>
                    <span>{{ player.selectionCount }}/10 marcadas</span>
                    @if (phase === 'reveal' || phase === 'scoring' || phase === 'finished') {
                      <span>{{ getRemainingSelectionCodes(player).length }} sin revelar</span>
                    }
                  </div>
                </article>
              }
            </div>
          </aside>

          <main class="board-shell">
            <section class="word-panel">
              <div>
                <p class="eyebrow">Carta de palabra</p>
                <h2>{{ activeWord }}</h2>
              </div>

              @if (activeWordCard; as wordCard) {
                <div class="word-card">
                  <span>{{ wordCard.terms[0] }}</span>
                  <strong>{{ activeWord }}</strong>
                  <span>{{ wordCard.terms[1] }}</span>
                </div>
              }
            </section>

            <section class="board-grid" [class.limit-hit]="limitFeedbackActive">
              @for (rowIndex of boardRowIndexes; track rowIndex) {
                @for (card of getBoardCardsForRow(rowIndex); track card.code) {
                  @let revealCount = getRevealCount(card.code);
                  @let selectionOrder = getSelectionOrder(card.code);
                  <article
                    class="board-card"
                    [class.selected]="isCardSelected(card.code)"
                    [class.revealable]="isCardRevealable(card.code)"
                    [class.revealed]="revealCount > 0"
                  >
                    <button
                      type="button"
                      class="inspect-button"
                      aria-label="Ampliar carta"
                      (click)="openInspection(card); $event.stopPropagation()"
                    >
                      +
                    </button>

                    <button
                      type="button"
                      class="board-card-button"
                      [disabled]="!canInteractWithCard(card.code)"
                      (click)="onBoardCardClicked(card.code)"
                    >
                      <img draggable="false" [src]="card.image" [alt]="card.value" loading="lazy" />
                      <div class="board-card-meta">
                        <span>{{ card.value }}</span>
                        <small>{{ card.code }}</small>
                      </div>
                    </button>

                    @if (selectionOrder > 0) {
                      <span class="board-badge selection-badge">{{ selectionOrder }}</span>
                    }

                    @if (revealCount > 0) {
                      <span class="board-badge reveal-badge">{{ revealCount }}x</span>
                    }
                  </article>
                }
              }
            </section>

            @if (phase === 'reveal') {
              @if (activeExplorer; as explorer) {
                <section class="reveal-banner">
                  <div>
                    <p class="eyebrow">Explorador activo</p>
                    <h3>{{ explorer.name }}</h3>
                    <p>{{ getRevealPrompt(explorer) }}</p>
                  </div>

                  <div class="reveal-banner-metrics">
                    <span class="status-pill" [class.dark]="explorer.lanternState === 'DARK'">
                      {{ explorer.lanternState === 'DARK' ? 'Oscuridad' : 'Luz' }}
                    </span>
                    <span class="status-pill" [class.fallen]="explorer.hasFallen">
                      {{ explorer.hasFallen ? 'Caido' : getRemainingSelectionCodes(explorer).length + ' disponibles' }}
                    </span>
                  </div>
                </section>
              }
            }

            @if (phase === 'scoring') {
              <section class="scoring-panel">
                <div class="panel-header">
                  <p class="eyebrow">Cierre de ronda</p>
                  <h3>Balance de puntuacion</h3>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th>Antes</th>
                      <th>Ronda</th>
                      <th>Penalizacion</th>
                      <th>Neto</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of scoringSummary; track row.playerId) {
                      <tr>
                        <td>{{ row.playerName }}</td>
                        <td>{{ row.scoreBefore }}</td>
                        <td>+{{ row.roundPoints }}</td>
                        <td>{{ row.penalty > 0 ? '-' + row.penalty : '0' }}</td>
                        <td>{{ row.netPoints >= 0 ? '+' + row.netPoints : row.netPoints }}</td>
                        <td>{{ row.totalScore }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </section>
            }

            @if (phase === 'finished') {
              @if (primaryWinner; as winner) {
                <section class="final-panel">
                  <p class="eyebrow">Partida terminada</p>
                  <h3>
                    @if (finalWinners.length === 1) {
                      Gana {{ winner.name }}
                    } @else {
                      Victoria compartida
                    }
                  </h3>
                  <p>
                    @if (finalWinners.length > 1) {
                      {{ getWinnersLabel() }} comparten la victoria con {{ winner.score }} estrellas.
                    } @else {
                      {{ winner.name }} termina con {{ winner.score }} estrellas.
                    }
                  </p>
                </section>
              }
            }
          </main>

          <aside class="status-panel">
            @if (phase === 'association') {
              <section class="side-card">
                <p class="eyebrow">Reglas</p>
                <h3>Seleccion oculta</h3>
                <ul class="rule-list">
                  <li>Minimo 1 carta.</li>
                  <li>Maximo 10 cartas.</li>
                  <li>Tras confirmar no se puede modificar la seleccion.</li>
                </ul>

                <div class="selection-summary">
                  <strong>{{ currentSelectionCount }}/10</strong>
                  <p>{{ selectionMessage }}</p>
                </div>

                <div class="selection-list">
                  @for (code of currentPlayer.selection; track code) {
                    <span>{{ getCardLabel(code) }}</span>
                  }
                </div>
              </section>
            } @else if (phase === 'announce') {
              <section class="side-card">
                <p class="eyebrow">Pista 1-10</p>
                <h3>Intensidad declarada</h3>
                <div class="announce-track">
                  @for (count of announceTrack; track count) {
                    <div class="announce-cell">
                      <strong>{{ count }}</strong>
                      <div class="announce-tokens">
                        @for (player of getPlayersAtCount(count); track player.id) {
                          <span
                            class="announce-token"
                            [style.background]="player.color"
                            [attr.title]="player.name"
                          >
                            {{ player.name.charAt(0) }}
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>
                <p class="announce-copy">{{ selectionMessage }}</p>
              </section>
            } @else if (phase === 'reveal') {
              <section class="side-card">
                <p class="eyebrow">Resolucion</p>
                <h3>{{ lastResolutionTitle }}</h3>
                <p class="status-copy">{{ selectionMessage }}</p>

                @if (latestRevealLog; as entry) {
                  <article class="resolution-highlight">
                    <strong>{{ entry.explorerName }}</strong>
                    <p>{{ entry.cardLabel }} · {{ entry.outcomeLabel }}</p>
                    <p>
                      @if (entry.matchingPlayerNames.length > 0) {
                        Coinciden: {{ entry.matchingPlayerNames.join(', ') }}
                      } @else {
                        Nadie mas habia marcado esa carta.
                      }
                    </p>
                  </article>
                }

                <div class="log-list">
                  @for (entry of revealLog; track entry.id) {
                    <article class="log-entry">
                      <strong>{{ entry.explorerName }}</strong>
                      <p>{{ entry.cardCode }} · {{ entry.outcomeLabel }}</p>
                    </article>
                  }
                </div>
              </section>
            } @else if (phase === 'scoring') {
              <section class="side-card">
                <p class="eyebrow">Penalizacion</p>
                <h3>Oscuridad</h3>
                <p class="status-copy">{{ selectionMessage }}</p>
              </section>
            } @else {
              <section class="side-card">
                <p class="eyebrow">Ganadores</p>
                <h3>Clasificacion final</h3>
                <div class="final-ranking">
                  @for (player of getPlayersSortedByScore(); track player.id) {
                    <div class="final-ranking-row">
                      <span>{{ player.name }}</span>
                      <strong>{{ player.score }}</strong>
                    </div>
                  }
                </div>
              </section>
            }
          </aside>
        </div>

        <footer class="hud-panel">
          <div class="hud-copy">
            <p class="eyebrow">Estado</p>
            <h3>{{ hudTitle }}</h3>
            <p>{{ hudDescription }}</p>
          </div>

          <div class="hud-actions">
            @if (phase === 'association') {
              <button
                type="button"
                class="primary-action"
                [disabled]="!canSubmitSelection"
                (click)="submitSelection()"
              >
                Confirmar seleccion
              </button>
            } @else if (phase === 'announce') {
              <button type="button" class="primary-action" (click)="startRevealPhase()">
                Empezar revelado
              </button>
            } @else if (phase === 'reveal') {
              <button
                type="button"
                class="primary-action"
                [disabled]="isCurrentUserExplorer"
                (click)="resolveExplorerTurn()"
              >
                Resolver turno actual
              </button>
            } @else if (phase === 'scoring') {
              <button type="button" class="primary-action" (click)="advanceAfterScoring()">
                {{ roundNumber === totalRounds ? 'Ver ganador' : 'Siguiente ronda' }}
              </button>
            } @else {
              <button type="button" class="primary-action" (click)="returnToGames()">
                Volver a salas
              </button>
            }
          </div>
        </footer>
      }
    </section>

    @if (inspectedCard; as card) {
      <div class="modal-backdrop" (click)="closeInspection()">
        <article
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-card-title"
          (click)="$event.stopPropagation()"
        >
          <img draggable="false" [src]="card.image" [alt]="card.value" />
          <div class="modal-copy">
            <p class="eyebrow">Vista ampliada</p>
            <h3 id="inspect-card-title">{{ card.value }}</h3>
            <p>{{ card.code }}</p>
          </div>
          <button type="button" class="primary-action" (click)="closeInspection()">Cerrar</button>
        </article>
      </div>
    }
  `,
  styleUrl: './dixit-stella.css',
})
export class DixitStella implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stellaCardPull = inject(StellaCardPull);
  private readonly wordCardPull = inject(WordCardPull);
  private readonly gamesPull = inject(GamesPull);
  private limitFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private revealLogSequence = 0;
  private imageDeck: DeckCard[] = [];

  readonly boardRowIndexes = Array.from({ length: BOARD_ROWS }, (_, index) => index);
  readonly announceTrack = Array.from({ length: MAX_SELECTIONS }, (_, index) => index + 1);
  readonly totalRounds = TOTAL_ROUNDS;

  id = '';
  roomTitle = 'Stella demo';
  loading = true;
  errorMessage = '';
  phase: StellaPhase = 'association';
  roundNumber = 1;
  boardCards: DeckCard[] = [];
  wordCards: WordCard[] = [];
  activeWordCard: WordCard | null = null;
  activeWord = '';
  players: StellaPlayerState[] = [];
  deckCursor = 0;
  firstExplorerIndex = 0;
  activeExplorerId = '';
  darkPlayerId = '';
  revealLog: RevealLogEntry[] = [];
  scoringSummary: ScoringSummaryRow[] = [];
  finalWinners: StellaPlayerState[] = [];
  selectionMessage = 'Marca entre 1 y 10 cartas para cerrar tu pizarra.';
  lastResolutionTitle = 'Esperando siguiente chispa';
  limitFeedbackActive = false;
  inspectedCard: DeckCard | null = null;

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id')?.trim() ?? 'TEST';

    try {
      const cards = this.stellaCardPull.getCardsSync(30);
      const words = this.wordCardPull.getCardsSync(TOTAL_ROUNDS);

      if (cards.length < 30) {
        throw new Error('No hay suficientes cartas demo para montar la mesa Stella');
      }

      if (words.length < TOTAL_ROUNDS) {
        throw new Error('No hay suficientes cartas de palabra para las 4 rondas');
      }

      this.roomTitle = `Sala ${this.id || 'demo'}`;
      this.initializeMatch(cards, words, null);
    } catch (error: unknown) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo preparar la partida Stella';
    } finally {
      this.loading = false;
    }

    void this.hydrateLobbyContext();
  }

  ngOnDestroy(): void {
    if (this.limitFeedbackTimer !== null) {
      clearTimeout(this.limitFeedbackTimer);
      this.limitFeedbackTimer = null;
    }
  }

  get currentPhaseMeta(): PhaseMeta {
    return PHASE_META[this.phase];
  }

  get currentPlayer(): StellaPlayerState {
    const player = this.players.find((entry) => entry.isCurrentUser) ?? this.players[0];
    if (!player) {
      throw new Error('La mesa Stella no tiene jugadores cargados');
    }
    return player;
  }

  get primaryWinner(): StellaPlayerState | null {
    return this.finalWinners[0] ?? null;
  }

  get currentSelectionCount(): number {
    return this.currentPlayer.selection.length;
  }

  get canSubmitSelection(): boolean {
    return (
      this.phase === 'association' &&
      !this.currentPlayer.submitted &&
      this.currentSelectionCount >= MIN_SELECTIONS &&
      this.currentSelectionCount <= MAX_SELECTIONS
    );
  }

  get activeExplorer(): StellaPlayerState | undefined {
    return this.players.find((player) => player.id === this.activeExplorerId);
  }

  get isCurrentUserExplorer(): boolean {
    return this.activeExplorer?.isCurrentUser ?? false;
  }

  get latestRevealLog(): RevealLogEntry | undefined {
    return this.revealLog[0];
  }

  get hudTitle(): string {
    if (this.phase === 'association') {
      return `${this.currentSelectionCount}/10 cartas seleccionadas`;
    }

    if (this.phase === 'announce') {
      return 'Los conteos ya son publicos';
    }

    if (this.phase === 'reveal' && this.activeExplorer) {
      return `Turno de ${this.activeExplorer.name}`;
    }

    if (this.phase === 'scoring') {
      return 'Ronda resuelta';
    }

    return 'La partida ha terminado';
  }

  get hudDescription(): string {
    if (this.phase === 'association') {
      return 'La seleccion queda bloqueada al confirmar y la undecima carta se ignora.';
    }

    if (this.phase === 'announce') {
      return 'Solo entra en Oscuridad el lider unico en numero de selecciones.';
    }

    if (this.phase === 'reveal') {
      return this.isCurrentUserExplorer
        ? 'Te toca explorar: pulsa una de tus cartas aun no reveladas.'
        : 'Los rivales se resuelven automaticamente cuando llega su turno.';
    }

    if (this.phase === 'scoring') {
      return 'La penalizacion de Oscuridad solo se aplica si el jugador oscuro tambien cae.';
    }

    return 'La clasificacion final ya no cambia.';
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

  returnToGames(): void {
    void this.router.navigate(['/games']);
  }

  openInspection(card: DeckCard): void {
    this.inspectedCard = card;
  }

  closeInspection(): void {
    this.inspectedCard = null;
  }

  getBoardCardsForRow(rowIndex: number): DeckCard[] {
    const start = rowIndex * BOARD_COLUMNS;
    return this.boardCards.slice(start, start + BOARD_COLUMNS);
  }

  isFirstExplorer(playerId: string): boolean {
    return this.players[this.firstExplorerIndex]?.id === playerId;
  }

  isCardSelected(cardCode: string): boolean {
    return this.currentPlayer.selection.includes(cardCode);
  }

  getSelectionOrder(cardCode: string): number {
    const selectionIndex = this.currentPlayer.selection.indexOf(cardCode);
    return selectionIndex >= 0 ? selectionIndex + 1 : 0;
  }

  getRevealCount(cardCode: string): number {
    return this.revealLog.filter((entry) => entry.cardCode === cardCode).length;
  }

  isCardRevealable(cardCode: string): boolean {
    const explorer = this.activeExplorer;
    if (!explorer || !explorer.isCurrentUser || this.phase !== 'reveal') {
      return false;
    }

    return this.getRemainingSelectionCodes(explorer).includes(cardCode);
  }

  canInteractWithCard(cardCode: string): boolean {
    if (this.phase === 'association') {
      return !this.currentPlayer.submitted && this.boardCards.some((card) => card.code === cardCode);
    }

    if (this.phase === 'reveal') {
      return this.isCardRevealable(cardCode);
    }

    return false;
  }

  onBoardCardClicked(cardCode: string): void {
    if (this.phase === 'association') {
      this.toggleCurrentSelection(cardCode);
      return;
    }

    if (this.phase === 'reveal' && this.isCardRevealable(cardCode)) {
      this.resolveExplorerTurn(cardCode);
    }
  }

  submitSelection(): void {
    if (!this.canSubmitSelection) {
      this.selectionMessage = 'Debes marcar entre 1 y 10 cartas antes de confirmar.';
      return;
    }

    this.setSelectionForPlayer(this.currentPlayer.id, [...this.currentPlayer.selection]);
    this.autoSubmitOpponents();
    this.startAnnouncePhase();
  }

  setSelectionForPlayer(playerId: string, cardCodes: string[]): void {
    const player = this.players.find((entry) => entry.id === playerId);
    if (!player) {
      return;
    }

    const allowedCodes = new Set(this.boardCards.map((card) => card.code));
    const uniqueCodes: string[] = [];

    for (const code of cardCodes) {
      if (!allowedCodes.has(code) || uniqueCodes.includes(code)) {
        continue;
      }

      uniqueCodes.push(code);
      if (uniqueCodes.length === MAX_SELECTIONS) {
        break;
      }
    }

    player.selection = uniqueCodes;
    player.selectionCount = uniqueCodes.length;
    player.submitted = true;
  }

  startAnnouncePhase(): void {
    if (!this.players.every((player) => player.selectionCount >= MIN_SELECTIONS)) {
      this.selectionMessage = 'Todos los jugadores deben marcar al menos una carta.';
      return;
    }

    this.phase = 'announce';
    this.resolveDarknessState();
    this.lastResolutionTitle = 'Conteos cerrados';

    if (this.darkPlayerId) {
      const darkPlayer = this.players.find((player) => player.id === this.darkPlayerId);
      this.selectionMessage = `${darkPlayer?.name ?? 'Un jugador'} queda en Oscuridad por liderar en solitario.`;
      return;
    }

    this.selectionMessage = 'Nadie entra en Oscuridad porque el maximo esta empatado o no hay lider unico.';
  }

  startRevealPhase(): void {
    if (this.phase !== 'announce') {
      return;
    }

    this.phase = 'reveal';
    this.activeExplorerId = this.resolveNextExplorerId(this.firstExplorerIndex - 1);
    this.lastResolutionTitle = 'Secuencia de revelado';

    if (!this.activeExplorerId) {
      this.applyScoringPhase();
      return;
    }

    this.selectionMessage = this.getRevealPrompt(this.activeExplorer!);
  }

  resolveExplorerTurn(cardCode?: string): void {
    if (this.phase !== 'reveal') {
      return;
    }

    const explorer = this.activeExplorer;
    if (!explorer) {
      this.applyScoringPhase();
      return;
    }

    const remainingCodes = this.getRemainingSelectionCodes(explorer);
    if (remainingCodes.length === 0) {
      const nextExplorerId = this.resolveNextExplorerId(this.getPlayerIndex(explorer.id));
      if (!nextExplorerId) {
        this.applyScoringPhase();
        return;
      }

      this.activeExplorerId = nextExplorerId;
      this.selectionMessage = this.getRevealPrompt(this.activeExplorer!);
      return;
    }

    const chosenCardCode = this.resolveChosenCardCode(explorer, remainingCodes, cardCode);
    if (!chosenCardCode) {
      this.selectionMessage = 'Selecciona una de tus cartas aun no reveladas.';
      return;
    }

    explorer.revealedSelectionCodes = [...explorer.revealedSelectionCodes, chosenCardCode];

    const matchingPlayers = this.getMatchingPlayers(explorer.id, chosenCardCode);
    const chosenCard = this.getCardByCode(chosenCardCode);

    if (matchingPlayers.length === 0) {
      explorer.hasFallen = true;
      this.pushRevealLog(explorer.name, chosenCardCode, chosenCard?.value ?? chosenCardCode, [], 'fall');
      this.lastResolutionTitle = 'Caida';
      this.selectionMessage = `${explorer.name} cae: nadie mas habia marcado ${chosenCard?.value ?? chosenCardCode}.`;
    } else if (matchingPlayers.length === 1) {
      this.awardAssociation(explorer, 3);
      this.awardAssociation(matchingPlayers[0], 3);
      this.pushRevealLog(
        explorer.name,
        chosenCardCode,
        chosenCard?.value ?? chosenCardCode,
        matchingPlayers.map((player) => player.name),
        'super-spark'
      );
      this.lastResolutionTitle = 'Super-spark';
      this.selectionMessage = `${explorer.name} conecta con ${matchingPlayers[0].name} y ambos reciben 3 estrellas.`;
    } else {
      this.awardAssociation(explorer, 2);
      for (const matchingPlayer of matchingPlayers) {
        this.awardAssociation(matchingPlayer, 2);
      }
      this.pushRevealLog(
        explorer.name,
        chosenCardCode,
        chosenCard?.value ?? chosenCardCode,
        matchingPlayers.map((player) => player.name),
        'spark'
      );
      this.lastResolutionTitle = 'Spark';
      this.selectionMessage = `${explorer.name} conecta con ${matchingPlayers.length} rivales y se reparten 2 estrellas.`;
    }

    const nextExplorerId = this.resolveNextExplorerId(this.getPlayerIndex(explorer.id));
    if (!nextExplorerId) {
      this.applyScoringPhase();
      return;
    }

    this.activeExplorerId = nextExplorerId;
  }

  advanceAfterScoring(): void {
    if (this.phase !== 'scoring') {
      return;
    }

    if (this.roundNumber === TOTAL_ROUNDS) {
      this.phase = 'finished';
      this.finalWinners = this.resolveWinners();
      const winner = this.finalWinners[0];
      this.selectionMessage = winner
        ? this.finalWinners.length > 1
          ? `${this.getWinnersLabel()} comparten la victoria.`
          : `${winner.name} gana la partida.`
        : 'La partida ha terminado sin jugadores registrados.';
      return;
    }

    this.replaceBoardRow(this.roundNumber - 1);
    this.firstExplorerIndex = (this.firstExplorerIndex + 1) % this.players.length;
    this.roundNumber += 1;
    this.prepareRoundState();
  }

  getPlayersAtCount(count: number): StellaPlayerState[] {
    return this.players.filter((player) => player.selectionCount === count);
  }

  getRemainingSelectionCodes(player: StellaPlayerState): string[] {
    return player.selection.filter((code) => !player.revealedSelectionCodes.includes(code));
  }

  getCardByCode(cardCode: string): DeckCard | undefined {
    return this.boardCards.find((card) => card.code === cardCode);
  }

  getCardLabel(cardCode: string): string {
    return this.getCardByCode(cardCode)?.value ?? cardCode;
  }

  getRevealPrompt(player: StellaPlayerState): string {
    if (player.isCurrentUser) {
      return 'Te toca explorar. Pulsa una de tus cartas marcadas para intentar una chispa.';
    }

    return `${player.name} resuelve automaticamente la mejor coincidencia que aun conserve.`;
  }

  getPlayersSortedByScore(): StellaPlayerState[] {
    return [...this.players].sort(
      (left, right) => right.score - left.score || left.name.localeCompare(right.name)
    );
  }

  getWinnersLabel(): string {
    return this.finalWinners.map((player) => player.name).join(', ');
  }

  private async loadLobbyDetails(): Promise<Game | null> {
    if (!this.id) {
      return null;
    }

    try {
      return await this.gamesPull.getGameDetails(this.id);
    } catch {
      return null;
    }
  }

  private async hydrateLobbyContext(): Promise<void> {
    const lobby = await this.loadLobbyDetails();
    if (!lobby) {
      return;
    }

    this.roomTitle = lobby.title?.trim() || this.roomTitle;
  }

  private initializeMatch(cards: DeckCard[], words: WordCard[], lobby: Game | null): void {
    const seedKey = this.id || 'stella-demo';

    this.imageDeck = shuffleWithSeed(cards, `${seedKey}-images`);
    this.wordCards = shuffleWithSeed(words, `${seedKey}-words`).slice(0, TOTAL_ROUNDS);
    this.boardCards = this.imageDeck.slice(0, BOARD_CARD_COUNT);
    this.deckCursor = BOARD_CARD_COUNT;
    this.players = this.createPlayers(lobby);
    this.firstExplorerIndex = createSeedFromString(`${seedKey}-first`) % this.players.length;

    this.prepareRoundState();
  }

  private createPlayers(lobby: Game | null): StellaPlayerState[] {
    const lobbyPlayers = lobby?.players.filter((playerId) => playerId.trim().length > 0) ?? [];
    const resolvedNames = [...lobbyPlayers];

    for (const demoName of DEMO_PLAYER_NAMES) {
      if (resolvedNames.length >= 4) {
        break;
      }
      resolvedNames.push(demoName);
    }

    return resolvedNames.slice(0, 6).map((name, index) => ({
      id: `player-${index + 1}`,
      name,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      score: 0,
      selection: [],
      selectionCount: 0,
      submitted: false,
      lanternState: 'LIGHT',
      hasFallen: false,
      revealedSelectionCodes: [],
      roundPoints: 0,
      successfulAssociations: 0,
      isCurrentUser: index === 0,
    }));
  }

  private prepareRoundState(): void {
    this.phase = 'association';
    this.activeWordCard = this.wordCards[this.roundNumber - 1] ?? this.wordCards[0] ?? null;
    this.activeWord = this.activeWordCard ? this.resolveActiveWord(this.activeWordCard) : '';
    this.activeExplorerId = '';
    this.darkPlayerId = '';
    this.revealLog = [];
    this.scoringSummary = [];
    this.selectionMessage = 'Marca entre 1 y 10 cartas para cerrar tu pizarra.';
    this.lastResolutionTitle = 'Preparando ronda';
    this.limitFeedbackActive = false;

    for (const player of this.players) {
      player.selection = [];
      player.selectionCount = 0;
      player.submitted = false;
      player.lanternState = 'LIGHT';
      player.hasFallen = false;
      player.revealedSelectionCodes = [];
      player.roundPoints = 0;
      player.successfulAssociations = 0;
    }
  }

  private resolveActiveWord(wordCard: WordCard): string {
    const choiceIndex =
      createSeedFromString(`${wordCard.id}-${this.roundNumber}-${this.id}`) % wordCard.terms.length;
    return wordCard.terms[choiceIndex];
  }

  private toggleCurrentSelection(cardCode: string): void {
    if (this.currentPlayer.submitted) {
      return;
    }

    if (this.currentPlayer.selection.includes(cardCode)) {
      this.currentPlayer.selection = this.currentPlayer.selection.filter((code) => code !== cardCode);
      this.currentPlayer.selectionCount = this.currentPlayer.selection.length;
      this.selectionMessage = `${this.currentPlayer.selection.length} cartas marcadas.`;
      return;
    }

    if (this.currentPlayer.selection.length >= MAX_SELECTIONS) {
      this.selectionMessage = 'No puedes marcar una undecima carta. El maximo reglamentario es 10.';
      this.triggerLimitFeedback();
      return;
    }

    this.currentPlayer.selection = [...this.currentPlayer.selection, cardCode];
    this.currentPlayer.selectionCount = this.currentPlayer.selection.length;
    this.selectionMessage = `${this.currentPlayer.selection.length} cartas marcadas.`;
  }

  private triggerLimitFeedback(): void {
    this.limitFeedbackActive = true;

    if (this.limitFeedbackTimer !== null) {
      clearTimeout(this.limitFeedbackTimer);
    }

    this.limitFeedbackTimer = setTimeout(() => {
      this.limitFeedbackActive = false;
      this.limitFeedbackTimer = null;
    }, 420);
  }

  private autoSubmitOpponents(): void {
    for (let index = 0; index < this.players.length; index += 1) {
      const player = this.players[index];
      if (player.isCurrentUser) {
        continue;
      }

      this.setSelectionForPlayer(player.id, this.buildOpponentSelection(index));
    }
  }

  private buildOpponentSelection(playerIndex: number): string[] {
    const desiredCount =
      2 + (createSeedFromString(`${this.activeWord}-${playerIndex}-${this.roundNumber}`) % 5);
    const boardSize = this.boardCards.length;
    const startIndex = createSeedFromString(`${this.activeWord}-${playerIndex}-start`) % boardSize;
    const step = 2 + (createSeedFromString(`${this.activeWord}-${playerIndex}-step`) % 4);
    const orderedIndexes: number[] = [];

    // A step that shares divisors with the board size can loop over a short cycle forever.
    // Build a full deterministic order first, then slice it to the requested selection size.
    for (let offset = 0; offset < boardSize; offset += 1) {
      const candidateIndex = (startIndex + offset * step) % boardSize;
      if (!orderedIndexes.includes(candidateIndex)) {
        orderedIndexes.push(candidateIndex);
      }
    }

    for (let offset = 0; offset < boardSize; offset += 1) {
      const candidateIndex = (startIndex + offset) % boardSize;
      if (!orderedIndexes.includes(candidateIndex)) {
        orderedIndexes.push(candidateIndex);
      }
    }

    return orderedIndexes
      .slice(0, Math.min(desiredCount, boardSize))
      .map((candidateIndex) => this.boardCards[candidateIndex].code);
  }

  private resolveDarknessState(): void {
    let maxSelectionCount = 0;
    let contenders: StellaPlayerState[] = [];

    for (const player of this.players) {
      player.lanternState = 'LIGHT';
      if (player.selectionCount > maxSelectionCount) {
        maxSelectionCount = player.selectionCount;
        contenders = [player];
      } else if (player.selectionCount === maxSelectionCount) {
        contenders.push(player);
      }
    }

    this.darkPlayerId = '';
    if (maxSelectionCount > 0 && contenders.length === 1) {
      contenders[0].lanternState = 'DARK';
      this.darkPlayerId = contenders[0].id;
    }
  }

  private resolveChosenCardCode(
    explorer: StellaPlayerState,
    remainingCodes: string[],
    requestedCardCode?: string
  ): string {
    if (requestedCardCode && remainingCodes.includes(requestedCardCode)) {
      return requestedCardCode;
    }

    if (explorer.isCurrentUser) {
      return '';
    }

    let bestCardCode = remainingCodes[0];
    let bestScore = -1;

    for (const candidateCode of remainingCodes) {
      const matchCount = this.getMatchingPlayers(explorer.id, candidateCode).length;
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestCardCode = candidateCode;
      }
    }

    return bestCardCode;
  }

  private getMatchingPlayers(explorerId: string, cardCode: string): StellaPlayerState[] {
    return this.players.filter(
      (player) => player.id !== explorerId && player.selection.includes(cardCode)
    );
  }

  private awardAssociation(player: StellaPlayerState, points: number): void {
    if (player.hasFallen) {
      return;
    }

    player.roundPoints += points;
    player.successfulAssociations += 1;
  }

  private pushRevealLog(
    explorerName: string,
    cardCode: string,
    cardLabel: string,
    matchingPlayerNames: string[],
    outcome: RevealOutcome
  ): void {
    const outcomeLabel =
      outcome === 'super-spark' ? 'Super-spark' : outcome === 'spark' ? 'Spark' : 'Caida';

    this.revealLog = [
      {
        id: ++this.revealLogSequence,
        explorerName,
        cardCode,
        cardLabel,
        matchingPlayerNames,
        outcome,
        outcomeLabel,
      },
      ...this.revealLog,
    ];
  }

  private resolveNextExplorerId(afterIndex: number): string {
    for (let offset = 1; offset <= this.players.length; offset += 1) {
      const candidateIndex = (afterIndex + offset + this.players.length) % this.players.length;
      const candidate = this.players[candidateIndex];

      if (candidate.hasFallen) {
        continue;
      }

      if (this.getRemainingSelectionCodes(candidate).length === 0) {
        continue;
      }

      return candidate.id;
    }

    return '';
  }

  private getPlayerIndex(playerId: string): number {
    return this.players.findIndex((player) => player.id === playerId);
  }

  private applyScoringPhase(): void {
    const summary: ScoringSummaryRow[] = [];

    for (const player of this.players) {
      const scoreBefore = player.score;
      const penalty =
        player.id === this.darkPlayerId && player.hasFallen ? player.successfulAssociations : 0;
      const netPoints = player.roundPoints - penalty;
      player.score += netPoints;

      summary.push({
        playerId: player.id,
        playerName: player.name,
        scoreBefore,
        roundPoints: player.roundPoints,
        penalty,
        netPoints,
        totalScore: player.score,
      });
    }

    this.scoringSummary = summary.sort(
      (left, right) =>
        right.totalScore - left.totalScore || left.playerName.localeCompare(right.playerName)
    );
    this.phase = 'scoring';
    this.activeExplorerId = '';
    this.lastResolutionTitle = 'Puntuacion cerrada';

    if (this.darkPlayerId) {
      const darkPlayer = this.players.find((player) => player.id === this.darkPlayerId);
      if (darkPlayer?.hasFallen) {
        this.selectionMessage = `${darkPlayer.name} estaba en Oscuridad y pierde ${darkPlayer.successfulAssociations} estrellas por sus asociaciones exitosas.`;
        return;
      }

      this.selectionMessage = `${darkPlayer?.name ?? 'El jugador oscuro'} sobrevivio a la ronda y conserva todos sus puntos.`;
      return;
    }

    this.selectionMessage = 'La ronda termina sin penalizacion de Oscuridad.';
  }

  private replaceBoardRow(rowIndex: number): void {
    const replacementStart = rowIndex * BOARD_COLUMNS;
    const replacementCards = this.imageDeck.slice(this.deckCursor, this.deckCursor + BOARD_COLUMNS);

    if (replacementCards.length < BOARD_COLUMNS) {
      return;
    }

    const nextBoard = [...this.boardCards];
    nextBoard.splice(replacementStart, BOARD_COLUMNS, ...replacementCards);
    this.boardCards = nextBoard;
    this.deckCursor += BOARD_COLUMNS;
  }

  private resolveWinners(): StellaPlayerState[] {
    if (this.players.length === 0) {
      return [];
    }

    const highestScore = Math.max(...this.players.map((player) => player.score));
    return this.getPlayersSortedByScore().filter((player) => player.score === highestScore);
  }
}

function createSeedFromString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function shuffleWithSeed<T>(items: readonly T[], seedKey: string): T[] {
  const shuffledItems = [...items];
  let seed = createSeedFromString(seedKey);

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    const currentItem = shuffledItems[index];
    shuffledItems[index] = shuffledItems[swapIndex];
    shuffledItems[swapIndex] = currentItem;
  }

  return shuffledItems;
}
