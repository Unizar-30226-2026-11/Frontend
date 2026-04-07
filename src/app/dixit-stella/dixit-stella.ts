import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Game } from '../interfaces/game';
import { WordCard } from '../interfaces/word-card';
import { DeckCard } from '../services/card-pull';
import { GamesPull } from '../services/games-pull';
import { StellaCardPull } from '../services/stella-card-pull';
import { WordCardPull } from '../services/word-card-pull';
import {
  BOARD_CARD_COUNT,
  BOARD_COLUMNS,
  BOARD_ROWS,
  MAX_SELECTIONS,
  MIN_SELECTIONS,
  PHASE_META,
  TOTAL_ROUNDS,
  type PhaseMeta,
  type RevealLogEntry,
  type RevealOutcome,
  type ScoringSummaryRow,
  type StellaPhase,
  type StellaPlayerState,
} from './dixit-stella.constants';
import {
  applyScoringPhase,
  createPlayersFromLobby,
  createSeedFromString,
  normalizeSelection,
  resetPlayersForRound,
  resolveActiveWord,
  sortPlayersByScore,
  shuffleWithSeed,
} from './dixit-stella.logic';
import {
  runAdvanceAfterScoring,
  runAutoSubmitOpponents,
  runResolveExplorerTurn,
  runStartAnnouncePhase,
  runStartRevealPhase,
  runToggleCurrentSelection,
  type StellaRuntimeHost,
} from './dixit-stella.runtime';

@Component({
  selector: 'app-dixit-stella',
  standalone: true,
  templateUrl: './dixit-stella.html',
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

    const uniqueCodes = normalizeSelection(cardCodes, this.boardCards);

    player.selection = uniqueCodes;
    player.selectionCount = uniqueCodes.length;
    player.submitted = true;
  }

  startAnnouncePhase(): void {
    runStartAnnouncePhase(this as unknown as StellaRuntimeHost);
  }

  startRevealPhase(): void {
    runStartRevealPhase(this as unknown as StellaRuntimeHost);
  }

  resolveExplorerTurn(cardCode?: string): void {
    runResolveExplorerTurn(this as unknown as StellaRuntimeHost, cardCode);
  }

  advanceAfterScoring(): void {
    runAdvanceAfterScoring(this as unknown as StellaRuntimeHost);
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

  getWinnersLabel(): string {
    return this.finalWinners.map((player) => player.name).join(', ');
  }

  getPlayersSortedByScore(): StellaPlayerState[] {
    return sortPlayersByScore(this.players);
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
    const lobbyPlayers = lobby?.players.filter((playerId) => playerId.trim().length > 0) ?? [];
    this.players = createPlayersFromLobby(lobbyPlayers);
    this.firstExplorerIndex = createSeedFromString(`${seedKey}-first`) % this.players.length;

    this.prepareRoundState();
  }

  private prepareRoundState(): void {
    this.phase = 'association';
    this.activeWordCard = this.wordCards[this.roundNumber - 1] ?? this.wordCards[0] ?? null;
    this.activeWord = this.activeWordCard
      ? resolveActiveWord(this.activeWordCard, this.roundNumber, this.id)
      : '';
    this.activeExplorerId = '';
    this.darkPlayerId = '';
    this.revealLog = [];
    this.scoringSummary = [];
    this.selectionMessage = 'Marca entre 1 y 10 cartas para cerrar tu pizarra.';
    this.lastResolutionTitle = 'Preparando ronda';
    this.limitFeedbackActive = false;
    resetPlayersForRound(this.players);
  }

  private toggleCurrentSelection(cardCode: string): void {
    runToggleCurrentSelection(this as unknown as StellaRuntimeHost, cardCode);
  }

  private autoSubmitOpponents(): void {
    runAutoSubmitOpponents(this as unknown as StellaRuntimeHost);
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

  private getPlayerIndex(playerId: string): number {
    return this.players.findIndex((player) => player.id === playerId);
  }

  private applyScoringPhase(): void {
    const scoringResult = applyScoringPhase(this.players, this.darkPlayerId);
    this.scoringSummary = scoringResult.summary;
    this.phase = 'scoring';
    this.activeExplorerId = '';
    this.lastResolutionTitle = 'Puntuacion cerrada';
    this.selectionMessage = scoringResult.selectionMessage;
  }
}
