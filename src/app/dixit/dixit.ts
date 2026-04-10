import {
  ChangeDetectorRef,
  Component,
  Injector,
  OnDestroy,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  RealtimeGameStateUpdate,
  RealtimeLobbyState,
} from '../interfaces/dixit-realtime';
import { Auth } from '../services/auth';
import { CardPull } from '../services/card-pull';
import type { DeckCard } from '../services/card-pull';
import { DixitRealtime } from '../services/dixit-realtime';
import type { TrackBoardToken } from './components/track-board';
import { DixitChoicePhase } from './phases/choice-phase';
import { DixitHandPhase } from './phases/hand-phase';
import { DixitPointsPhase } from './phases/points-phase';
import type { DixitRankingRow, DixitRevealedCard } from './phases/points-phase';
import {
  EVENT_BACK_CELL_POSITIONS,
  EVENT_FORWARD_CELL_POSITIONS,
  PHASE_STEPS,
  WILDCARD_CELL_POSITIONS,
  WILDCARD_REWARDS,
  type BoardEffectPopup,
  type DixitPhase,
  type PhaseStep,
  type PointsStage,
  type RosterPlayer,
  type RoundPlayer,
} from './dixit.constants';
import type { DixitChatComposer, DixitPlayerRow, DixitWildcardReward } from './dixit-phase.models';
import { DixitMinijuego1 } from './minijuegos/minijuego-1';
import { DixitMinijuego2 } from './minijuegos/minijuego-2/minijuego-2';
import {
  buildRevealAndRanking,
  getRoundPlayers,
  resolveCurrentPlayerSpecialCells,
} from './dixit.logic';

interface ResolvedPhaseState {
  phase: DixitPhase;
  pointsStage: PointsStage;
}

const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';
const DEFAULT_PLAYER_COLORS = ['#ff7725', '#27c93f', '#2b79ff', '#d645ff', '#ff3a3a', '#ffd166'] as const;

@Component({
  selector: 'app-dixit',
  standalone: true,
  imports: [DixitHandPhase, DixitChoicePhase, DixitPointsPhase, DixitMinijuego1, DixitMinijuego2],
  template: `
    <section class="dixit-table">
      <nav class="dixit-topbar" aria-label="Barra de partida">
        <button type="button" class="topbar-button small" (click)="goHome()">Home</button>

        <div class="phase-banner">
          <p class="eyebrow">Sala {{ id || 'demo' }}</p>
          <div class="phase-current">
            <span class="phase-chip">{{ currentPhaseMeta.title }}</span>
            <p>{{ currentPhaseInstruction }}</p>
            <p class="storyteller-debug">{{ storytellerStatusText }}</p>
          </div>
          <span class="status-pill">{{ connectionStatusLabel }}</span>
        </div>

        <div class="topbar-actions">
          <button type="button" class="topbar-button" (click)="goToProfile()">Perfil</button>
          <button type="button" class="topbar-button" (click)="goToSettings()">Ajustes</button>
        </div>
      </nav>

      @if (loading) {
        <article class="status-card">
          <p>Conectando con la mesa...</p>
        </article>
      } @else if (errorMessage) {
        <article class="status-card error">
          <p>{{ errorMessage }}</p>
        </article>
      } @else if (cards.length === 0) {
        <article class="status-card">
          <p>Esperando a que el servidor envie tu mano.</p>
        </article>
      } @else {
        <div class="table-main">
          @if (phase === 'choice') {
            <app-dixit-choice-phase
              [currentClue]="currentClue"
              [cards]="choiceCards"
              [selectedCardCode]="selectedChoiceCardCode"
              [voteSubmitted]="voteSubmitted"
              (cardSelected)="onChoiceCardSelected($event)"
              (voteSubmitRequested)="submitVoteSelection()"
            />
          } @else if (phase === 'points') {
            <app-dixit-points-phase
              [boardTokens]="boardTokens"
              [waitingVotes]="pointsStage === 'waiting'"
              [votesReceived]="pointsVotesReceived"
              [votesTotal]="pointsVotesTotal"
              [revealedCards]="pointsRevealedCards"
              [ranking]="pointsRanking"
              [showRanking]="pointsStage === 'ranking'"
              (skipWaitingRequested)="simulateResultsReveal()"
              (rankingRequested)="simulateRankingShown()"
              (nextRoundRequested)="prepareNextRound()"
            />
          } @else {
            <app-dixit-hand-phase
              [currentClue]="currentClue"
              [cards]="cards"
              [selectedCardCode]="selectedHandCardCode"
              [clueDraft]="clueDraft"
              [storytellerName]="currentStorytellerName"
              [isCurrentPlayerStoryteller]="isCurrentPlayerStoryteller"
              [handSubmitted]="handSubmitted"
              [isStorySubmitDisabled]="isStorySubmitDisabled"
              [isHandSubmitDisabled]="isHandSubmitDisabled"
              [handSubmitButtonText]="handSubmitButtonText"
              [wildcards]="wildcards"
              [players]="playerRows"
              [boardTokens]="boardTokens"
              [wildcardCells]="wildcardCellPositions"
              [eventBackCells]="eventBackCellPositions"
              [eventForwardCells]="eventForwardCellPositions"
              [chat]="handChatComposer"
              (cardSelected)="onHandCardSelected($event)"
              (clearSelectionRequested)="clearHandSelection()"
              (storySubmitRequested)="submitStoryClue()"
              (handSubmitRequested)="submitHandSelection()"
              (clueDraftChanged)="updateClueDraft($event)"
              (wildcardUsed)="useWildcard($event)"
              (chatDraftChanged)="updateChatDraft($event)"
              (chatSubmitRequested)="submitChatMessage()"
            />
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
          {{ isSimulationDrawerOpen ? 'Cerrar' : 'Estado' }}
        </button>

        <aside class="sim-drawer" [class.open]="isSimulationDrawerOpen">
          <article class="sim-card">
            <p class="overlay-label">Estado realtime</p>
            <h3>Socket</h3>

            <p>Conexion: {{ connectionStatusLabel }}</p>
            <p>Ultima accion: {{ lastRealtimeAction || 'Sin eventos todavia' }}</p>
            <p>Cuenta-cuentos: {{ currentStorytellerName || 'No resuelto todavia' }}</p>
            <p>Storyteller ID: {{ currentStorytellerId || 'No presente en state.currentRound' }}</p>
            <p>Claves state: {{ stateDebugKeysText }}</p>
            <p>Claves currentRound: {{ currentRoundDebugKeysText }}</p>
            <p>Pista actual: {{ currentClue || 'Esperando pista' }}</p>

            @if (chatPreview.length > 0) {
              <div class="chat-preview">
                @for (message of chatPreview; track message.timestamp + message.username) {
                  <p><strong>{{ message.username }}:</strong> {{ message.text }}</p>
                }
              </div>
            } @else {
              <p>No hay mensajes de chat recibidos.</p>
            }

            @if (gameEnded) {
              <p>La partida se ha marcado como finalizada en el servidor.</p>
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

    @if (isMinigame1Open) {
      <app-dixit-minijuego-1 (close)="closeMinigame1()" />
    }

    @if (isMinigame2Open) {
      <app-dixit-minijuego-2 (close)="closeMinigame2()" />
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
  private readonly auth = inject(Auth);
  private readonly cardPull = inject(CardPull);
  private readonly realtime = inject(DixitRealtime);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private readonly maxPlayersPerMatch = 6;
  private playerRoster: RosterPlayer[] = [];
  private readonly pointsByPlayer = new Map<string, number>();

  private currentRoundPlayers: RoundPlayer[] = [];

  id = '';
  phase: DixitPhase = 'hand';
  pointsStage: PointsStage = 'waiting';
  roundNumber = 1;
  cards: DeckCard[] = [];
  choiceCards: DeckCard[] = [];
  boardTokens: TrackBoardToken[] = [];
  loading = true;
  errorMessage = '';
  selectedHandCardCode = '';
  selectedChoiceCardCode = '';
  handSubmitted = false;
  voteSubmitted = false;
  clueDraft = '';
  chatDraft = '';
  currentClue = '';
  lastRealtimeAction = '';
  gameEnded = false;
  storySubmitted = false;

  pointsVotesReceived = 0;
  pointsVotesTotal = 0;
  pointsRevealedCards: DixitRevealedCard[] = [];
  pointsRanking: DixitRankingRow[] = [];
  wildcards: DixitWildcardReward[] = [];
  activeEffectPopup: BoardEffectPopup | null = null;
  isSimulationDrawerOpen = false;
  isMinigame1Open = false;
  isMinigame2Open = false;
  private readonly effectPopupQueue: BoardEffectPopup[] = [];
  private revealRankingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingBoardTokens: TrackBoardToken[] | null = null;

  constructor() {
    this.bootstrapFallbackRoster();

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

        if (!this.currentClue.trim()) {
          this.storySubmitted = false;
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

    try {
      await this.realtime.ensureLobbyConnection(this.id);
      const currentLobbyState = this.realtime.lobbyState();
      if (currentLobbyState?.code === this.id) {
        this.applyRealtimeLobbyState(currentLobbyState);
      }

      const currentGameState = this.realtime.gameState();
      if (currentGameState && this.realtime.activeLobbyCode() === this.id) {
        this.applyRealtimeGameState(currentGameState);
      }

      if (this.cards.length === 0) {
        this.cards = await this.cardPull.getCards(this.maxPlayersPerMatch);
      }
      if (this.choiceCards.length === 0) {
        this.choiceCards = [...this.cards];
      }
      this.boardTokens = this.buildBoardTokensFromScores();
      this.errorMessage = '';
    } catch (error: unknown) {
      console.error('Error al cargar las cartas:', error);
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo conectar la mesa';
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
      if (!this.currentClue.trim()) {
        return this.isCurrentPlayerStoryteller
          ? 'Confirma la pista para abrir la ronda.'
          : 'Esperando a que el cuenta-cuentos publique la pista.';
      }

      return this.isCurrentPlayerStoryteller
        ? 'La pista ya esta publicada. Esperando a que el resto envie su carta.'
        : 'La pista ya esta visible. Elige y envia tu carta.';
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

  get connectionStatusLabel(): string {
    switch (this.realtime.connectionStatus()) {
      case 'joining':
        return 'Solicitando acceso';
      case 'connecting':
        return 'Conectando';
      case 'connected':
        return 'Conectado';
      case 'disconnected':
        return 'Desconectado';
      case 'error':
        return 'Error realtime';
      default:
        return 'Pendiente';
    }
  }

  get currentUserId(): string {
    return this.auth.session()?.user.id ?? '';
  }

  private get localCurrentPlayerId(): string {
    return this.currentUserId || 'local-player';
  }

  get isCurrentPlayerStoryteller(): boolean {
    return !!this.currentStorytellerId && this.currentStorytellerId === this.currentUserId;
  }

  get currentStorytellerId(): string {
    return this.resolveStorytellerId(this.realtime.gameState()?.state ?? {});
  }

  get currentStorytellerName(): string {
    if (!this.currentStorytellerId) {
      return '';
    }

    return (
      this.playerRoster.find((player) => player.id === this.currentStorytellerId)?.name ??
      this.currentStorytellerId
    );
  }

  get storytellerStatusText(): string {
    if (!this.currentStorytellerId) {
      return 'Cuenta-cuentos sin resolver en el state realtime.';
    }

    if (this.isCurrentPlayerStoryteller) {
      return `Eres el cuenta-cuentos de esta ronda.`;
    }

    return `Cuenta-cuentos actual: ${this.currentStorytellerName}.`;
  }

  get stateDebugKeysText(): string {
    const state = this.realtime.gameState()?.state ?? {};
    const keys = Object.keys(state);
    return keys.length > 0 ? keys.join(', ') : 'sin claves';
  }

  get currentRoundDebugKeysText(): string {
    const currentRoundState = this.resolveCurrentRoundState(this.realtime.gameState()?.state ?? {});
    const keys = Object.keys(currentRoundState);
    return keys.length > 0 ? keys.join(', ') : 'sin claves';
  }

  get isStorySubmitDisabled(): boolean {
    return (
      !this.isCurrentPlayerStoryteller ||
      this.realtime.connectionStatus() !== 'connected' ||
      this.storySubmitted ||
      !this.selectedHandCardCode ||
      !!this.currentClue.trim() ||
      !this.clueDraft.trim()
    );
  }

  get isHandSubmitDisabled(): boolean {
    if (this.isCurrentPlayerStoryteller) {
      return true;
    }

    if (!this.selectedHandCardCode || this.handSubmitted || this.realtime.connectionStatus() !== 'connected') {
      return true;
    }

    return !this.currentClue.trim();
  }

  get handSubmitButtonText(): string {
    return 'Jugar carta';
  }

  get chatPreview() {
    return this.realtime.chatMessages().slice(-4);
  }

  get handChatComposer(): DixitChatComposer {
    return {
      draft: this.chatDraft,
      canSend: this.realtime.connectionStatus() === 'connected' && this.chatDraft.trim().length > 0,
      messages: this.realtime.chatMessages().slice(-20),
    };
  }

  get playerRows(): DixitPlayerRow[] {
    return this.playerRoster.map((player) => ({
      ...player,
      points: this.pointsByPlayer.get(player.id) ?? 0,
      isCurrentPlayer: player.id === this.currentUserId,
    }));
  }

  private bootstrapFallbackRoster(): void {
    const fallbackPlayers: RosterPlayer[] = [
      {
        id: this.localCurrentPlayerId,
        name: this.auth.username() || 'Tu',
        color: DEFAULT_PLAYER_COLORS[0],
      },
      {
        id: 'cpu-1',
        name: 'Jugador 2',
        color: DEFAULT_PLAYER_COLORS[1],
      },
      {
        id: 'cpu-2',
        name: 'Jugador 3',
        color: DEFAULT_PLAYER_COLORS[2],
      },
    ];

    this.playerRoster = fallbackPlayers;
    for (const player of fallbackPlayers) {
      if (!this.pointsByPlayer.has(player.id)) {
        this.pointsByPlayer.set(player.id, 0);
      }
    }

    this.boardTokens = this.buildBoardTokensFromScores();
  }

  private applyRealtimeLobbyState(lobbyState: RealtimeLobbyState): void {
    const nextRoster = lobbyState.players.map((player, index) => ({
      id: player.id,
      name: player.username,
      color: DEFAULT_PLAYER_COLORS[index % DEFAULT_PLAYER_COLORS.length],
    }));

    if (nextRoster.length > 0) {
      this.playerRoster = nextRoster;
    }

    for (const player of nextRoster) {
      if (!this.pointsByPlayer.has(player.id)) {
        this.pointsByPlayer.set(player.id, 0);
      }
    }

    this.boardTokens = this.buildBoardTokensFromScores();
  }

  private applyRealtimeGameState(update: RealtimeGameStateUpdate): void {
    const state = update.state;
    const currentRoundState = this.resolveCurrentRoundState(state);
    const resolvedPhaseState = this.resolveRealtimePhase(state, update.lastAction);

    this.phase = resolvedPhaseState.phase;
    this.pointsStage = resolvedPhaseState.pointsStage;
    this.roundNumber = this.readNumber(state, [
      'roundNumber',
      'round',
      'currentRound',
    ]) ?? this.roundNumber;
    this.currentClue =
      this.readStringFromCandidates(currentRoundState, ['currentClue', 'clue', 'story', 'hint']) ??
      this.readStringFromCandidates(state, ['currentClue', 'clue', 'story', 'hint']) ??
      '';
    this.storySubmitted = !!this.currentClue.trim();
    if (this.storySubmitted) {
      this.clueDraft = this.currentClue;
    }
    this.lastRealtimeAction = update.lastAction ?? this.lastRealtimeAction;
    this.gameEnded = (update.lastAction ?? '').toUpperCase().includes('ENDED');

    this.applyRealtimePlayers(state);
    this.applyRealtimeCards(state);
    this.applyRealtimeVotingState(state);
    this.applyRealtimePointsState(state);
    this.logStorytellerResolution(state, currentRoundState, update.lastAction);

    this.loading = false;
    this.errorMessage = '';
  }

  private logStorytellerResolution(
    state: Record<string, unknown>,
    currentRoundState: Record<string, unknown>,
    lastAction?: string
  ): void {
    const storytellerId = this.resolveStorytellerId(state);
    const storytellerName =
      this.playerRoster.find((player) => player.id === storytellerId)?.name ?? '';

    console.info('[Dixit] Storyteller resolution', {
      lobbyCode: this.id,
      lastAction: lastAction ?? null,
      storytellerId: storytellerId || null,
      storytellerName: storytellerName || null,
      currentUserId: this.currentUserId || null,
      isCurrentPlayerStoryteller: storytellerId === this.currentUserId,
      stateKeys: Object.keys(state),
      currentRoundKeys: Object.keys(currentRoundState),
      currentRound: currentRoundState,
      currentClue: this.currentClue || null,
    });
  }

  private applyRealtimePlayers(state: Record<string, unknown>): void {
    const playerEntries = this.readArrayFromCandidates(state, ['players', 'participants']);
    if (!playerEntries.length) {
      this.boardTokens = this.buildBoardTokensFromScores();
      return;
    }

    const resolvedRoster: RosterPlayer[] = [];
    for (let index = 0; index < playerEntries.length; index += 1) {
      const entry = asRecord(playerEntries[index]);
      if (!entry) {
        continue;
      }

      const playerId =
        this.readStringFromCandidates(entry, ['id', 'playerId', 'userId']) ?? `player-${index + 1}`;
      const playerName =
        this.readStringFromCandidates(entry, ['username', 'name']) ?? playerId;

      resolvedRoster.push({
        id: playerId,
        name: playerName,
        color: DEFAULT_PLAYER_COLORS[index % DEFAULT_PLAYER_COLORS.length],
      });

      const score =
        this.readNumber(entry, ['score', 'points', 'totalPoints']) ??
        this.readNumber(asRecord(entry['stats']) ?? {}, ['score', 'points', 'totalPoints']);

      this.pointsByPlayer.set(playerId, score ?? this.pointsByPlayer.get(playerId) ?? 0);
    }

    if (resolvedRoster.length > 0) {
      this.playerRoster = resolvedRoster;
    }

    this.boardTokens = this.buildBoardTokensFromScores();
  }

  private applyRealtimeCards(state: Record<string, unknown>): void {
    const currentPlayerState = this.resolveCurrentPlayerState(state);
    const handCards = this.normalizeCards(
      this.readArrayFromCandidates(currentPlayerState, ['hand', 'cards'])
    );
    if (handCards.length > 0) {
      this.cards = handCards;
    }

    const choiceCards = this.normalizeCards(
      this.readArrayFromCandidates(state, [
        'choiceCards',
        'voteOptions',
        'submittedCards',
        'tableCards',
        'cardsToVote',
      ])
    );
    this.choiceCards = choiceCards.length > 0 ? choiceCards : [...this.cards];

    const selectedHandCardCode =
      this.readStringFromCandidates(currentPlayerState, [
        'submittedCardCode',
        'selectedCardCode',
        'playedCardCode',
      ]) ??
      this.readStringFromCandidates(asRecord(currentPlayerState['selectedCard']) ?? {}, [
        'code',
        'id',
        'cardId',
      ]);

    if (selectedHandCardCode) {
      this.selectedHandCardCode = selectedHandCardCode;
      this.handSubmitted = true;
    } else if (this.phase === 'hand') {
      this.handSubmitted = false;
    }
  }

  private applyRealtimeVotingState(state: Record<string, unknown>): void {
    const currentPlayerState = this.resolveCurrentPlayerState(state);
    const selectedVoteCode =
      this.readStringFromCandidates(currentPlayerState, ['voteCardCode', 'selectedVoteCardCode']) ??
      this.readStringFromCandidates(asRecord(currentPlayerState['vote']) ?? {}, ['code', 'cardId', 'id']);

    if (selectedVoteCode) {
      this.selectedChoiceCardCode = selectedVoteCode;
      this.voteSubmitted = true;
    } else if (this.phase === 'choice') {
      this.voteSubmitted = false;
    }
  }

  private applyRealtimePointsState(state: Record<string, unknown>): void {
    this.pointsVotesReceived =
      this.readNumber(state, ['votesReceived', 'receivedVotes', 'voteCount']) ??
      this.pointsVotesReceived;
    this.pointsVotesTotal =
      this.readNumber(state, ['votesTotal', 'expectedVotes', 'playerCount']) ??
      Math.max(this.playerRoster.length - 1, 0);

    const revealedCards = this.normalizeRevealedCards(
      this.readArrayFromCandidates(state, ['revealedCards', 'results', 'roundResults'])
    );
    if (revealedCards.length > 0) {
      this.pointsRevealedCards = revealedCards;
    }

    const ranking = this.normalizeRanking(
      this.readArrayFromCandidates(state, ['ranking', 'scoreboard', 'scores'])
    );
    if (ranking.length > 0) {
      this.pointsRanking = ranking;
      for (const row of ranking) {
        this.pointsByPlayer.set(row.playerId, row.totalPoints);
      }
      this.boardTokens = this.buildBoardTokensFromScores();
    }
  }

  private resolveRealtimePhase(
    state: Record<string, unknown>,
    lastAction?: string
  ): ResolvedPhaseState {
    const rawPhase =
      this.readStringFromCandidates(state, [
        'phase',
        'stage',
        'turnPhase',
        'currentPhase',
      ]) ??
      '';
    const normalizedPhase = rawPhase.toLowerCase();
    const normalizedAction = (lastAction ?? '').toLowerCase();

    if (
      normalizedPhase.includes('vote') ||
      normalizedPhase.includes('choice') ||
      normalizedAction.includes('vote')
    ) {
      return { phase: 'choice', pointsStage: 'waiting' };
    }

    if (
      normalizedPhase.includes('score') ||
      normalizedPhase.includes('point') ||
      normalizedPhase.includes('reveal') ||
      normalizedAction.includes('reveal') ||
      normalizedAction.includes('ranking')
    ) {
      if (normalizedPhase.includes('rank') || normalizedAction.includes('ranking')) {
        return { phase: 'points', pointsStage: 'ranking' };
      }

      if (normalizedPhase.includes('reveal') || normalizedAction.includes('reveal')) {
        return { phase: 'points', pointsStage: 'reveal' };
      }

      return { phase: 'points', pointsStage: 'waiting' };
    }

    return { phase: 'hand', pointsStage: 'waiting' };
  }

  private resolveCurrentPlayerState(state: Record<string, unknown>): Record<string, unknown> {
    const currentRoundState = this.resolveCurrentRoundState(state);
    const playerEntries = [
      ...this.readArrayFromCandidates(currentRoundState, ['players', 'participants']),
      ...this.readArrayFromCandidates(state, ['players', 'participants']),
    ];
    for (const entry of playerEntries) {
      const player = asRecord(entry);
      if (!player) {
        continue;
      }

      const playerId =
        this.readStringFromCandidates(player, ['id', 'playerId', 'userId']) ?? '';
      if (playerId === this.currentUserId) {
        return player;
      }
    }

    return {};
  }

  private resolveCurrentRoundState(state: Record<string, unknown>): Record<string, unknown> {
    return this.readRecordFromCandidates(state, ['currentRound']) ?? {};
  }

  private resolveStorytellerId(state: Record<string, unknown>): string {
    const currentRoundState = this.resolveCurrentRoundState(state);
    return (
      this.readStringFromCandidates(currentRoundState, [
        'storytellerId',
        'currentStorytellerId',
        'narratorId',
        'currentTurnPlayerId',
      ]) ??
      this.readStringFromCandidates(state, [
        'storytellerId',
        'currentStorytellerId',
        'narratorId',
        'currentTurnPlayerId',
      ]) ?? ''
    );
  }

  private normalizeCards(entries: unknown[]): DeckCard[] {
    return entries
      .map((entry, index) => this.normalizeCard(entry, index))
      .filter((entry): entry is DeckCard => entry !== null);
  }

  private normalizeCard(entry: unknown, index: number): DeckCard | null {
    if (typeof entry === 'string') {
      const code = entry.trim();
      if (!code) {
        return null;
      }

      return {
        code,
        image: DEFAULT_CARD_IMAGE,
        value: code,
        suit: 'DIXIT',
      };
    }

    const card = asRecord(entry);
    if (!card) {
      return null;
    }

    const code =
      this.readStringFromCandidates(card, ['code', 'cardId', 'id']) ?? `card-${index + 1}`;
    const image =
      this.readStringFromCandidates(card, ['image', 'imageUrl', 'url']) ?? DEFAULT_CARD_IMAGE;
    const value =
      this.readStringFromCandidates(card, ['title', 'name', 'value']) ?? code;
    const suit = this.readStringFromCandidates(card, ['suit', 'collection']) ?? 'DIXIT';

    return {
      code,
      image,
      value,
      suit,
    };
  }

  private normalizeRevealedCards(entries: unknown[]): DixitRevealedCard[] {
    return entries
      .map((entry, index) => {
        const result = asRecord(entry);
        if (!result) {
          return null;
        }

        const card =
          this.normalizeCard(result['card'], index) ??
          this.normalizeCard(result['cardData'], index) ??
          this.normalizeCard(result['cardCode'], index);
        if (!card) {
          return null;
        }

        return {
          card,
          ownerName:
            this.readStringFromCandidates(result, ['ownerName', 'username', 'playerName']) ??
            'Jugador',
          votes: this.readNumber(result, ['votes', 'voteCount']) ?? 0,
        };
      })
      .filter((entry): entry is DixitRevealedCard => entry !== null);
  }

  private normalizeRanking(entries: unknown[]): DixitRankingRow[] {
    return entries
      .map((entry, index) => {
        const row = asRecord(entry);
        if (!row) {
          return null;
        }

        const playerId =
          this.readStringFromCandidates(row, ['playerId', 'id', 'userId']) ?? `player-${index + 1}`;
        const totalPoints =
          this.readNumber(row, ['totalPoints', 'score', 'points']) ??
          this.pointsByPlayer.get(playerId) ??
          0;
        const pointsBefore = this.readNumber(row, ['pointsBefore', 'previousPoints']) ?? 0;
        const pointsEarned =
          this.readNumber(row, ['pointsEarned', 'earnedPoints']) ??
          Math.max(totalPoints - pointsBefore, 0);

        return {
          playerId,
          playerName:
            this.readStringFromCandidates(row, ['playerName', 'username', 'name']) ?? playerId,
          pointsBefore,
          pointsEarned,
          totalPoints,
        };
      })
      .filter((entry): entry is DixitRankingRow => entry !== null)
      .sort((left, right) => right.totalPoints - left.totalPoints);
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

  private readNumber(
    source: Record<string, unknown>,
    keys: readonly string[]
  ): number | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  }

  private readArrayFromCandidates(
    source: Record<string, unknown>,
    keys: readonly string[]
  ): unknown[] {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  private readRecordFromCandidates(
    source: Record<string, unknown>,
    keys: readonly string[]
  ): Record<string, unknown> | null {
    for (const key of keys) {
      const value = asRecord(source[key]);
      if (value) {
        return value;
      }
    }

    return null;
  }

  private resolveActionCardId(cardCode: string): number | string {
    return /^\d+$/.test(cardCode) ? Number(cardCode) : cardCode;
  }

  onHandCardSelected(card: DeckCard): void {
    this.selectedHandCardCode = card.code;
  }

  clearHandSelection(): void {
    this.selectedHandCardCode = '';
    this.handSubmitted = false;
  }

  updateClueDraft(nextClue: string): void {
    this.clueDraft = nextClue;
  }

  submitStoryClue(): void {
    if (this.isStorySubmitDisabled) {
      return;
    }

    const clue = this.clueDraft.trim();
    const cardId = this.resolveActionCardId(this.selectedHandCardCode);
    try {
      this.realtime.sendGameAction('SEND_STORY', {
        cardId,
        clue,
      });
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo enviar la pista';
      return;
    }

    this.storySubmitted = true;
    this.handSubmitted = true;
    this.errorMessage = '';
  }

  updateChatDraft(nextDraft: string): void {
    this.chatDraft = nextDraft;
  }

  submitChatMessage(): void {
    if (this.realtime.connectionStatus() !== 'connected' || !this.chatDraft.trim()) {
      return;
    }

    try {
      this.realtime.sendChat(this.chatDraft);
      this.chatDraft = '';
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo enviar el mensaje';
    }
  }

  submitHandSelection(): void {
    if (this.isHandSubmitDisabled || !this.selectedHandCardCode) {
      return;
    }

    const cardId = this.resolveActionCardId(this.selectedHandCardCode);
    const payload: Record<string, unknown> = {
      cardCode: this.selectedHandCardCode,
      cardId,
    };

    try {
      this.realtime.sendGameAction('PLAY_CARD', payload);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo enviar la jugada';
      return;
    }

    this.handSubmitted = true;
    this.errorMessage = '';
  }

  goHome(): void {
    void this.router.navigate(['/games']);
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

  openMinigame1(): void {
    this.isMinigame1Open = true;
    this.isMinigame2Open = false;
    this.closeSimulationDrawer();
  }

  closeMinigame1(): void {
    this.isMinigame1Open = false;
  }

  openMinigame2(): void {
    this.isMinigame2Open = true;
    this.isMinigame1Open = false;
    this.closeSimulationDrawer();
  }

  closeMinigame2(): void {
    this.isMinigame2Open = false;
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

    const cardId = this.resolveActionCardId(this.selectedChoiceCardCode);
    try {
      this.realtime.sendGameAction('VOTE_CARD', {
        cardCode: this.selectedChoiceCardCode,
        cardId,
      });
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo enviar el voto';
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
      this.selectedChoiceCardCode,
      this.localCurrentPlayerId
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
    this.voteSubmitted = false;
    this.handSubmitted = false;
    this.pointsVotesReceived = 0;
    this.pointsVotesTotal = 0;
    this.pointsRevealedCards = [];
    this.pointsRanking = [];
    this.currentRoundPlayers = [];
    this.pendingBoardTokens = null;
    this.currentClue = '';
    this.clueDraft = '';
    this.storySubmitted = false;
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

    const currentPoints = this.pointsByPlayer.get(this.localCurrentPlayerId) ?? 0;
    const updatedPoints = currentPoints + wildcard.points;

    this.pointsByPlayer.set(this.localCurrentPlayerId, updatedPoints);
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
    this.pointsByPlayer.set(this.localCurrentPlayerId, resolvedPoints);
    this.boardTokens = this.buildBoardTokensFromScores();
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
      voter?.id === this.localCurrentPlayerId &&
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
    const currentPlayerPreviousPoints =
      this.boardTokens.find((token) => token.id === this.localCurrentPlayerId)?.position ?? 0;
    const currentPlayerRow = ranking.find((row) => row.playerId === this.localCurrentPlayerId);

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

    this.pointsByPlayer.set(this.localCurrentPlayerId, resolvedPoints);
    currentPlayerRow.pointsEarned = resolvedPoints - currentPlayerRow.pointsBefore;
    currentPlayerRow.totalPoints = resolvedPoints;
    ranking.sort((left, right) => right.totalPoints - left.totalPoints);
  }

  private grantWildcardReward(): void {
    const template =
      WILDCARD_REWARDS[(this.wildcards.length + this.roundNumber - 1) % WILDCARD_REWARDS.length];
    const reward: DixitWildcardReward = {
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}
