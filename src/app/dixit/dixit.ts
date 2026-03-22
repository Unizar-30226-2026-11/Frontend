import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CardPull, DeckCard } from '../services/card-pull';
import { TrackBoardToken } from './components/track-board';
import { DixitChoicePhase } from './phases/choice-phase';
import { DixitHandPhase } from './phases/hand-phase';
import {
  DixitPointsPhase,
  DixitRankingRow,
  DixitRevealedCard,
} from './phases/points-phase';

type DixitPhase = 'hand' | 'choice' | 'points';

interface PhaseStep {
  id: DixitPhase;
  title: string;
  description: string;
  transitionTitle: string;
  transitionMessage: string;
}

interface PhaseTransitionConfig {
  title: string;
  message: string;
  beforeActivate?: (() => void) | null;
}

interface RosterPlayer {
  id: string;
  name: string;
  color: string;
}

interface RoundPlayer extends RosterPlayer {
  pointsBefore: number;
}

const PHASE_ORDER: readonly DixitPhase[] = ['hand', 'choice', 'points'];

const PHASE_STEPS: readonly PhaseStep[] = [
  {
    id: 'hand',
    title: 'Elegir carta',
    description: 'Selecciona la carta que enviaras en esta ronda.',
    transitionTitle: 'Preparando mano',
    transitionMessage: 'Sincronizando el arranque de la ronda con el backend.',
  },
  {
    id: 'choice',
    title: 'Votacion',
    description: 'Escoge una carta de la mesa y confirma tu voto.',
    transitionTitle: 'Preparando votacion',
    transitionMessage: 'Esperando la confirmacion del backend para mostrar la mesa final.',
  },
  {
    id: 'points',
    title: 'Puntuacion',
    description: 'Revela las cartas y actualiza el marcador de la partida.',
    transitionTitle: 'Resolviendo ronda',
    transitionMessage: 'Calculando votos y puntos antes de publicar el resultado.',
  },
];

@Component({
  selector: 'app-dixit',
  standalone: true,
  imports: [DixitHandPhase, DixitChoicePhase, DixitPointsPhase],
  template: `
    <section class="dixit-board">
      <header class="dixit-header">
        <div class="header-copy">
          <p class="eyebrow">Sala {{ id || 'demo' }}</p>
          <h1>Dixit</h1>
          <p class="phase-summary">{{ currentPhaseMeta.description }}</p>
        </div>

        @if (!loading && !errorMessage && cards.length > 0) {
          <div class="phase-switch" aria-label="Progreso de la ronda">
            @for (phaseStep of phaseSteps; track phaseStep.id) {
              <div
                class="phase-step"
                [class.active]="phase === phaseStep.id"
                [class.completed]="isPhaseCompleted(phaseStep.id)"
              >
                <span class="phase-index">{{ phaseOrderIndex(phaseStep.id) + 1 }}</span>
                <span>{{ phaseStep.title }}</span>
              </div>
            }
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
        <section class="phase-shell" [class.is-transitioning]="phaseTransitionActive">
          @if (phaseTransitionActive) {
            <div class="phase-overlay" aria-live="polite">
              <span class="overlay-kicker">Sincronizando partida</span>
              <strong>{{ phaseTransitionTitle }}</strong>
              <p>{{ phaseTransitionMessage }}</p>
            </div>
          }

          <article class="phase-info-card">
            <div>
              <span class="round-pill">Ronda {{ roundNumber }}</span>
              <h2>{{ currentPhaseMeta.title }}</h2>
              <p>{{ currentPhaseMeta.description }}</p>
            </div>

            @if (phase === 'hand') {
              <div class="info-actions">
                <p>
                  @if (selectedHandCardCode) {
                    Carta elegida: {{ selectedHandCardCode }}
                  } @else {
                    Elige una carta de tu mano para dejar lista la ronda.
                  }
                </p>
                <button
                  type="button"
                  class="phase-cta"
                  [disabled]="!selectedHandCardCode || phaseTransitionActive"
                  (click)="continueFromHandPhase()"
                >
                  Enviar carta
                </button>
              </div>
            } @else if (phase === 'choice') {
              <p class="phase-note">
                Esta fase ya queda preparada para que el backend la cierre con un evento de
                websocket en lugar del flujo local de demo.
              </p>
            } @else {
              <p class="phase-note">
                @if (pointsWaitingVotes) {
                  Recogiendo votos del resto de jugadores.
                } @else if (pointsShowRanking) {
                  Clasificacion actualizada. Ya puedes preparar la siguiente ronda.
                } @else {
                  Revelando cartas y calculando la puntuacion.
                }
              </p>
            }
          </article>

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
            } @else {
              <app-dixit-points-phase
                [boardTokens]="boardTokens"
                [waitingVotes]="pointsWaitingVotes"
                [votesReceived]="pointsVotesReceived"
                [votesTotal]="pointsVotesTotal"
                [revealedCards]="pointsRevealedCards"
                [ranking]="pointsRanking"
                [showRanking]="pointsShowRanking"
                (skipWaitingRequested)="onPointsSkipWaitingRequested()"
                (rankingRequested)="onPointsRankingRequested()"
                (nextRoundRequested)="prepareNextRound()"
              />
            }
          </div>
        </section>
      }
    </section>
  `,
  styles: `
    .dixit-board {
      min-height: 100svh;
      padding: 20px 12px 28px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-sizing: border-box;
    }

    .dixit-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .header-copy {
      max-width: 520px;
    }

    .eyebrow {
      margin: 0 0 6px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.72rem;
      opacity: 0.78;
    }

    h1 {
      margin: 0;
    }

    h2 {
      margin: 0 0 8px;
    }

    .phase-summary {
      margin: 10px 0 0;
      max-width: 54ch;
    }

    .phase-switch {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
    }

    .phase-step {
      min-width: 150px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(6px);
      transition:
        transform 180ms ease,
        background 180ms ease,
        border-color 180ms ease;
    }

    .phase-step.active {
      background: rgba(255, 243, 192, 0.22);
      border-color: rgba(255, 220, 121, 0.55);
      color: #fff5d1;
      transform: translateY(-2px);
    }

    .phase-step.completed {
      border-color: rgba(157, 228, 171, 0.45);
    }

    .phase-index {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.26);
      font-weight: 700;
    }

    .phase-shell {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
    }

    .phase-shell.is-transitioning .phase-info-card,
    .phase-shell.is-transitioning .phase-content {
      filter: blur(4px);
      transform: scale(0.99);
      pointer-events: none;
    }

    .phase-overlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      border-radius: 24px;
      background: rgba(8, 15, 28, 0.72);
      backdrop-filter: blur(12px);
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    }

    .overlay-kicker {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
      opacity: 0.8;
    }

    .phase-overlay strong {
      font-size: clamp(1.5rem, 2vw, 2rem);
    }

    .phase-overlay p {
      margin: 0;
      max-width: 46ch;
    }

    .phase-info-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      border-radius: 24px;
      padding: 18px 20px;
      background:
        radial-gradient(circle at top left, rgba(255, 221, 153, 0.2), rgba(0, 0, 0, 0) 34%),
        rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.18);
      transition:
        filter 180ms ease,
        transform 180ms ease;
    }

    .round-pill {
      display: inline-flex;
      margin-bottom: 10px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .info-actions {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      justify-content: flex-end;
      max-width: 420px;
    }

    .info-actions p,
    .phase-note {
      margin: 0;
      max-width: 42ch;
    }

    .phase-cta {
      border: 0;
      border-radius: 999px;
      padding: 11px 18px;
      font-weight: 700;
      cursor: pointer;
      color: #1d2430;
      background: linear-gradient(135deg, #f5d26d, #fff0ba);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.18);
    }

    .phase-cta:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none;
    }

    .phase-content {
      flex: 1;
      display: flex;
      min-height: 0;
      transition:
        filter 180ms ease,
        transform 180ms ease;
    }

    .choice-phase {
      width: 100%;
      height: auto;
      margin-bottom: 0;
    }

    @media (max-width: 960px) {
      .dixit-header,
      .phase-info-card {
        flex-direction: column;
      }

      .phase-switch,
      .info-actions {
        width: 100%;
        justify-content: flex-start;
      }
    }

    @media (max-width: 700px) {
      .dixit-board {
        padding-inline: 0;
      }

      .phase-step {
        min-width: 0;
        width: 100%;
      }
    }
  `,
})
export class Dixit implements OnInit, OnDestroy {
  readonly phaseSteps = PHASE_STEPS;
  readonly phaseTransitionDurationMs = 650;

  private readonly route = inject(ActivatedRoute);
  private readonly cardPull = inject(CardPull);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly maxPlayersPerMatch = 6;

  private readonly playerRoster: readonly RosterPlayer[] = [
    { id: 'you', name: 'Tu', color: '#ff7725' },
    { id: 'ana', name: 'Ana', color: '#27c93f' },
    { id: 'bruno', name: 'Bruno', color: '#2b79ff' },
    { id: 'carla', name: 'Carla', color: '#d645ff' },
    { id: 'diego', name: 'Diego', color: '#ff3a3a' },
    { id: 'elena', name: 'Elena', color: '#ffe34f' },
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
  private phaseTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentRoundPlayers: RoundPlayer[] = [];

  id = '';
  phase: DixitPhase = 'hand';
  roundNumber = 1;
  cards: DeckCard[] = [];
  choiceCards: DeckCard[] = [];
  boardTokens: TrackBoardToken[] = this.buildBoardTokensFromScores();
  loading = true;
  errorMessage = '';
  selectedHandCardCode = '';
  selectedChoiceCardCode = '';
  phaseTransitionActive = false;
  phaseTransitionTitle = '';
  phaseTransitionMessage = '';

  pointsWaitingVotes = true;
  pointsVotesReceived = 0;
  pointsVotesTotal = 0;
  pointsRevealedCards: DixitRevealedCard[] = [];
  pointsRanking: DixitRankingRow[] = [];
  pointsShowRanking = false;

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id')?.trim() ?? '';

    try {
      this.cards = await this.cardPull.getCards(this.maxPlayersPerMatch);
      this.choiceCards = [...this.cards];
      this.boardTokens = this.buildBoardTokensFromScores();
    } catch (error) {
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
    this.clearPointsTimers();
    this.clearPhaseTransitionTimer();
  }

  get currentPhaseMeta(): PhaseStep {
    return this.getPhaseMeta(this.phase);
  }

  phaseOrderIndex(phase: DixitPhase): number {
    return PHASE_ORDER.indexOf(phase);
  }

  isPhaseCompleted(phase: DixitPhase): boolean {
    return this.phaseOrderIndex(phase) < this.phaseOrderIndex(this.phase);
  }

  onHandCardSelected(card: DeckCard): void {
    this.selectedHandCardCode = card.code;
  }

  continueFromHandPhase(): void {
    if (!this.selectedHandCardCode || this.phaseTransitionActive) {
      return;
    }

    this.applyPhaseUpdate('choice', {
      title: 'Cartas enviadas',
      message:
        'La siguiente fase ya queda preparada para dispararse con la confirmacion real del backend.',
    });
  }

  onChoiceConfirmed(card: DeckCard): void {
    this.selectedChoiceCardCode = card.code;
    console.log('[Dixit] Carta confirmada:', card.code);

    this.applyPhaseUpdate('points', {
      title: 'Votos en curso',
      message:
        'Cuando lleguen los eventos de la sala, este paso podra sustituir el flujo local de demo.',
    });
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

  prepareNextRound(): void {
    if (
      this.phase !== 'points' ||
      this.pointsWaitingVotes ||
      !this.pointsShowRanking ||
      this.phaseTransitionActive
    ) {
      return;
    }

    this.startPhaseTransition('hand', {
      title: 'Preparando siguiente ronda',
      message:
        'Este reseteo local deja el punto exacto donde luego entraran los eventos y snapshots del backend.',
      beforeActivate: () => {
        this.resetForNextRound();
      },
    });
  }

  applyPhaseUpdate(
    nextPhase: DixitPhase,
    options: { immediate?: boolean; title?: string; message?: string } = {}
  ): void {
    // Punto unico para sustituir los timers locales por eventos o snapshots del backend.
    const phaseMeta = this.getPhaseMeta(nextPhase);
    const transitionConfig: PhaseTransitionConfig = {
      title: options.title ?? phaseMeta.transitionTitle,
      message: options.message ?? phaseMeta.transitionMessage,
    };

    if (options.immediate) {
      this.activatePhase(nextPhase);
      return;
    }

    this.startPhaseTransition(nextPhase, transitionConfig);
  }

  private startPhaseTransition(
    nextPhase: DixitPhase,
    config: PhaseTransitionConfig
  ): void {
    this.clearPhaseTransitionTimer();
    this.phaseTransitionActive = true;
    this.phaseTransitionTitle = config.title;
    this.phaseTransitionMessage = config.message;

    this.phaseTransitionTimeoutId = setTimeout(() => {
      config.beforeActivate?.();
      this.activatePhase(nextPhase);
      this.phaseTransitionActive = false;
      this.phaseTransitionTimeoutId = null;
      this.cdr.detectChanges();
    }, this.phaseTransitionDurationMs);
  }

  private activatePhase(nextPhase: DixitPhase): void {
    if (nextPhase === 'choice') {
      this.selectedChoiceCardCode = '';
    }

    if (nextPhase === 'points') {
      this.initializePointsPhase();
    }

    this.phase = nextPhase;
  }

  private initializePointsPhase(): void {
    this.clearPointsTimers();
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
    this.boardTokens = this.buildBoardTokensFromScores();

    this.revealTimeoutId = setTimeout(() => {
      this.pointsShowRanking = true;
      this.revealTimeoutId = null;
    }, 2800);
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

  private resetForNextRound(): void {
    this.clearPointsTimers();
    this.roundNumber += 1;
    this.selectedHandCardCode = '';
    this.selectedChoiceCardCode = '';
    this.currentRoundPlayers = [];
    this.pointsWaitingVotes = true;
    this.pointsVotesReceived = 0;
    this.pointsVotesTotal = 0;
    this.pointsRevealedCards = [];
    this.pointsRanking = [];
    this.pointsShowRanking = false;
    this.cards = this.rotateCards(this.cards);
    this.choiceCards = [...this.cards];
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

  private getPhaseMeta(phase: DixitPhase): PhaseStep {
    return PHASE_STEPS.find((phaseStep) => phaseStep.id === phase) ?? PHASE_STEPS[0];
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

  private clearPhaseTransitionTimer(): void {
    if (this.phaseTransitionTimeoutId) {
      clearTimeout(this.phaseTransitionTimeoutId);
      this.phaseTransitionTimeoutId = null;
    }
  }
}
