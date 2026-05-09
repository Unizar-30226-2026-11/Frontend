import { ChangeDetectorRef, Component, Injector, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  RealtimeGameStateUpdate,
  RealtimeLobbyState,
  RealtimeMinigameStart,
  RealtimeSpecialEvent,
} from '../interfaces/dixit-realtime';
import { Game } from '../interfaces/game';
import { WordCard } from '../interfaces/word-card';
import { Auth } from '../services/auth';
import { DeckCard } from '../services/card-pull';
import { DixitRealtime } from '../services/dixit-realtime';
import { GamesPull } from '../services/games-pull';
import { StellaCardPull } from '../services/stella-card-pull';
import {
  DixitTrackBoard,
  type TrackBoardToken,
} from '../dixit/components/track-board';
import { SPECIAL_BOARD_CELLS } from '../dixit/dixit.constants';
import { DixitMinijuego1 } from '../dixit/minijuegos/minijuego-1';
import { DixitMinijuego2 } from '../dixit/minijuegos/minijuego-2/minijuego-2';
import { DixitMinijuego3 } from '../dixit/minijuegos/minijuego-3/minijuego-3';
import {
  FinalResultsOverlay,
  type FinalResultsRankingRow as SharedFinalResultsRankingRow,
  type FinalResultsStat,
} from '../shared/final-results-overlay';
import {
  MINIGAME_COUNTDOWN_MS,
  MinigameCountdownOverlay,
} from '../shared/minigame-countdown-overlay';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  MAX_SELECTIONS,
  MIN_SELECTIONS,
  PHASE_META,
  PLAYER_COLORS,
  type PhaseMeta,
  type RevealLogEntry,
  type RevealOutcome,
  type ScoringSummaryRow,
  type StellaPhase,
  type StellaPlayerState,
} from './dixit-stella.constants';

interface StellaRoundSnapshot {
  playerMarks: Record<string, number[]>;
  revealedCards: number[];
  currentScoutId: string;
}

const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';

@Component({
  selector: 'app-dixit-stella',
  standalone: true,
  imports: [
    DixitTrackBoard,
    FinalResultsOverlay,
    MinigameCountdownOverlay,
    DixitMinijuego1,
    DixitMinijuego2,
    DixitMinijuego3,
  ],
  templateUrl: './dixit-stella.html',
  styleUrl: './dixit-stella.css',
})
export class DixitStella implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly stellaCardPull = inject(StellaCardPull);
  private readonly gamesPull = inject(GamesPull);
  private readonly realtime = inject(DixitRealtime);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);

  private readonly playerNames = new Map<string, string>();
  private readonly cardCatalogByCode = new Map<string, DeckCard>();
  private readonly cardCatalog = new Map<number, DeckCard>();
  private readonly boardCardIdsByCode = new Map<string, number>();
  private readonly dynamicCardUrls = new Map<string, string>();
  private ownedCards: DeckCard[] = [];
  private lastAppliedGameStateReceivedAt = 0;
  private lastBoardSignature = '';
  private revealLogSequence = 0;
  private firstScoutId = '';
  private previousRoundSnapshot: StellaRoundSnapshot | null = null;
  private draftSelectionIds: number[] = [];

  readonly boardRowIndexes = Array.from({ length: BOARD_ROWS }, (_, index) => index);
  readonly announceTrack = Array.from({ length: MAX_SELECTIONS }, (_, index) => index + 1);
  readonly specialBoardCells = SPECIAL_BOARD_CELLS;
  readonly trackBoardImageUrl = DEFAULT_CARD_IMAGE;

  id = '';
  roomTitle = 'Sala Stella';
  loading = true;
  errorMessage = '';
  phase: StellaPhase = 'STELLA_WORD_REVEAL';
  roundNumber = 1;
  boardCards: DeckCard[] = [];
  activeWordCard: WordCard | null = null;
  activeWord = '';
  players: StellaPlayerState[] = [];
  activeExplorerId = '';
  darkPlayerId = '';
  revealLog: RevealLogEntry[] = [];
  scoringSummary: ScoringSummaryRow[] = [];
  finalWinners: StellaPlayerState[] = [];
  selectionMessage = 'Esperando estado realtime de Stella.';
  pendingRevealCardCode = '';
  lastResolutionTitle = 'Esperando revelaciones';
  limitFeedbackActive = false;
  inspectedCard: DeckCard | null = null;
  activeMinigame: RealtimeMinigameStart | null = null;
  isMinigame1Open = false;
  isMinigame2Open = false;
  isMinigame3Open = false;
  minigameUiState: 'playing' | 'waiting' | 'won' | 'lost' | 'cancelled' = 'playing';
  minigameStatusMessage = '';
  isMinigameCountdownOpen = false;
  isTrackBoardOpen = false;
  private lastAppliedMinigameReceivedAt = 0;
  private minigameResultSent = false;
  private minigameResolutionTimer: ReturnType<typeof setTimeout> | null = null;
  private minigameUnavailableSubmitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(
      () => {
        const lobbyState = this.realtime.lobbyState();
        if (!lobbyState || lobbyState.code !== this.id) {
          return;
        }

        this.applyRealtimeLobbyState(lobbyState);
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const gameState = this.realtime.gameState();
        if (!gameState || this.realtime.activeLobbyCode() !== this.id) {
          return;
        }

        this.applyRealtimeGameState(gameState);
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const realtimeError = this.realtime.lastError();
        if (!realtimeError || this.realtime.activeLobbyCode() !== this.id) {
          return;
        }

        this.errorMessage = realtimeError;
        this.loading = false;
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const minigame = this.realtime.minigameStart();
        if (!minigame || this.realtime.activeLobbyCode() !== this.id) {
          return;
        }

        this.applyRealtimeMinigameStart(minigame);
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const specialEvent = this.realtime.specialEvent();
        if (!specialEvent || this.realtime.activeLobbyCode() !== this.id) {
          return;
        }

        this.applyRealtimeSpecialEvent(specialEvent);
        this.realtime.clearSpecialEvent();
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );
  }

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!this.id) {
      this.loading = false;
      this.errorMessage = 'No se encontro el codigo de la sala Stella';
      return;
    }

    const [cardsResult, lobbyResult, connectionResult] = await Promise.allSettled([
      this.stellaCardPull.getCards(),
      this.gamesPull.getGameDetails(this.id).catch(() => null),
      this.realtime.ensureLobbyConnection(this.id),
    ]);

    if (cardsResult.status === 'fulfilled') {
      this.ownedCards = [...cardsResult.value];
      this.hydrateCardCatalog(cardsResult.value);
    } else {
      this.errorMessage =
        cardsResult.reason instanceof Error
          ? cardsResult.reason.message
          : 'No se pudieron cargar las cartas de Stella';
    }

    if (lobbyResult.status === 'fulfilled' && lobbyResult.value) {
      this.applyLobbyDetails(lobbyResult.value);
    }

    if (connectionResult.status === 'rejected' && !this.errorMessage) {
      this.errorMessage =
        connectionResult.reason instanceof Error
          ? connectionResult.reason.message
          : 'No se pudo conectar Stella en tiempo real';
    }

    const initialGameState = this.realtime.gameState();
    if (initialGameState && this.realtime.activeLobbyCode() === this.id) {
      this.applyRealtimeGameState(initialGameState);
    }

    const currentMinigame = this.realtime.minigameStart();
    if (currentMinigame && this.realtime.activeLobbyCode() === this.id) {
      this.applyRealtimeMinigameStart(currentMinigame);
    }

    const currentSpecialEvent = this.realtime.specialEvent();
    if (currentSpecialEvent && this.realtime.activeLobbyCode() === this.id) {
      this.applyRealtimeSpecialEvent(currentSpecialEvent);
    }

    this.loading = false;
  }

  ngOnDestroy(): void {
    this.clearMinigameResolutionTimer();
    this.clearMinigameUnavailableSubmitTimer();
  }

  get currentPhaseMeta(): PhaseMeta {
    return PHASE_META[this.phase];
  }

  get currentPlayer(): StellaPlayerState {
    const currentPlayerState = this.players.find((entry) => entry.isCurrentUser);
    return (
      currentPlayerState ?? {
        id: this.currentPlayerId,
        name: this.auth.username() || 'Tu',
        color: PLAYER_COLORS[0],
        score: 0,
        selection: this.getCurrentSelectionCodes(),
        selectionCount: this.getCurrentSelectionCodes().length,
        submitted: false,
        lanternState: 'LIGHT',
        hasFallen: false,
        revealedSelectionCodes: [],
        roundPoints: 0,
        successfulAssociations: 0,
        isCurrentUser: true,
      }
    );
  }

  get primaryWinner(): StellaPlayerState | null {
    return this.finalWinners[0] ?? null;
  }

  get hasMultipleWinners(): boolean {
    return this.finalWinners.length > 1;
  }

  get stellaFinalOverlayTitle(): string {
    const winner = this.primaryWinner;
    if (!winner) {
      return 'Resultados finales';
    }

    if (this.hasMultipleWinners) {
      return 'Victoria compartida';
    }

    if (winner.isCurrentUser) {
      return 'Has ganado la partida';
    }

    return `Gana ${winner.name}`;
  }

  get stellaFinalOverlayCopy(): string {
    const winner = this.primaryWinner;
    if (!winner) {
      return 'Esperando a que el servidor termine de publicar el resultado final.';
    }

    if (this.hasMultipleWinners) {
      return `${this.getWinnersLabel()} comparten la victoria con ${winner.score} estrellas.`;
    }

    return `${winner.name} termina con ${winner.score} estrellas.`;
  }

  get stellaFinalOverlayStats(): FinalResultsStat[] {
    const currentPlayer = this.players.find((player) => player.isCurrentUser) ?? this.primaryWinner;
    if (!currentPlayer) {
      return [];
    }

    const currentPlayerPlace =
      this.getPlayersSortedByScore().findIndex((player) => player.id === currentPlayer.id) + 1;

    return [
      {
        label: 'Puesto',
        value: this.formatPlace(currentPlayerPlace || 1),
      },
      {
        label: 'Estrellas',
        value: String(currentPlayer.score),
      },
      {
        label: this.hasMultipleWinners ? 'Ganadores' : 'Ganador',
        value: String(this.finalWinners.length || 1),
        muted: true,
      },
    ];
  }

  get stellaBoardTokens(): TrackBoardToken[] {
    return this.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      position: player.score,
    }));
  }

  get stellaBoardSubtitle(): string {
    return `Ronda ${this.roundNumber} - ${this.currentPhaseMeta.title}`;
  }

  get stellaFinalRankingRows(): SharedFinalResultsRankingRow[] {
    return this.getPlayersSortedByScore().map((player, index) => ({
      id: player.id,
      title: player.name,
      subtitle: `${player.successfulAssociations} aciertos · ${player.selectionCount}/10 marcadas`,
      sideValue: String(player.score),
      placeLabel: this.formatPlace(index + 1),
      highlighted: player.isCurrentUser,
    }));
  }

  get currentSelectionCodes(): string[] {
    return this.getCurrentSelectionCodes();
  }

  get currentSelectionCount(): number {
    return this.currentSelectionCodes.length;
  }

  get canSubmitSelection(): boolean {
    return (
      this.phase === 'STELLA_MARKING' &&
      !this.currentPlayer.submitted &&
      this.currentSelectionCount >= MIN_SELECTIONS &&
      this.currentSelectionCount <= MAX_SELECTIONS &&
      this.realtime.connectionStatus() === 'connected'
    );
  }

  get pendingRevealCardLabel(): string {
    return this.pendingRevealCardCode ? this.getCardLabel(this.pendingRevealCardCode) : '';
  }

  get canSubmitRevealSelection(): boolean {
    return (
      this.phase === 'STELLA_REVEAL' &&
      this.isCurrentUserExplorer &&
      this.isCardRevealable(this.pendingRevealCardCode) &&
      this.realtime.connectionStatus() === 'connected'
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
    switch (this.phase) {
      case 'STELLA_WORD_REVEAL':
        return 'Preparando ronda';
      case 'STELLA_MARKING':
        return `${this.currentSelectionCount}/10 cartas seleccionadas`;
      case 'STELLA_REVEAL':
        return this.activeExplorer ? `Turno de ${this.activeExplorer.name}` : 'Esperando scout';
      case 'SCORING':
        return 'Ronda resuelta';
      case 'FINISHED':
        return 'La partida ha terminado';
    }
  }

  get hudDescription(): string {
    switch (this.phase) {
      case 'STELLA_WORD_REVEAL':
        return 'El servidor esta publicando la palabra y preparando el marcado.';
      case 'STELLA_MARKING':
        return 'Marca entre 1 y 10 cartas y confirma cuando termines.';
      case 'STELLA_REVEAL':
        if (!this.isCurrentUserExplorer) {
          return 'Espera a que el jugador explorador revele su siguiente carta.';
        }

        return this.pendingRevealCardCode
          ? `Carta preparada: ${this.pendingRevealCardLabel}. Pulsa Seleccionar carta para enviarla.`
          : 'Elige una carta marcada del tablero y confirma con Seleccionar carta.';
      case 'SCORING':
        return 'El servidor ya ha aplicado puntuacion y penalizaciones.';
      case 'FINISHED':
        return 'La clasificacion final ya no cambia.';
    }
  }

  get isCurrentPlayerInActiveMinigame(): boolean {
    return !!this.activeMinigame && (
      this.activeMinigame.player1 === this.currentPlayerId ||
      this.activeMinigame.player2 === this.currentPlayerId
    );
  }

  get activeMinigameDurationMs(): number {
    const durationMs = this.activeMinigame?.duration ?? 15_000;
    return Math.max(500, durationMs - MINIGAME_COUNTDOWN_MS);
  }

  get isMinigameCountdownVisible(): boolean {
    return (
      this.activeMinigame !== null &&
      this.isCurrentPlayerInActiveMinigame &&
      this.minigameUiState === 'playing' &&
      this.isMinigameCountdownOpen
    );
  }

  get activeMinigameCountdownEyebrow(): string {
    return this.activeMinigame?.isDuel ? 'Duelo' : 'Desempate';
  }

  get activeMinigameCountdownTitle(): string {
    return `¡Vaya! has empatado con ${this.activeMinigameOpponentName}`;
  }

  get activeMinigameOpponentName(): string {
    if (!this.activeMinigame) {
      return 'Rival';
    }

    const opponentId =
      this.activeMinigame.player1 === this.currentPlayerId
        ? this.activeMinigame.player2
        : this.activeMinigame.player1;

    return this.playerNames.get(opponentId) ?? opponentId ?? 'Rival';
  }

  get activeMinigamePlayerOneName(): string {
    return this.playerNames.get(this.activeMinigame?.player1 ?? '') ?? this.activeMinigame?.player1 ?? 'Jugador 1';
  }

  get activeMinigamePlayerTwoName(): string {
    return this.playerNames.get(this.activeMinigame?.player2 ?? '') ?? this.activeMinigame?.player2 ?? 'Jugador 2';
  }

  get activeMinigameSeedKey(): string {
    if (!this.activeMinigame) {
      return 'minigame-default';
    }

    return [
      this.activeMinigame.player1,
      this.activeMinigame.player2,
      this.activeMinigame.type,
      this.activeMinigame.duration,
      this.activeMinigame.isDuel ? 'duel' : 'conflict',
      this.activeMinigame.receivedAt,
    ].join('|');
  }

  get isUnavailableMinigameType(): boolean {
    return this.activeMinigame !== null && this.resolveMinigameView(this.activeMinigame.type) === null;
  }

  goHome(): void {
    void this.router.navigate(['/menu']);
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

  openTrackBoard(): void {
    this.isTrackBoardOpen = true;
  }

  closeTrackBoard(): void {
    this.isTrackBoardOpen = false;
  }

  openInspection(card: DeckCard): void {
    this.inspectedCard = card;
  }

  closeInspection(): void {
    this.inspectedCard = null;
  }

  closeMinigame1(): void {
    if (this.activeMinigame) {
      return;
    }

    this.isMinigame1Open = false;
  }

  closeMinigame2(): void {
    if (this.activeMinigame) {
      return;
    }

    this.isMinigame2Open = false;
  }

  closeMinigame3(): void {
    if (this.activeMinigame) {
      return;
    }

    this.isMinigame3Open = false;
  }

  onMinigameFinished(result: { score: number }): void {
    if (!this.activeMinigame || this.minigameResultSent) {
      return;
    }

    this.minigameResultSent = true;
    this.minigameUiState = 'waiting';
    this.minigameStatusMessage = 'Puntuacion enviada. Esperando al rival...';
    try {
      this.realtime.sendMinigameScore(result.score);
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo enviar el resultado del minijuego';
      this.minigameResultSent = false;
      this.minigameUiState = 'playing';
      this.minigameStatusMessage = '';
    }
  }

  getBoardCardsForRow(rowIndex: number): DeckCard[] {
    const start = rowIndex * BOARD_COLUMNS;
    return this.boardCards.slice(start, start + BOARD_COLUMNS);
  }

  isFirstExplorer(playerId: string): boolean {
    return this.firstScoutId === playerId;
  }

  isCardSelected(cardCode: string): boolean {
    return this.currentSelectionCodes.includes(cardCode);
  }

  getSelectionOrder(cardCode: string): number {
    const selectionIndex = this.currentSelectionCodes.indexOf(cardCode);
    return selectionIndex >= 0 ? selectionIndex + 1 : 0;
  }

  getRevealCount(cardCode: string): number {
    return this.revealLog.filter((entry) => entry.cardCode === cardCode).length;
  }

  isCardRevealable(cardCode: string): boolean {
    const explorer = this.activeExplorer;
    if (!explorer || !explorer.isCurrentUser || this.phase !== 'STELLA_REVEAL') {
      return false;
    }

    return this.getRemainingSelectionCodes(explorer).includes(cardCode);
  }

  isPendingRevealCard(cardCode: string): boolean {
    return this.pendingRevealCardCode === cardCode;
  }

  canInteractWithCard(cardCode: string): boolean {
    if (this.phase === 'STELLA_MARKING') {
      return !this.currentPlayer.submitted && this.boardCardIdsByCode.has(cardCode);
    }

    if (this.phase === 'STELLA_REVEAL') {
      return this.isCardRevealable(cardCode);
    }

    return false;
  }

  onBoardCardClicked(cardCode: string): void {
    if (this.phase === 'STELLA_MARKING') {
      this.toggleDraftSelection(cardCode);
      return;
    }

    if (this.phase === 'STELLA_REVEAL' && this.isCardRevealable(cardCode)) {
      this.pendingRevealCardCode = this.pendingRevealCardCode === cardCode ? '' : cardCode;
      this.selectionMessage = this.pendingRevealCardCode
        ? `Carta preparada: ${this.getCardLabel(cardCode)}. Pulsa Seleccionar carta para enviarla.`
        : 'Elige una de tus marcas sin revelar.';
    }
  }

  submitRevealSelection(): void {
    if (!this.canSubmitRevealSelection) {
      this.selectionMessage = this.isCurrentUserExplorer
        ? 'Elige una de tus marcas sin revelar antes de confirmar.'
        : 'Espera a que el scout elija su carta.';
      return;
    }

    const cardId = this.boardCardIdsByCode.get(this.pendingRevealCardCode);
    if (typeof cardId !== 'number') {
      this.selectionMessage = 'No se pudo identificar la carta seleccionada.';
      return;
    }

    this.realtime.sendGameAction('STELLA_REVEAL_MARK', { cardId });
    this.pendingRevealCardCode = '';
    this.selectionMessage = 'Carta seleccionada. Esperando respuesta del tablero.';
  }

  submitSelection(): void {
    if (!this.canSubmitSelection) {
      this.selectionMessage = 'Debes marcar entre 1 y 10 cartas antes de confirmar.';
      return;
    }

    this.realtime.sendGameAction('STELLA_SUBMIT_MARKS', {
      cardIds: [...this.draftSelectionIds],
    });
    this.selectionMessage = 'Marcas enviadas. Esperando al resto de jugadores.';
  }

  advanceAfterScoring(): void {
    if (this.phase !== 'SCORING') {
      return;
    }

    this.realtime.sendGameAction('NEXT_ROUND');
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
    return player.isCurrentUser
      ? 'Es tu turno. Elige una de tus cartas marcadas y confirma con Seleccionar carta.'
      : `Esperando a que ${player.name} revele una de sus cartas.`;
  }

  getWinnersLabel(): string {
    return this.finalWinners.map((player) => player.name).join(', ');
  }

  formatPlace(place: number): string {
    if (place === 1) {
      return '1er';
    }

    if (place === 3) {
      return '3er';
    }

    return `${place}º`;
  }

  getPlayersSortedByScore(): StellaPlayerState[] {
    return [...this.players].sort((left, right) => right.score - left.score);
  }

  private applyLobbyDetails(lobby: Game): void {
    this.roomTitle = lobby.title?.trim() || this.roomTitle;

    lobby.players.forEach((playerId) => {
      const fallbackName =
        playerId === this.currentPlayerId ? this.auth.username() || playerId : playerId;
      this.playerNames.set(playerId, this.playerNames.get(playerId) ?? fallbackName);
    });
  }

  private hydrateCardCatalog(cards: DeckCard[]): void {
    this.cardCatalogByCode.clear();
    this.cardCatalog.clear();

    cards.forEach((card) => {
      const normalizedCode = card.code.trim();
      if (normalizedCode) {
        this.cardCatalogByCode.set(normalizedCode, card);
        const alternateCode = this.buildAlternateCardCode(normalizedCode);
        if (alternateCode) {
          this.cardCatalogByCode.set(alternateCode, card);
        }
        if (card.image && card.image !== DEFAULT_CARD_IMAGE) {
          this.dynamicCardUrls.set(normalizedCode, card.image);
          if (alternateCode) {
            this.dynamicCardUrls.set(alternateCode, card.image);
          }
        }
      }

      const numericCode = this.extractNumericCardId(card.code);
      if (Number.isFinite(numericCode)) {
        this.cardCatalog.set(numericCode, card);
      }
    });
  }

  private applyRealtimeLobbyState(lobbyState: RealtimeLobbyState): void {
    lobbyState.players.forEach((player) => {
      this.playerNames.set(player.id, player.username);
    });

    if (!this.roomTitle.trim()) {
      this.roomTitle = `Sala ${lobbyState.code}`;
    }
  }

  private applyRealtimeGameState(gameState: RealtimeGameStateUpdate): void {
    if (gameState.receivedAt <= this.lastAppliedGameStateReceivedAt) {
      return;
    }

    const state = this.asRecord(gameState.state);
    if (!state || this.readString(state, 'mode')?.toUpperCase() !== 'STELLA') {
      return;
    }

    this.lastAppliedGameStateReceivedAt = gameState.receivedAt;
    this.errorMessage = '';
    this.loading = false;

    const phase = this.normalizePhase(this.readString(state, 'phase'));
    const currentRound = this.asRecord(state['currentRound']) ?? {};
    this.syncDynamicCardUrls(state, currentRound);
    const boardCardEntries = this.readArray(currentRound, 'boardCards');
    const detailedBoardCardEntries = this.readArray(currentRound, 'boardCardsDetailed');
    const nextBoardCards = boardCardEntries
      .map((entry, index) => this.resolveBoardCard(detailedBoardCardEntries[index] ?? entry, index, entry))
      .filter((card): card is DeckCard => card !== null);
    const boardSignature = nextBoardCards.map((card) => card.code).join(',');
    const playerMarks = this.readPlayerMarks(currentRound);
    const revealedCards = this.readNumberArray(currentRound, 'revealedCards');
    const currentScoutId = this.readString(currentRound, 'currentScoutId') ?? '';
    const fallenPlayers = new Set(this.readStringArray(currentRound, 'fallenPlayers'));
    const scores = this.readNumberRecord(state, 'scores');
    const roundScores = this.readNumberRecord(currentRound, 'roundScores');
    const successfulMarks = this.readNumberRecord(currentRound, 'successfulMarks');
    const winners = this.readStringArray(state, 'winners');
    const playerIds = this.resolvePlayerIds(state, scores, playerMarks);

    if (boardSignature && boardSignature !== this.lastBoardSignature) {
      this.roundNumber = this.lastBoardSignature ? this.roundNumber + 1 : 1;
      this.lastBoardSignature = boardSignature;
      this.draftSelectionIds = [];
      this.revealLog = [];
      this.revealLogSequence = 0;
      this.firstScoutId = '';
      this.previousRoundSnapshot = null;
      this.pendingRevealCardCode = '';
      this.inspectedCard = null;
    }

    if (!this.firstScoutId && currentScoutId) {
      this.firstScoutId = currentScoutId;
    }

    const previousSnapshot = this.previousRoundSnapshot;
    this.phase = phase;
    this.activeExplorerId = currentScoutId;
    this.darkPlayerId = this.readString(currentRound, 'inTheDarkPlayerId') ?? '';
    this.activeWord = this.readString(currentRound, 'word') ?? '';
    this.activeWordCard = this.activeWord
      ? {
          id: this.roundNumber,
          terms: [this.activeWord, this.activeWord],
        }
      : null;

    this.boardCardIdsByCode.clear();
    this.boardCards = nextBoardCards;
    this.boardCards.forEach((card, index) => {
      const cardId = this.resolveNumericCardId(boardCardEntries[index], card.code);
      this.boardCardIdsByCode.set(card.code, cardId);
    });

    const revealedCardSet = new Set(revealedCards.map((cardId) => String(cardId)));
    this.players = playerIds.map((playerId, index) => {
      const selection = (playerMarks[playerId] ?? []).map((cardId) => String(cardId));
      const roundPointsNet = roundScores[playerId] ?? 0;

      return {
        id: playerId,
        name:
          this.playerNames.get(playerId) ??
          (playerId === this.currentPlayerId ? this.auth.username() || playerId : playerId),
        color: PLAYER_COLORS[index % PLAYER_COLORS.length],
        score: scores[playerId] ?? 0,
        selection,
        selectionCount: selection.length,
        submitted: playerMarks[playerId] !== undefined,
        lanternState: this.darkPlayerId === playerId ? 'DARK' : 'LIGHT',
        hasFallen: fallenPlayers.has(playerId),
        revealedSelectionCodes: selection.filter((cardCode) => revealedCardSet.has(cardCode)),
        roundPoints: roundPointsNet,
        successfulAssociations: successfulMarks[playerId] ?? 0,
        isCurrentUser: playerId === this.currentPlayerId,
      };
    });

    if (playerMarks[this.currentPlayerId]?.length) {
      this.draftSelectionIds = [];
    } else if (phase !== 'STELLA_MARKING') {
      this.draftSelectionIds = [];
    }

    if (phase !== 'STELLA_REVEAL' || !this.isCardRevealable(this.pendingRevealCardCode)) {
      this.pendingRevealCardCode = '';
    }

    this.appendRevealLog(previousSnapshot, {
      playerMarks,
      revealedCards,
      currentScoutId,
    });
    this.previousRoundSnapshot = {
      playerMarks,
      revealedCards: [...revealedCards],
      currentScoutId,
    };

    this.scoringSummary = this.buildScoringSummary(roundScores, successfulMarks, fallenPlayers);
    this.finalWinners = winners.length
      ? this.players.filter((player) => winners.includes(player.id))
      : [];
    this.syncStatusCopy();
  }

  private applyRealtimeMinigameStart(minigame: RealtimeMinigameStart): void {
    if (minigame.receivedAt <= this.lastAppliedMinigameReceivedAt) {
      return;
    }

    this.lastAppliedMinigameReceivedAt = minigame.receivedAt;
    this.isMinigameCountdownOpen = false;
    this.clearMinigameResolutionTimer();
    this.clearMinigameUnavailableSubmitTimer();
    this.activeMinigame = minigame;
    this.minigameResultSent = false;
    this.minigameUiState = 'playing';
    this.minigameStatusMessage = '';
    this.realtime.clearMinigameStart();

    if (!this.isCurrentPlayerInActiveMinigame) {
      this.isMinigame1Open = false;
      this.isMinigame2Open = false;
      this.isMinigame3Open = false;
      this.minigameStatusMessage =
        this.resolveMinigameView(minigame.type) === null
          ? 'Minijuego no disponible en este cliente. Esperando resolucion del servidor...'
          : 'Minijuego en curso. Esperando resolucion del servidor...';
      return;
    }

    const minigameView = this.resolveMinigameView(minigame.type);
    if (minigameView === null) {
      this.isMinigame1Open = false;
      this.isMinigame2Open = false;
      this.isMinigame3Open = false;
      this.minigameUiState = 'waiting';
      this.minigameStatusMessage = 'Este minijuego aun no esta disponible. Enviando resultado neutro...';
      this.scheduleUnavailableMinigameSubmit(minigame.duration);
      return;
    }

    this.openMinigameView(minigameView);
  }

  private openMinigameView(minigameView: 1 | 2 | 3 | null): void {
    if (minigameView === null) {
      this.isMinigame1Open = false;
      this.isMinigame2Open = false;
      this.isMinigame3Open = false;
      this.minigameUiState = 'waiting';
      this.minigameStatusMessage = 'Este minijuego aun no esta disponible. Enviando resultado neutro...';
      this.scheduleUnavailableMinigameSubmit(this.activeMinigameDurationMs);
    } else if (minigameView === 2) {
      this.isMinigame1Open = false;
      this.isMinigame2Open = true;
      this.isMinigame3Open = false;
    } else if (minigameView === 3) {
      this.isMinigame1Open = false;
      this.isMinigame2Open = false;
      this.isMinigame3Open = true;
    } else {
      this.isMinigame1Open = true;
      this.isMinigame2Open = false;
      this.isMinigame3Open = false;
    }
  }

  onMinigameCountdownFinished(): void {
    this.isMinigameCountdownOpen = false;
    const activeMinigame = this.activeMinigame;
    if (!activeMinigame || this.minigameUiState !== 'playing') {
      return;
    }

    this.openMinigameView(this.resolveMinigameView(activeMinigame.type));
  }

  private applyRealtimeSpecialEvent(specialEvent: RealtimeSpecialEvent): void {
    if (!this.activeMinigame) {
      return;
    }

    if (specialEvent.effect === 'CONFLICT_RESOLVED') {
      this.isMinigameCountdownOpen = false;
      if (specialEvent.winnerId === this.currentPlayerId) {
        this.minigameUiState = 'won';
        this.minigameStatusMessage = 'Victoria';
      } else if (specialEvent.loserId === this.currentPlayerId) {
        this.minigameUiState = 'lost';
        this.minigameStatusMessage = 'Derrota';
      } else {
        this.minigameUiState = 'waiting';
        this.minigameStatusMessage = specialEvent.message || 'Conflicto resuelto.';
      }

      this.scheduleMinigameClose(3000);
      return;
    }

    if (specialEvent.effect === 'CONFLICT_CANCELLED' || specialEvent.effect === 'CONFLICT_DRAW') {
      this.isMinigameCountdownOpen = false;
      this.minigameUiState = 'cancelled';
      this.minigameStatusMessage =
        specialEvent.message || 'El minijuego ha terminado sin ganador.';
      this.scheduleMinigameClose(2000);
    }
  }

  private appendRevealLog(
    previousSnapshot: StellaRoundSnapshot | null,
    nextSnapshot: StellaRoundSnapshot
  ): void {
    if (!previousSnapshot) {
      return;
    }

    const newRevealedCards = nextSnapshot.revealedCards.filter(
      (cardId) => !previousSnapshot.revealedCards.includes(cardId)
    );
    if (newRevealedCards.length === 0) {
      return;
    }

    const nextEntries = newRevealedCards.map((cardId) => {
      const explorerId = previousSnapshot.currentScoutId || nextSnapshot.currentScoutId;
      const matchingPlayerNames = Object.entries(nextSnapshot.playerMarks)
        .filter(([playerId, marks]) => playerId !== explorerId && marks.includes(cardId))
        .map(([playerId]) => this.playerNames.get(playerId) ?? playerId);
      const outcome: RevealOutcome =
        matchingPlayerNames.length === 0
          ? 'fall'
          : matchingPlayerNames.length === 1
            ? 'super-spark'
            : 'spark';

      return {
        id: ++this.revealLogSequence,
        explorerName: this.playerNames.get(explorerId) ?? explorerId ?? 'Scout',
        cardCode: String(cardId),
        cardLabel: this.resolveBoardCard(cardId)?.value ?? String(cardId),
        matchingPlayerNames,
        outcome,
        outcomeLabel:
          outcome === 'super-spark' ? 'Super-spark' : outcome === 'spark' ? 'Spark' : 'Caida',
      };
    });

    this.revealLog = [...nextEntries.reverse(), ...this.revealLog];
  }

  private buildScoringSummary(
    roundScores: Record<string, number>,
    successfulMarks: Record<string, number>,
    fallenPlayers: Set<string>
  ): ScoringSummaryRow[] {
    const penaltyPlayerId =
      this.darkPlayerId && fallenPlayers.has(this.darkPlayerId) ? this.darkPlayerId : '';

    return this.players.map((player) => {
      const penalty = player.id === penaltyPlayerId ? successfulMarks[player.id] ?? 0 : 0;
      const netPoints = roundScores[player.id] ?? 0;
      const roundPoints = netPoints + penalty;

      return {
        playerId: player.id,
        playerName: player.name,
        scoreBefore: player.score - netPoints,
        roundPoints,
        penalty,
        netPoints,
        totalScore: player.score,
      };
    });
  }

  private syncStatusCopy(): void {
    switch (this.phase) {
      case 'STELLA_WORD_REVEAL':
        this.selectionMessage = 'La palabra ya es visible. Esperando a que el servidor abra el marcado.';
        this.lastResolutionTitle = 'Palabra revelada';
        break;
      case 'STELLA_MARKING':
        this.selectionMessage = this.currentPlayer.submitted
          ? 'Tus marcas ya estan enviadas. Esperando al resto de jugadores.'
          : 'Marca entre 1 y 10 cartas para cerrar tu pizarra.';
        this.lastResolutionTitle = 'Marcado abierto';
        break;
      case 'STELLA_REVEAL':
        this.selectionMessage = this.isCurrentUserExplorer
          ? this.pendingRevealCardCode
            ? `Carta preparada: ${this.pendingRevealCardLabel}. Pulsa Seleccionar carta para enviarla.`
            : 'Tu turno: elige una de tus marcas sin revelar y confirma con Seleccionar carta.'
          : this.activeExplorer
            ? `Esperando la jugada de ${this.activeExplorer.name}.`
            : 'Esperando el siguiente scout.';
        this.lastResolutionTitle = this.latestRevealLog
          ? `Ultima jugada: ${this.latestRevealLog.outcomeLabel}`
          : 'Revelado en curso';
        break;
      case 'SCORING':
        this.selectionMessage = this.darkPlayerId
          ? `Oscuridad: ${this.playerNames.get(this.darkPlayerId) ?? this.darkPlayerId}.`
          : 'Ningun jugador ha quedado en Oscuridad.';
        this.lastResolutionTitle = 'Puntuacion cerrada';
        break;
      case 'FINISHED':
        this.selectionMessage = 'La partida ha finalizado.';
        this.lastResolutionTitle = 'Victoria final';
        break;
    }
  }

  private resolveMinigameView(type: number): 1 | 2 | 3 | null {
    if (type === 0) {
      return 1;
    }

    if (type === 1) {
      return 2;
    }

    if (type === 2) {
      return 3;
    }

    return null;
  }

  private scheduleMinigameClose(delayMs: number): void {
    this.clearMinigameResolutionTimer();
    this.minigameResolutionTimer = setTimeout(() => {
      this.closeActiveMinigame();
      this.minigameResolutionTimer = null;
      this.cdr.detectChanges();
    }, delayMs);
  }

  private clearMinigameResolutionTimer(): void {
    if (this.minigameResolutionTimer === null) {
      return;
    }

    clearTimeout(this.minigameResolutionTimer);
    this.minigameResolutionTimer = null;
  }

  private scheduleUnavailableMinigameSubmit(durationMs: number): void {
    this.clearMinigameUnavailableSubmitTimer();
    this.minigameUnavailableSubmitTimer = setTimeout(() => {
      this.minigameUnavailableSubmitTimer = null;
      this.onMinigameFinished({ score: 0 });
      this.cdr.detectChanges();
    }, Math.max(500, durationMs));
  }

  private clearMinigameUnavailableSubmitTimer(): void {
    if (this.minigameUnavailableSubmitTimer === null) {
      return;
    }

    clearTimeout(this.minigameUnavailableSubmitTimer);
    this.minigameUnavailableSubmitTimer = null;
  }

  private closeActiveMinigame(): void {
    this.isMinigame1Open = false;
    this.isMinigame2Open = false;
    this.isMinigame3Open = false;
    this.isMinigameCountdownOpen = false;
    this.clearMinigameUnavailableSubmitTimer();
    this.clearMinigameResolutionTimer();
    this.activeMinigame = null;
    this.minigameResultSent = false;
    this.minigameUiState = 'playing';
    this.minigameStatusMessage = '';
  }

  private toggleDraftSelection(cardCode: string): void {
    const cardId = this.boardCardIdsByCode.get(cardCode);
    if (typeof cardId !== 'number') {
      return;
    }

    const currentIndex = this.draftSelectionIds.indexOf(cardId);
    if (currentIndex >= 0) {
      this.draftSelectionIds = this.draftSelectionIds.filter((entry) => entry !== cardId);
      this.limitFeedbackActive = false;
      return;
    }

    if (this.draftSelectionIds.length >= MAX_SELECTIONS) {
      this.limitFeedbackActive = true;
      this.selectionMessage = 'No puedes marcar mas de 10 cartas.';
      return;
    }

    this.limitFeedbackActive = false;
    this.draftSelectionIds = [...this.draftSelectionIds, cardId];
  }

  private resolveBoardCard(entry: unknown, index = 0, fallbackEntry?: unknown): DeckCard | null {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      return this.buildBoardCardFromCode(String(entry), `Carta ${entry}`);
    }

    if (typeof entry === 'string' && entry.trim()) {
      const normalizedCode = entry.trim();
      return this.buildBoardCardFromCode(normalizedCode, `Carta ${normalizedCode}`);
    }

    const card = this.asRecord(entry);
    if (!card) {
      return null;
    }

    const fallbackCode = this.resolveFallbackBoardCardCode(fallbackEntry);
    const code = fallbackCode ?? this.resolveBoardCardCodeFromRecord(card, index);
    const knownCard = this.findKnownCardByCode(code);
    const image =
      this.preferKnownCardImage(
        this.readStringFromCandidates(card, ['url_image', 'image', 'imageUrl', 'image_url', 'url']) ??
          this.dynamicCardUrls.get(code) ??
          DEFAULT_CARD_IMAGE,
        knownCard
      );
    const value =
      this.readStringFromCandidates(card, ['title', 'name', 'value']) ?? knownCard?.value ?? `Carta ${code}`;
    const suit =
      this.readStringFromCandidates(card, ['suit', 'collection']) ?? knownCard?.suit ?? 'STELLA';

    return {
      code,
      image,
      value,
      suit,
    };
  }

  private resolvePlayerIds(
    state: Record<string, unknown>,
    scores: Record<string, number>,
    playerMarks: Record<string, number[]>
  ): string[] {
    const playerIds = this.readStringArray(state, 'players');
    if (playerIds.length > 0) {
      return playerIds;
    }

    return Array.from(
      new Set([
        ...Object.keys(scores),
        ...Object.keys(playerMarks),
        ...this.playerNames.keys(),
        this.currentPlayerId,
      ].filter(Boolean))
    );
  }

  private normalizePhase(value: string | null): StellaPhase {
    switch (value) {
      case 'STELLA_MARKING':
      case 'STELLA_REVEAL':
      case 'SCORING':
      case 'FINISHED':
        return value;
      case 'STELLA_WORD_REVEAL':
      default:
        return 'STELLA_WORD_REVEAL';
    }
  }

  private get currentPlayerId(): string {
    return this.auth.session()?.user.id ?? '';
  }

  private getCurrentSelectionCodes(): string[] {
    const currentPlayerState = this.players.find((entry) => entry.isCurrentUser);
    if (currentPlayerState?.submitted) {
      return currentPlayerState.selection;
    }

    return this.draftSelectionIds.map((cardId) => String(cardId));
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  }

  private readString(source: Record<string, unknown>, key: string): string | null {
    const value = source[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private readStringArray(source: Record<string, unknown>, key: string): string[] {
    const value = source[key];
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }

  private readNumberArray(source: Record<string, unknown>, key: string): number[] {
    return this.readArray(source, key)
      .map((entry) => (typeof entry === 'number' ? entry : typeof entry === 'string' ? Number(entry) : NaN))
      .filter((entry) => Number.isFinite(entry));
  }

  private readArray(source: Record<string, unknown>, key: string): unknown[] {
    const value = source[key];
    return Array.isArray(value) ? value : [];
  }

  private readNumberRecord(source: Record<string, unknown>, key: string): Record<string, number> {
    const value = this.asRecord(source[key]);
    if (!value) {
      return {};
    }

    return Object.entries(value).reduce<Record<string, number>>((accumulator, [entryKey, entryValue]) => {
      const numericValue =
        typeof entryValue === 'number'
          ? entryValue
          : typeof entryValue === 'string'
            ? Number(entryValue)
            : NaN;

      if (Number.isFinite(numericValue)) {
        accumulator[entryKey] = numericValue;
      }

      return accumulator;
    }, {});
  }

  private syncDynamicCardUrls(
    state: Record<string, unknown>,
    currentRound: Record<string, unknown>
  ): void {
    this.collectDynamicCardUrls(this.asRecord(state['cardUrls']));
    this.collectDynamicCardUrls(this.asRecord(currentRound['cardUrls']));
  }

  private collectDynamicCardUrls(source: Record<string, unknown> | null): void {
    if (!source) {
      return;
    }

    for (const [rawCode, value] of Object.entries(source)) {
      const normalizedCode = rawCode.trim();
      if (!normalizedCode) {
        continue;
      }

      if (typeof value === 'string' && value.trim()) {
        this.dynamicCardUrls.set(normalizedCode, value.trim());
        const alternateCode = this.buildAlternateCardCode(normalizedCode);
        if (alternateCode) {
          this.dynamicCardUrls.set(alternateCode, value.trim());
        }
        continue;
      }

      const cardData = this.asRecord(value);
      const url = cardData
        ? this.readStringFromCandidates(cardData, ['url_image', 'image', 'imageUrl', 'image_url', 'url'])
        : null;
      if (url) {
        this.dynamicCardUrls.set(normalizedCode, url);
        const alternateCode = this.buildAlternateCardCode(normalizedCode);
        if (alternateCode) {
          this.dynamicCardUrls.set(alternateCode, url);
        }
      }
    }
  }

  private buildBoardCardFromCode(code: string, fallbackValue: string): DeckCard {
    const knownCard = this.findKnownCardByCode(code);
    return {
      code,
      image: this.preferKnownCardImage(this.dynamicCardUrls.get(code) ?? DEFAULT_CARD_IMAGE, knownCard),
      value: knownCard?.value ?? fallbackValue,
      suit: knownCard?.suit ?? 'STELLA',
    };
  }

  private findKnownCardByCode(code: string): DeckCard | null {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return null;
    }

    return (
      this.cardCatalogByCode.get(normalizedCode) ??
      this.boardCards.find((card) => card.code === normalizedCode) ??
      this.ownedCards.find((card) => card.code === normalizedCode) ??
      null
    );
  }

  private preferKnownCardImage(image: string, knownCard: DeckCard | null): string {
    if (!knownCard || !knownCard.image || knownCard.image === DEFAULT_CARD_IMAGE) {
      return image;
    }

    return knownCard.image;
  }

  private resolveNumericCardId(entry: unknown, fallbackCode: string): number {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      return entry;
    }

    if (typeof entry === 'string') {
      const parsed = this.extractNumericCardId(entry);
      return Number.isFinite(parsed) ? parsed : Number(fallbackCode) || 0;
    }

    const record = this.asRecord(entry);
    const numericId = record
      ? this.readNumberFromCandidates(record, ['cardId', 'card_id', 'id', 'idCard', 'id_card'])
      : null;
    if (numericId !== null) {
      return numericId;
    }

    const codeFromRecord = record
      ? this.readStringFromCandidates(record, ['code', 'cardId', 'card_id', 'id', 'idCard', 'id_card'])
      : null;
    const parsedFallback = this.extractNumericCardId(codeFromRecord ?? fallbackCode);
    return Number.isFinite(parsedFallback) ? parsedFallback : 0;
  }

  private resolveFallbackBoardCardCode(entry: unknown): string | null {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      return String(entry);
    }

    if (typeof entry === 'string' && entry.trim()) {
      const numericId = this.extractNumericCardId(entry);
      return Number.isFinite(numericId) ? String(numericId) : entry.trim();
    }

    const record = this.asRecord(entry);
    if (!record) {
      return null;
    }

    const numericId = this.readNumberFromCandidates(record, ['cardId', 'card_id', 'id', 'idCard', 'id_card']);
    if (numericId !== null) {
      return String(numericId);
    }

    const code = this.readStringFromCandidates(record, ['code', 'cardId', 'card_id', 'id', 'idCard', 'id_card']);
    if (!code) {
      return null;
    }

    const parsedCode = this.extractNumericCardId(code);
    return Number.isFinite(parsedCode) ? String(parsedCode) : code;
  }

  private resolveBoardCardCodeFromRecord(card: Record<string, unknown>, index: number): string {
    return (
      this.readStringFromCandidates(card, ['code', 'cardId', 'card_id', 'id', 'idCard', 'id_card']) ??
      this.readNumberFromCandidates(card, ['cardId', 'card_id', 'id', 'idCard', 'id_card'])?.toString() ??
      `card-${index + 1}`
    );
  }

  private extractNumericCardId(value: string): number {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return NaN;
    }

    const directValue = Number(trimmedValue);
    if (Number.isFinite(directValue)) {
      return directValue;
    }

    const suffixMatch = trimmedValue.match(/(\d+)$/);
    return suffixMatch ? Number(suffixMatch[1]) : NaN;
  }

  private buildAlternateCardCode(code: string): string | null {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return null;
    }

    if (/^c_\d+$/i.test(normalizedCode)) {
      return normalizedCode.replace(/^c_/i, '');
    }

    if (/^\d+$/.test(normalizedCode)) {
      return `c_${normalizedCode}`;
    }

    return null;
  }

  private readStringFromCandidates(
    source: Record<string, unknown>,
    keys: readonly string[]
  ): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private readNumberFromCandidates(
    source: Record<string, unknown>,
    keys: readonly string[]
  ): number | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return null;
  }

  private readPlayerMarks(source: Record<string, unknown>): Record<string, number[]> {
    const value = this.asRecord(source['playerMarks']);
    if (!value) {
      return {};
    }

    return Object.entries(value).reduce<Record<string, number[]>>((accumulator, [playerId, marks]) => {
      if (Array.isArray(marks)) {
        accumulator[playerId] = marks
          .map((entry) =>
            typeof entry === 'number' ? entry : typeof entry === 'string' ? Number(entry) : NaN
          )
          .filter((entry) => Number.isFinite(entry));
      }

      return accumulator;
    }, {});
  }
}
