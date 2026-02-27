import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CardPull, DeckCard } from '../services/card-pull';
import { DixitChoicePhase } from './phases/choice-phase';
import { DixitHandPhase } from './phases/hand-phase';
import {
  DixitPointsPhase,
  DixitRankingRow,
  DixitRevealedCard,
} from './phases/points-phase';

type DixitPhase = 'hand' | 'choice' | 'points' | 'next';

interface RoundPlayer {
  id: string;
  name: string;
  pointsBefore: number;
}

@Component({
  selector: 'app-dixit',
  standalone: true,
  imports: [RouterModule, DixitHandPhase, DixitChoicePhase, DixitPointsPhase],
  template: `
    <section class="dixit-board">
      <header class="dixit-header">
        <h1>Mi mazo</h1>

        @if (!loading && !errorMessage && cards.length > 0) {
          <div class="phase-switch">
            <button
              type="button"
              [class.active]="phase === 'hand'"
              (click)="setPhase('hand')"
            >
              Fase 1
            </button>
            <button
              type="button"
              [class.active]="phase === 'choice'"
              (click)="setPhase('choice')"
            >
              Fase 2
            </button>
            <button
              type="button"
              [class.active]="phase === 'points'"
              (click)="setPhase('points')"
            >
              Fase 3
            </button>
          </div>
        }
      </header>

      @if (loading) {
        <p>Cargando cartas...</p>
      }

      @if (!loading && errorMessage) {
        <p>{{ errorMessage }}</p>
      }

      @if (!loading && !errorMessage && cards.length === 0) {
        <p>No se recibieron cartas.</p>
      }

      @if (!loading && cards.length > 0) {
        <div class="phase-content">
          @if (phase === 'hand') {
            <app-dixit-hand-phase
              [cards]="cards"
              [selectedCardCode]="selectedHandCardCode"
              (cardSelected)="onHandCardSelected($event)"
            />
          } @else if (phase === 'choice') {
            <app-dixit-choice-phase
              class="choice-phase"
              [cards]="choiceCards"
              [selectedCardCode]="selectedChoiceCardCode"
              (choiceConfirmed)="onChoiceConfirmed($event)"
            />
          } @else if (phase === 'points') {
            <app-dixit-points-phase
              [waitingVotes]="pointsWaitingVotes"
              [votesReceived]="pointsVotesReceived"
              [votesTotal]="pointsVotesTotal"
              [revealedCards]="pointsRevealedCards"
              [ranking]="pointsRanking"
              [showRanking]="pointsShowRanking"
              (skipWaitingRequested)="onPointsSkipWaitingRequested()"
              (rankingRequested)="onPointsRankingRequested()"
            />
          } @else {
            <!-- Fase 4 -->
          }
        </div>
      }
    </section>
  `,
  styles: `
    .dixit-board {
      min-height: 100svh;
      padding-top: 20px;
      display: flex;
      flex-direction: column;
    }

    .dixit-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-right: 12px;
    }

    h1 {
      margin-top: 0px;
      margin-bottom: 16px;
    }

    .phase-switch {
      display: inline-flex;
      gap: 6px;
      background: rgba(255, 255, 255, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 4px;
      border-radius: 999px;
      backdrop-filter: blur(6px);
    }

    .phase-switch button {
      border: 0;
      background: transparent;
      color: #fff;
      padding: 6px 12px;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 600;
    }

    .phase-switch button.active {
      background: rgba(255, 255, 255, 0.9);
      color: #1b2430;
    }

    .phase-content {
      flex: 1;
      display: flex;
      min-height: 0;
      margin-bottom: 0;
    }

    .choice-phase {
      width: auto;
      height: auto;
      margin-bottom: 0;
    }

    @media (max-width: 700px) {
      .dixit-header {
        align-items: flex-start;
        flex-direction: column;
        padding-right: 0;
      }
    }
  `,
})
export class Dixit implements OnInit, OnDestroy {
  private readonly maxPlayersPerMatch = 6;

  private readonly playerRoster = [
    { id: 'you', name: 'Tu' },
    { id: 'ana', name: 'Ana' },
    { id: 'bruno', name: 'Bruno' },
    { id: 'carla', name: 'Carla' },
    { id: 'diego', name: 'Diego' },
    { id: 'elena', name: 'Elena' },
  ];

  private readonly pointsByPlayer = new Map<string, number>([
    ['you', 8],
    ['ana', 12],
    ['bruno', 9],
    ['carla', 6],
    ['diego', 10],
    ['elena', 7],
  ]);

  private votesIntervalId: ReturnType<typeof setInterval> | null = null;
  private revealTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentRoundPlayers: RoundPlayer[] = [];

  id = 0;
  phase: DixitPhase = 'hand';
  cards: DeckCard[] = [];
  choiceCards: DeckCard[] = [];
  loading = true;
  errorMessage = '';
  selectedHandCardCode = '';
  selectedChoiceCardCode = '';

  pointsWaitingVotes = true;
  pointsVotesReceived = 0;
  pointsVotesTotal = 0;
  pointsRevealedCards: DixitRevealedCard[] = [];
  pointsRanking: DixitRankingRow[] = [];
  pointsShowRanking = false;

  constructor(
    private router: Router,
    private cardPull: CardPull,
    private cdr: ChangeDetectorRef
  ) {
    const urlSegments = this.router.url.split('/');
    this.id = Number(urlSegments[urlSegments.length - 1]);
  }

  async ngOnInit(): Promise<void> {
    try {
      console.log('[Dixit] Cargando mano...');
      this.cards = await this.cardPull.getCards(this.maxPlayersPerMatch);
      this.choiceCards = [...this.cards];
      console.log('[Dixit] Mano cargada:', this.cards.length);
    } catch (error) {
      console.error('Error al cargar las cartas:', error);
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudieron cargar las cartas';
      this.cards = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.clearPointsTimers();
  }

  setPhase(phase: DixitPhase): void {
    this.phase = phase;
  }

  onHandCardSelected(card: DeckCard): void {
    this.selectedHandCardCode = card.code;
  }

  onChoiceConfirmed(card: DeckCard): void {
    this.selectedChoiceCardCode = card.code;
    this.startPointsPhase();
    console.log('[Dixit] Carta confirmada:', card.code);
  }

  onPointsRankingRequested(): void {
    this.pointsShowRanking = true;
    if (this.revealTimeoutId) {
      clearTimeout(this.revealTimeoutId);
      this.revealTimeoutId = null;
    }
  }

  onPointsSkipWaitingRequested(): void {
    if (!this.pointsWaitingVotes) {
      return;
    }

    if (this.currentRoundPlayers.length === 0) {
      this.currentRoundPlayers = this.getRoundPlayers();
      this.pointsVotesTotal = this.currentRoundPlayers.length;
    }

    this.pointsVotesReceived = this.pointsVotesTotal;
    this.clearVoteInterval();
    this.finishVotingAndBuildResults(this.currentRoundPlayers);
  }

  private startPointsPhase(): void {
    this.clearPointsTimers();
    this.phase = 'points';
    this.pointsWaitingVotes = true;
    this.pointsShowRanking = false;
    this.pointsRevealedCards = [];
    this.pointsRanking = [];

    this.currentRoundPlayers = this.getRoundPlayers();
    this.pointsVotesTotal = this.currentRoundPlayers.length;
    this.pointsVotesReceived = this.currentRoundPlayers.length > 0 ? 1 : 0;

    if (this.pointsVotesReceived >= this.pointsVotesTotal) {
      this.finishVotingAndBuildResults(this.currentRoundPlayers);
      return;
    }

    this.votesIntervalId = setInterval(() => {
      this.pointsVotesReceived += 1;
      if (this.pointsVotesReceived >= this.pointsVotesTotal) {
        this.clearVoteInterval();
        this.finishVotingAndBuildResults(this.currentRoundPlayers);
      }
    }, 900);
  }

  private finishVotingAndBuildResults(roundPlayers: RoundPlayer[]): void {
    const { revealedCards, ranking } = this.buildRevealAndRanking(roundPlayers);
    this.pointsRevealedCards = revealedCards;
    this.pointsRanking = ranking;
    this.pointsWaitingVotes = false;
    this.pointsShowRanking = false;

    this.revealTimeoutId = setTimeout(() => {
      this.pointsShowRanking = true;
      this.revealTimeoutId = null;
    }, 2800);
  }

  private getRoundPlayers(): RoundPlayer[] {
    const totalPlayers = Math.min(this.choiceCards.length, this.playerRoster.length);

    return this.playerRoster.slice(0, totalPlayers).map((player) => ({
      id: player.id,
      name: player.name,
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

    for (const row of ranking) {
      this.pointsByPlayer.set(row.playerId, row.totalPoints);
    }

    return { revealedCards, ranking };
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

  private clearVoteInterval(): void {
    if (this.votesIntervalId) {
      clearInterval(this.votesIntervalId);
      this.votesIntervalId = null;
    }
  }

  private clearPointsTimers(): void {
    this.clearVoteInterval();

    if (this.revealTimeoutId) {
      clearTimeout(this.revealTimeoutId);
      this.revealTimeoutId = null;
    }
  }
}
