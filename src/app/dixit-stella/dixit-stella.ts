import { ChangeDetectorRef, Component, Injector, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RealtimeGameStateUpdate, RealtimeLobbyState } from '../interfaces/dixit-realtime';
import { Game } from '../interfaces/game';
import { WordCard } from '../interfaces/word-card';
import { Auth } from '../services/auth';
import { DeckCard } from '../services/card-pull';
import { DixitRealtime } from '../services/dixit-realtime';
import { GamesPull } from '../services/games-pull';
import { StellaCardPull } from '../services/stella-card-pull';
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
  templateUrl: './dixit-stella.html',
  styleUrl: './dixit-stella.css',
})
export class DixitStella implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly stellaCardPull = inject(StellaCardPull);
  private readonly gamesPull = inject(GamesPull);
  private readonly realtime = inject(DixitRealtime);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);

  private readonly playerNames = new Map<string, string>();
  private readonly cardCatalog = new Map<number, DeckCard>();
  private readonly boardCardIdsByCode = new Map<string, number>();
  private lastAppliedGameStateReceivedAt = 0;
  private lastBoardSignature = '';
  private revealLogSequence = 0;
  private firstScoutId = '';
  private previousRoundSnapshot: StellaRoundSnapshot | null = null;
  private draftSelectionIds: number[] = [];

  readonly boardRowIndexes = Array.from({ length: BOARD_ROWS }, (_, index) => index);
  readonly announceTrack = Array.from({ length: MAX_SELECTIONS }, (_, index) => index + 1);

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
  lastResolutionTitle = 'Esperando revelaciones';
  limitFeedbackActive = false;
  inspectedCard: DeckCard | null = null;

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

    this.loading = false;
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
        return this.isCurrentUserExplorer
          ? 'Te toca revelar: pulsa una de tus cartas marcadas que aun no se haya revelado.'
          : 'Espera a que el jugador explorador revele su siguiente carta.';
      case 'SCORING':
        return 'El servidor ya ha aplicado puntuacion y penalizaciones.';
      case 'FINISHED':
        return 'La clasificacion final ya no cambia.';
    }
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
      const cardId = this.boardCardIdsByCode.get(cardCode);
      if (typeof cardId === 'number') {
        this.realtime.sendGameAction('STELLA_REVEAL_MARK', { cardId });
      }
    }
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
      ? 'Es tu turno. Pulsa una de tus cartas marcadas para revelarla.'
      : `Esperando a que ${player.name} revele una de sus cartas.`;
  }

  getWinnersLabel(): string {
    return this.finalWinners.map((player) => player.name).join(', ');
  }

  getPlayersSortedByScore(): StellaPlayerState[] {
    return [...this.players].sort((left, right) => right.score - left.score);
  }

  private applyLobbyDetails(lobby: Game): void {
    this.roomTitle = lobby.title?.trim() || this.roomTitle;

    lobby.players.forEach((playerId) => {
      this.playerNames.set(playerId, this.playerNames.get(playerId) ?? playerId);
    });
  }

  private hydrateCardCatalog(cards: DeckCard[]): void {
    this.cardCatalog.clear();

    cards.forEach((card) => {
      const numericCode = Number(card.code);
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
    const boardCardIds = this.readNumberArray(currentRound, 'boardCards');
    const boardSignature = boardCardIds.join(',');
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
    this.boardCards = boardCardIds.map((cardId) => {
      const card = this.resolveBoardCard(cardId);
      this.boardCardIdsByCode.set(card.code, cardId);
      return card;
    });

    const revealedCardSet = new Set(revealedCards.map((cardId) => String(cardId)));
    this.players = playerIds.map((playerId, index) => {
      const selection = (playerMarks[playerId] ?? []).map((cardId) => String(cardId));
      const roundPointsNet = roundScores[playerId] ?? 0;

      return {
        id: playerId,
        name: this.playerNames.get(playerId) ?? playerId,
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
        cardLabel: this.resolveBoardCard(cardId).value,
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
          ? 'Tu turno: elige una de tus marcas sin revelar.'
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

  private resolveBoardCard(cardId: number): DeckCard {
    return (
      this.cardCatalog.get(cardId) ?? {
        code: String(cardId),
        image: DEFAULT_CARD_IMAGE,
        value: `Carta ${cardId}`,
        suit: 'STELLA',
      }
    );
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
    const value = source[key];
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => (typeof entry === 'number' ? entry : typeof entry === 'string' ? Number(entry) : NaN))
      .filter((entry) => Number.isFinite(entry));
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
