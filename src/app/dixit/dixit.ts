import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CardPull } from '../services/card-pull';
import type { DeckCard } from '../services/card-pull';
import { DixitTrackBoard } from './components/track-board';
import type { TrackBoardToken } from './components/track-board';
import type { DixitRankingRow, DixitRevealedCard } from './phases/points-phase';
import {
  EVENT_BACK_CELL_POSITIONS,
  EVENT_FORWARD_CELL_POSITIONS,
  PHASE_STEPS,
  ROUND_CLUES,
  WILDCARD_CELL_POSITIONS,
  WILDCARD_REWARDS,
  type BoardEffectPopup,
  type DixitPhase,
  type PhaseStep,
  type PlayerPanelRow,
  type PointsStage,
  type RosterPlayer,
  type RoundPlayer,
  type WildcardReward,
} from './dixit.constants';
import {
  buildBoardTokensFromScores,
  buildRevealAndRanking,
  getCurrentPhaseInstruction,
  getRoundPlayers,
  resolveCurrentPlayerSpecialCells,
  rotateCards,
} from './dixit.logic';

@Component({
  selector: 'app-dixit',
  standalone: true,
  imports: [DixitTrackBoard],
  templateUrl: './dixit.html',
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
  boardTokens: TrackBoardToken[] = buildBoardTokensFromScores(
    this.playerRoster,
    this.pointsByPlayer
  );
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
      this.boardTokens = buildBoardTokensFromScores(this.playerRoster, this.pointsByPlayer);
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
    return getCurrentPhaseInstruction(this.phase, this.pointsStage);
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

    const { revealedCards, ranking } = buildRevealAndRanking(
      this.currentRoundPlayers,
      this.choiceCards,
      this.playerRoster,
      this.selectedChoiceCardCode
    );
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
    this.cards = rotateCards(this.cards);
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
    const resolvedPoints = resolveCurrentPlayerSpecialCells({
      previousPoints: currentPoints,
      nextPoints: updatedPoints,
      allowWildcardReward: false,
      wildcardCellPositions: this.wildcardCellPositions,
      eventBackCellPositions: this.eventBackCellPositions,
      eventForwardCellPositions: this.eventForwardCellPositions,
      roundNumber: this.roundNumber,
      onWildcardReward: () => this.grantWildcardReward(),
      onPopup: (popup) => this.enqueueEffectPopup(popup),
    });
    this.pointsByPlayer.set('you', resolvedPoints);
    this.boardTokens = buildBoardTokensFromScores(this.playerRoster, this.pointsByPlayer);
  }

  private initializePointsPhase(): void {
    this.clearRevealRankingTimer();
    this.pointsStage = 'waiting';
    this.pointsRevealedCards = [];
    this.pointsRanking = [];
    this.pendingBoardTokens = null;
    this.currentRoundPlayers = getRoundPlayers(
      this.playerRoster,
      this.choiceCards,
      this.pointsByPlayer
    );
    this.pointsVotesTotal = this.currentRoundPlayers.length;
    this.pointsVotesReceived = this.voteSubmitted && this.pointsVotesTotal > 0 ? 1 : 0;
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
    const nextBoardTokens = buildBoardTokensFromScores(this.playerRoster, this.pointsByPlayer);
    this.pointsStage = 'ranking';

    if (this.activeEffectPopup !== null || this.effectPopupQueue.length > 0) {
      this.pendingBoardTokens = nextBoardTokens;
    } else {
      this.boardTokens = nextBoardTokens;
      this.pendingBoardTokens = null;
    }

    this.revealRankingTimer = null;
  }

  private applyCurrentPlayerSpecialCells(ranking: DixitRankingRow[]): void {
    const currentPlayerPreviousPoints = this.boardTokens.find((token) => token.id === 'you')?.position ?? 0;
    const currentPlayerRow = ranking.find((row) => row.playerId === 'you');

    if (!currentPlayerRow) {
      return;
    }

    const resolvedPoints = resolveCurrentPlayerSpecialCells({
      previousPoints: currentPlayerPreviousPoints,
      nextPoints: currentPlayerRow.totalPoints,
      wildcardCellPositions: this.wildcardCellPositions,
      eventBackCellPositions: this.eventBackCellPositions,
      eventForwardCellPositions: this.eventForwardCellPositions,
      roundNumber: this.roundNumber,
      onWildcardReward: () => this.grantWildcardReward(),
      onPopup: (popup) => this.enqueueEffectPopup(popup),
    });

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

  private enqueueEffectPopup(popup: BoardEffectPopup): void {
    if (this.activeEffectPopup === null) {
      this.activeEffectPopup = popup;
      return;
    }

    this.effectPopupQueue.push(popup);
  }
}
