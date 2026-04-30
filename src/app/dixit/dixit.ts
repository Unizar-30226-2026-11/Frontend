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
  RealtimeDuelChallenge,
  RealtimeGameEnded,
  RealtimeGameStateUpdate,
  RealtimeLobbyState,
  RealtimeMinigameStart,
  RealtimeModeChangeOffer,
  RealtimePrivateHandEntry,
  RealtimeSpecialEvent,
  RealtimeStarClaim,
  RealtimeStarSpawn,
  RealtimeWalletUpdated,
} from '../interfaces/dixit-realtime';
import { Auth } from '../services/auth';
import { CardPull } from '../services/card-pull';
import type { DeckCard } from '../services/card-pull';
import { DixitRealtime } from '../services/dixit-realtime';
import { FallingStarOverlay } from './components/falling-star-overlay';
import type { TrackBoardToken } from './components/track-board';
import { DixitMinijuego1 } from './minijuegos/minijuego-1';
import { DixitMinijuego2 } from './minijuegos/minijuego-2/minijuego-2';
import { DixitMinijuego3 } from './minijuegos/minijuego-3/minijuego-3';
import { DixitChoicePhase } from './phases/choice-phase';
import { DixitHandPhase } from './phases/hand-phase';
import type { DixitRankingRow, DixitRevealedCard } from './phases/points-phase';
import { DixitPointsPhase } from './phases/points-phase';
import {
  DEFAULT_CARD_IMAGE,
  DEFAULT_PLAYER_COLORS,
  EVENT_BACK_CELL_POSITIONS,
  EVENT_FORWARD_CELL_POSITIONS,
  PHASE_STEPS,
  type BoardEffectPopup,
  type DixitPhase,
  type FinalRankingRow,
  type MinigameUiState,
  type PhaseStep,
  type PointsStage,
  type ResolvedPhaseState,
  type RosterPlayer,
  type RoundPlayer,
  type RoundVoteEntry,
  type SimulationTriggerMode,
} from './dixit.constants';
import {
  asRecord,
  buildBoardTokensFromScores,
  buildRevealAndRanking,
  getRoundPlayers,
  resolveCurrentPlayerSpecialCells,
  rotateCards,
} from './dixit.logic';
import type { DixitChatComposer, DixitPlayerRow } from './dixit-phase.models';
import {
  FinalResultsOverlay,
  type FinalResultsRankingRow as SharedFinalResultsRankingRow,
  type FinalResultsStat,
} from '../shared/final-results-overlay';

@Component({
  selector: 'app-dixit',
  standalone: true,
  imports: [
    FallingStarOverlay,
    DixitHandPhase,
    DixitChoicePhase,
    DixitPointsPhase,
    DixitMinijuego1,
    DixitMinijuego2,
    FinalResultsOverlay,
    DixitMinijuego3,
  ],
  templateUrl: './dixit.html',
  styleUrl: './dixit.css',
})
export class Dixit implements OnInit, OnDestroy {
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
  private ownedCards: DeckCard[] = [];
  private latestPrivateHand: RealtimePrivateHandEntry[] = [];
  private submittedHandRoundNumber: number | null = null;
  private readonly dynamicCardUrls = new Map<string, string>();

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
  currentPlayerPlayedCardCode = '';
  activeDuelChallenge: RealtimeDuelChallenge | null = null;
  activeMinigame: RealtimeMinigameStart | null = null;
  activeModeChangeOffer: RealtimeModeChangeOffer | null = null;
  activeStar: RealtimeStarSpawn | null = null;
  starWinnerLabel = '';
  finalRanking: FinalRankingRow[] = [];
  finalResultsError = '';
  finalWalletBalance: number | null = null;
  showFinalRanking = false;

  pointsVotesReceived = 0;
  pointsVotesTotal = 0;
  pointsRevealedCards: DixitRevealedCard[] = [];
  pointsRanking: DixitRankingRow[] = [];
  activeEffectPopup: BoardEffectPopup | null = null;
  isSimulationDrawerOpen = false;
  isMinigame1Open = false;
  isMinigame2Open = false;
  isMinigame3Open = false;
  minigameUiState: MinigameUiState = 'playing';
  minigameStatusMessage = '';
  simulationTriggerMode: SimulationTriggerMode = null;
  private readonly effectPopupQueue: BoardEffectPopup[] = [];
  private revealRankingTimer: ReturnType<typeof setTimeout> | null = null;
  private nextRoundTimer: ReturnType<typeof setTimeout> | null = null;
  private starWinnerTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingBoardTokens: TrackBoardToken[] | null = null;
  private nextRoundTimerRoundNumber: number | null = null;
  private lastAppliedGameStateReceivedAt = 0;
  private lastAppliedStarClaimReceivedAt = 0;
  private lastAppliedGameEndedReceivedAt = 0;
  private lastAppliedWalletUpdatedAt = 0;
  private gameEndRequested = false;
  private lastAppliedMinigameReceivedAt = 0;
  private minigameResultSent = false;
  private minigameResolutionTimer: ReturnType<typeof setTimeout> | null = null;
  private minigameUnavailableSubmitTimer: ReturnType<typeof setTimeout> | null = null;
  private modeChangeOfferTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAppliedModeChangeOfferAt = 0;
  modeChangeOfferSecondsLeft = 0;
  starClaimSequence = 0;

  constructor() {
    // Arrancamos con un roster local minimo para que la interfaz tenga datos
    // mientras se establece la conexion realtime de la sala.
    this.bootstrapFallbackRoster();

    effect(
      () => {
        // Sincroniza altas/bajas/cambios de la lobby recibidos por websocket
        // con el roster y los colores locales del tablero.
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
        // Este es el punto principal de entrada del estado público de partida
        // enviado por websocket o por recovered.
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
        // La mano privada llega por un evento separado del estado público.
        const privateHand = this.realtime.privateHand();
        if (!privateHand || privateHand.lobbyCode !== this.id) {
          return;
        }

        if (this.applyRealtimePrivateHand(privateHand.hand)) {
          this.cdr.detectChanges();
        }
      },
      { injector: this.injector }
    );

    effect(
      () => {
        // Propaga errores de socket/servidor a la capa visual sin bloquear
        // la reactividad del resto de eventos.
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

    effect(
      () => {
        // Abre el modal de duelo cuando el backend notifica que solo este usuario
        // puede resolverlo.
        const duelChallenge = this.realtime.duelChallenge();
        if (!duelChallenge || this.realtime.activeLobbyCode() !== this.id) {
          return;
        }

        this.activeDuelChallenge = duelChallenge;
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const activeLobbyCode = this.realtime.activeLobbyCode();
        const activeStar = this.realtime.activeStar();
        // La estrella es un efecto volátil de sala. Solo se pinta si corresponde
        // a la lobby activa que el componente está mostrando.
        if (activeLobbyCode !== this.id) {
          this.activeStar = null;
          this.cdr.detectChanges();
          return;
        }

        this.activeStar = activeStar;
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const activeLobbyCode = this.realtime.activeLobbyCode();
        const starClaim = this.realtime.starClaim();
        // starClaim se trata como un evento: se aplica una vez, se actualiza UI
        // y luego se limpia en el servicio para no repetir el efecto.
        if (!starClaim || activeLobbyCode !== this.id) {
          return;
        }

        this.applyRealtimeStarClaim(starClaim);
        this.realtime.clearStarClaim();
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const activeLobbyCode = this.realtime.activeLobbyCode();
        const minigame = this.realtime.minigameStart();
        if (!minigame || activeLobbyCode !== this.id) {
          return;
        }

        this.applyRealtimeMinigameStart(minigame);
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const activeLobbyCode = this.realtime.activeLobbyCode();
        const gameEnded = this.realtime.gameEndedResult();
        if (!gameEnded || activeLobbyCode !== this.id) {
          return;
        }

        this.applyRealtimeGameEnded(gameEnded);
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const activeLobbyCode = this.realtime.activeLobbyCode();
        const walletUpdated = this.realtime.walletUpdated();
        if (!walletUpdated || activeLobbyCode !== this.id) {
          return;
        }

        this.applyRealtimeWalletUpdated(walletUpdated);
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const activeLobbyCode = this.realtime.activeLobbyCode();
        const specialEvent = this.realtime.specialEvent();
        if (!specialEvent || activeLobbyCode !== this.id) {
          return;
        }

        this.applyRealtimeSpecialEvent(specialEvent);
        this.realtime.clearSpecialEvent();
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );

    effect(
      () => {
        const activeLobbyCode = this.realtime.activeLobbyCode();
        const modeChangeOffer = this.realtime.modeChangeOffer();
        if (!modeChangeOffer || activeLobbyCode !== this.id) {
          return;
        }

        this.applyRealtimeModeChangeOffer(modeChangeOffer);
        this.cdr.detectChanges();
      },
      { injector: this.injector }
    );
  }

  async ngOnInit(): Promise<void> {
    // Reconecta contra la lobby, reaplica cualquier estado websocket ya restaurado
    // y solo después carga el catálogo de cartas local usado para mapear ids a imágenes.
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

      const currentActiveStar = this.realtime.activeStar();
      if (currentActiveStar && this.realtime.activeLobbyCode() === this.id) {
        this.activeStar = currentActiveStar;
      }

      const currentGameEnded = this.realtime.gameEndedResult();
      if (currentGameEnded && this.realtime.activeLobbyCode() === this.id) {
        this.applyRealtimeGameEnded(currentGameEnded);
      }

      const currentMinigame = this.realtime.minigameStart();
      if (currentMinigame && this.realtime.activeLobbyCode() === this.id) {
        this.applyRealtimeMinigameStart(currentMinigame);
      }

      const currentSpecialEvent = this.realtime.specialEvent();
      if (currentSpecialEvent && this.realtime.activeLobbyCode() === this.id) {
        this.applyRealtimeSpecialEvent(currentSpecialEvent);
      }

      const currentModeChangeOffer = this.realtime.modeChangeOffer();
      if (currentModeChangeOffer && this.realtime.activeLobbyCode() === this.id) {
        this.applyRealtimeModeChangeOffer(currentModeChangeOffer);
      }

      const currentWalletUpdated = this.realtime.walletUpdated();
      if (currentWalletUpdated && this.realtime.activeLobbyCode() === this.id) {
        this.applyRealtimeWalletUpdated(currentWalletUpdated);
      }

      this.ownedCards = await this.cardPull.getCards(this.maxPlayersPerMatch);
      if (this.latestPrivateHand.length > 0) {
        this.applyRealtimePrivateHand(this.latestPrivateHand);
      } else if (this.cards.length === 0) {
        this.cards = [...this.ownedCards];
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
    this.clearNextRoundTimer();
    this.clearStarWinnerTimer();
    this.clearMinigameResolutionTimer();
    this.clearMinigameUnavailableSubmitTimer();
    this.clearModeChangeOfferTimer();
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
    if (this.phase === 'finished') {
      return 'La partida ha terminado. Revisa tu posicion final y tus monedas.';
    }

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
      if (this.isCurrentPlayerStoryteller) {
        return 'Eres el cuenta-cuentos. Espera a que el resto complete la votacion.';
      }

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

  get hasFinalRanking(): boolean {
    return this.finalRanking.length > 0;
  }

  get currentPlayerFinalResult(): FinalRankingRow | null {
    return this.finalRanking.find((entry) => entry.isCurrentPlayer) ?? null;
  }

  get finalOverlayTitle(): string {
    const result = this.currentPlayerFinalResult;
    if (!result) {
      return 'Resultados finales';
    }

    if (result.place === 1) {
      return 'Has ganado la partida';
    }

    return `Has terminado ${this.formatPlace(result.place)}`;
  }

  get finalOverlayStats(): FinalResultsStat[] {
    const result = this.currentPlayerFinalResult;
    if (!result) {
      return [];
    }

    return [
      {
        label: 'Puesto',
        value: this.formatPlace(result.place),
      },
      {
        label: 'Monedas ganadas',
        value: `+${result.coinsEarned}`,
      },
      {
        label: 'Puntos',
        value: String(result.points),
        muted: true,
      },
    ];
  }

  get sharedFinalRankingRows(): SharedFinalResultsRankingRow[] {
    return this.finalRanking.map((entry) => ({
      id: entry.playerId,
      title: entry.playerName,
      subtitle: `${entry.points} puntos`,
      sideValue: `+${entry.coinsEarned}`,
      placeLabel: this.formatPlace(entry.place),
      highlighted: entry.isCurrentPlayer,
    }));
  }

  get duelTargetPlayers(): DixitPlayerRow[] {
    return this.playerRows.filter((player) => !player.isCurrentPlayer);
  }

  get isCurrentPlayerHost(): boolean {
    const hostId = this.realtime.lobbyState()?.hostId ?? '';
    return !!hostId && hostId === this.currentUserId;
  }

  get canClaimActiveStar(): boolean {
    return !!this.activeStar && this.realtime.connectionStatus() === 'connected';
  }

  get isCurrentPlayerInActiveMinigame(): boolean {
    return !!this.activeMinigame && (
      this.activeMinigame.player1 === this.currentUserId ||
      this.activeMinigame.player2 === this.currentUserId
    );
  }

  get activeMinigameDurationMs(): number {
    return this.activeMinigame?.duration ?? 15_000;
  }

  get activeMinigameOpponentName(): string {
    if (!this.activeMinigame) {
      return 'Rival';
    }

    const opponentId =
      this.activeMinigame.player1 === this.currentUserId
        ? this.activeMinigame.player2
        : this.activeMinigame.player1;

    return this.resolvePlayerName(opponentId) || 'Rival';
  }

  get activeMinigamePlayerOneName(): string {
    return this.resolvePlayerName(this.activeMinigame?.player1 ?? '') || 'Jugador 1';
  }

  get activeMinigamePlayerTwoName(): string {
    return this.resolvePlayerName(this.activeMinigame?.player2 ?? '') || 'Jugador 2';
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
    ].join('|');
  }

  get isUnavailableMinigameType(): boolean {
    return this.activeMinigame !== null && this.resolveMinigameView(this.activeMinigame.type) === null;
  }

  get modeChangeTargetLabel(): string {
    if (!this.activeModeChangeOffer) {
      return 'otro modo';
    }

    return this.activeModeChangeOffer.targetMode === 'STELLA' ? 'Stella' : 'Standard';
  }

  // --- Sincronizacion base -------------------------------------------------
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
    // Convierte el roster realtime a la representación visual del tablero y
    // garantiza que cada jugador tenga entrada en el marcador local.
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

    if (this.finalRanking.length > 0) {
      this.finalRanking = this.finalRanking.map((entry) => ({
        ...entry,
        playerName: this.resolvePlayerName(entry.playerId),
      }));
    }

    this.boardTokens = this.buildBoardTokensFromScores();
  }

  private applyRealtimeGameState(update: RealtimeGameStateUpdate): void {
    // Aplica un snapshot público completo de partida. Aquí se resuelven fase,
    // pista, tablero, votos y puntuaciones a partir del state más reciente.
    if (update.receivedAt < this.lastAppliedGameStateReceivedAt) {
      return;
    }

    const state = update.state;
    const currentRoundState = this.resolveCurrentRoundState(state);
    const resolvedPhaseState = this.resolveRealtimePhase(state, update.lastAction);
    const previousPointsByPlayer = new Map(this.pointsByPlayer);
    const previousPhase = this.phase;
    const previousRoundNumber = this.roundNumber;
    const nextRoundNumber =
      this.readNumber(state, [
        'roundNumber',
        'round',
        'currentRound',
      ]) ?? this.roundNumber;

    if (nextRoundNumber !== this.roundNumber) {
      this.resetHandSubmissionState();
    }

    this.phase = resolvedPhaseState.phase;
    this.pointsStage = resolvedPhaseState.pointsStage;
    this.roundNumber = nextRoundNumber;
    this.lastAppliedGameStateReceivedAt = update.receivedAt;
    this.resetPhasePresentationState(previousPhase, previousRoundNumber);
    this.syncFinishedPresentationState();
    this.currentClue =
      this.readStringFromCandidates(currentRoundState, ['currentClue', 'clue', 'story', 'hint']) ??
      this.readStringFromCandidates(state, ['currentClue', 'clue', 'story', 'hint']) ??
      '';
    this.storySubmitted = !!this.currentClue.trim();
    if (this.storySubmitted) {
      this.clueDraft = this.currentClue;
    } else if (this.phase === 'hand') {
      this.resetHandSubmissionState();
      this.clueDraft = '';
    }
    this.lastRealtimeAction = update.lastAction ?? this.lastRealtimeAction;
    this.gameEnded = (update.lastAction ?? '').toUpperCase().includes('ENDED');

    this.applyRealtimePlayers(state);
    this.applyRealtimeScores(state);
    this.applyRealtimeCards(state);
    this.applyRealtimeVotingState(state);
    this.applyRealtimePointsState(state, currentRoundState, previousPointsByPlayer);
    this.logStorytellerResolution(state, currentRoundState, update.lastAction);
    this.syncRealtimePhaseTimers();
    this.syncModeChangeOfferVisibility();
    this.requestGameEndIfNeeded();

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

  private resetPhasePresentationState(
    previousPhase: DixitPhase,
    previousRoundNumber: number
  ): void {
    const roundChanged = previousRoundNumber !== this.roundNumber;
    const movedOutOfPoints = previousPhase === 'points' && this.phase !== 'points';

    if (!roundChanged && !movedOutOfPoints) {
      return;
    }

    this.clearRevealRankingTimer();
    this.clearNextRoundTimer();
    this.pointsVotesReceived = 0;
    this.pointsVotesTotal = 0;
    this.pointsRevealedCards = [];
    this.pointsRanking = [];
    this.currentRoundPlayers = [];
    this.pendingBoardTokens = null;
    this.selectedChoiceCardCode = '';
    this.voteSubmitted = false;
    this.currentPlayerPlayedCardCode = '';
  }

  private syncFinishedPresentationState(): void {
    if (this.phase === 'finished') {
      this.showFinalRanking = false;
      return;
    }

    this.gameEndRequested = false;
    this.finalRanking = [];
    this.finalResultsError = '';
    this.finalWalletBalance = null;
    this.showFinalRanking = false;
    this.lastAppliedGameEndedReceivedAt = 0;
    this.lastAppliedWalletUpdatedAt = 0;
    this.realtime.clearGameEndedResult();
  }

  private requestGameEndIfNeeded(): void {
    if (
      this.phase !== 'finished' ||
      this.gameEndRequested ||
      this.gameEnded ||
      this.realtime.connectionStatus() !== 'connected'
    ) {
      return;
    }

    try {
      this.realtime.endGame();
      this.gameEndRequested = true;
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo solicitar el cierre de la partida';
    }
  }

  get activeRealtimeLobbyCode(): string {
    return this.realtime.activeLobbyCode() || this.id;
  }

  // --- Normalizacion de payloads realtime ---------------------------------
  private applyRealtimePlayers(state: Record<string, unknown>): void {
    // Algunos payloads repiten datos de jugadores dentro del state público.
    // Si existen, se priorizan para mantener nombres/ids coherentes con backend.
    const shouldApplyRealtimeScores =
      this.phase !== 'points' || this.pointsStage === 'ranking';
    const playerEntries = this.readArrayFromCandidates(state, ['players', 'participants']);
    const existingRosterById = new Map(this.playerRoster.map((player) => [player.id, player]));
    const scoresRecord = asRecord(state['scores']);
    if (!playerEntries.length) {
      if (scoresRecord) {
        for (const [playerId, scoreValue] of Object.entries(scoresRecord)) {
          if (
            !playerId.trim() ||
            typeof scoreValue !== 'number' ||
            !Number.isFinite(scoreValue) ||
            this.pointsByPlayer.has(playerId)
          ) {
            continue;
          }

          this.pointsByPlayer.set(playerId, scoreValue);
        }
      }

      this.boardTokens = this.buildBoardTokensFromScores();
      return;
    }

    const resolvedRoster: RosterPlayer[] = [];
    for (let index = 0; index < playerEntries.length; index += 1) {
      const rawEntry = playerEntries[index];
      const entry = asRecord(rawEntry);
      const playerId =
        typeof rawEntry === 'string' && rawEntry.trim()
          ? rawEntry.trim()
          : this.readStringFromCandidates(entry ?? {}, ['id', 'playerId', 'userId']) ??
            `player-${index + 1}`;
      const existingPlayer = existingRosterById.get(playerId);
      const playerName =
        this.readStringFromCandidates(entry ?? {}, ['username', 'name']) ??
        existingPlayer?.name ??
        (playerId === this.currentUserId ? this.auth.username() || playerId : playerId);

      resolvedRoster.push({
        id: playerId,
        name: playerName,
        color: existingPlayer?.color ?? DEFAULT_PLAYER_COLORS[index % DEFAULT_PLAYER_COLORS.length],
      });

      const score =
        this.readNumber(entry ?? {}, ['score', 'points', 'totalPoints']) ??
        this.readNumber(asRecord(entry?.['stats']) ?? {}, ['score', 'points', 'totalPoints']) ??
        this.readNumber(scoresRecord ?? {}, [playerId]);

      if (shouldApplyRealtimeScores) {
        this.pointsByPlayer.set(playerId, score ?? this.pointsByPlayer.get(playerId) ?? 0);
      } else if (!this.pointsByPlayer.has(playerId)) {
        this.pointsByPlayer.set(playerId, score ?? 0);
      }
    }

    if (resolvedRoster.length > 0) {
      this.playerRoster = resolvedRoster;
    }

    this.boardTokens = this.buildBoardTokensFromScores();
  }

  private applyRealtimeScores(state: Record<string, unknown>): void {
    const scoresRecord = asRecord(state['scores']);
    if (!scoresRecord) {
      return;
    }

    let hasAnyScore = false;
    for (const [playerId, scoreValue] of Object.entries(scoresRecord)) {
      if (typeof scoreValue !== 'number' || !Number.isFinite(scoreValue)) {
        continue;
      }

      this.pointsByPlayer.set(playerId, scoreValue);
      hasAnyScore = true;
    }

    if (hasAnyScore) {
      this.boardTokens = this.buildBoardTokensFromScores();
    }
  }

  private applyRealtimeCards(state: Record<string, unknown>): void {
    // Mezcla varias fuentes websocket: mano pública/privada, boardCards y playedCards,
    // manteniendo las cartas conocidas para no perder la imagen asociada a cada id.
    const currentRoundState = this.resolveCurrentRoundState(state);
    this.syncDynamicCardUrls(state, currentRoundState);
    const currentPlayerState = this.resolveCurrentPlayerState(state);
    const handCards = this.normalizeCards(
      this.readArrayFromCandidates(currentPlayerState, ['hand', 'cards'])
    );
    if (handCards.length > 0) {
      const reconciledHandCards = this.reconcileCardList(handCards, this.cards);
      if (!this.areCardArraysIdentical(this.cards, reconciledHandCards)) {
        this.cards = reconciledHandCards;
      }
    }

    const detailedBoardCardEntries = this.readArrayFromCandidates(currentRoundState, [
      'boardCardsDetailed',
    ]);
    const boardCardEntries = detailedBoardCardEntries.length > 0
      ? detailedBoardCardEntries
      : this.readArrayFromCandidates(currentRoundState, ['boardCards']);
    const roundChoiceEntries = this.collectRoundChoiceEntries(currentRoundState);
    const fallbackChoiceEntries = this.readArrayFromCandidates(state, [
      'choiceCards',
      'voteOptions',
      'submittedCards',
      'tableCards',
      'cardsToVote',
    ]);
    const choiceCards = this.normalizeChoiceCards(
      boardCardEntries.length > 0
        ? boardCardEntries
        : roundChoiceEntries.length > 0
          ? roundChoiceEntries
          : fallbackChoiceEntries
    );
    const nextChoiceCards =
      choiceCards.length > 0
        ? this.reconcileCardList(choiceCards, this.choiceCards)
        : [...this.cards];
    if (!this.areCardArraysIdentical(this.choiceCards, nextChoiceCards)) {
      this.choiceCards = nextChoiceCards;
    }
    this.currentPlayerPlayedCardCode = this.resolveDisplayedChoiceCardCode(
      this.resolveCurrentPlayerPlayedCardCode(currentRoundState, currentPlayerState)
    );

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
      this.markHandSubmitted();
    } else if (this.phase === 'hand') {
      this.handSubmitted =
        this.submittedHandRoundNumber === this.roundNumber && !!this.selectedHandCardCode;
    }

    if (
      this.phase === 'choice' &&
      !this.voteSubmitted &&
      this.areEquivalentCardCodes(this.selectedChoiceCardCode, this.currentPlayerPlayedCardCode)
    ) {
      this.selectedChoiceCardCode = '';
    }

    if (
      this.phase === 'choice' &&
      this.selectedChoiceCardCode &&
      !this.choiceCards.some((card) => card.code === this.selectedChoiceCardCode)
    ) {
      this.selectedChoiceCardCode = '';
    }
  }

  private applyRealtimePrivateHand(hand: RealtimePrivateHandEntry[]): boolean {
    // Integra private_hand sin romper una selección previa si esa carta sigue existiendo.
    this.latestPrivateHand = [...hand];
    let handCards = this.buildPrivateHandCards(hand);
    if (this.handSubmitted && this.selectedHandCardCode) {
      handCards = handCards.filter((card) => card.code !== this.selectedHandCardCode);
    }
    if (handCards.length === 0) {
      return false;
    }

    // Esta comprobación se ejecuta cada vez que llega private_hand. Con un Set
    // evitamos el every+some anidado y dejamos la verificación en tiempo lineal.
    const handCodes = new Set(handCards.map((card) => card.code));
    const previousChoiceCardsWereHandCards =
      this.phase === 'hand' ||
      this.choiceCards.length === 0 ||
      this.choiceCards.every((card) => handCodes.has(card.code));

    const reconciledHandCards = this.reconcileCardList(handCards, this.cards);
    const cardsChanged = !this.areCardArraysIdentical(this.cards, reconciledHandCards);
    if (cardsChanged) {
      this.cards = reconciledHandCards;
    }

    let choiceCardsChanged = false;
    if (previousChoiceCardsWereHandCards) {
      const nextChoiceCards = cardsChanged ? [...this.cards] : this.choiceCards;
      choiceCardsChanged = !this.areCardArraysIdentical(this.choiceCards, nextChoiceCards);
      if (choiceCardsChanged) {
        this.choiceCards = nextChoiceCards;
      }
    }

    let selectionChanged = false;
    if (
      !this.handSubmitted &&
      this.selectedHandCardCode &&
      !this.cards.some((card) => card.code === this.selectedHandCardCode)
    ) {
      this.selectedHandCardCode = '';
      selectionChanged = true;
    }

    return cardsChanged || choiceCardsChanged || selectionChanged;
  }

  private applyRealtimeVotingState(state: Record<string, unknown>): void {
    // Reconstruye la selección/voto del jugador actual si el backend ya lo conoce,
    // por ejemplo tras un refresh y recovered.
    const currentRoundState = this.resolveCurrentRoundState(state);
    const currentPlayerState = this.resolveCurrentPlayerState(state);
    const selectedVoteCode =
      this.readStringFromCandidates(currentRoundState, ['selectedVoteCardId']) ??
      this.readStringFromCandidates(currentPlayerState, ['voteCardCode', 'selectedVoteCardCode']) ??
      this.readStringFromCandidates(asRecord(currentPlayerState['vote']) ?? {}, ['code', 'cardId', 'id']);

    if (selectedVoteCode) {
      this.selectedChoiceCardCode = this.resolveDisplayedChoiceCardCode(selectedVoteCode);
      this.voteSubmitted = true;
    }
  }

  private applyRealtimePointsState(
    state: Record<string, unknown>,
    currentRoundState: Record<string, unknown>,
    previousPointsByPlayer: Map<string, number>
  ): void {
    // Rehidrata la fase de scoring usando la verdad del backend: votos, reveal y scores.
    const ranking = this.normalizeRanking(
      this.readArrayFromCandidates(state, ['ranking', 'scoreboard'])
    );
    const scoresRanking =
      ranking.length > 0
        ? ranking
        : this.buildRankingFromScores(state, previousPointsByPlayer);

    if (this.phase !== 'points') {
      this.pointsVotesReceived = 0;
      this.pointsVotesTotal = 0;
      this.pointsRevealedCards = [];
      this.pointsRanking = [];

      if (scoresRanking.length > 0) {
        for (const row of scoresRanking) {
          this.pointsByPlayer.set(row.playerId, row.totalPoints);
        }
        this.boardTokens = this.buildBoardTokensFromScores();
      }

      return;
    }

    const roundVotes = this.normalizeRoundVotes(currentRoundState);
    this.pointsVotesReceived =
      roundVotes.length > 0
        ? roundVotes.length
        : this.readNumber(state, ['votesReceived', 'receivedVotes', 'voteCount']) ??
          this.pointsVotesReceived;
    this.pointsVotesTotal =
      this.readNumber(state, ['votesTotal', 'expectedVotes', 'playerCount']) ??
      Math.max(this.playerRoster.length - 1, 0);

    const revealedCards = this.normalizeRevealedCards(
      this.readArrayFromCandidates(state, ['revealedCards', 'results', 'roundResults'])
    );
    const roundRevealCards =
      revealedCards.length > 0
        ? revealedCards
        : this.buildRevealedCardsFromRound(currentRoundState, roundVotes);
    if (roundRevealCards.length > 0) {
      this.pointsRevealedCards = roundRevealCards;
    }
    if (scoresRanking.length > 0) {
      this.pointsRanking = scoresRanking;
      if (this.pointsStage === 'ranking') {
        for (const row of scoresRanking) {
          this.pointsByPlayer.set(row.playerId, row.totalPoints);
        }
        this.boardTokens = this.buildBoardTokensFromScores();
      }
    }
  }

  private buildRevealedCardsFromRound(
    currentRoundState: Record<string, unknown>,
    votes: RoundVoteEntry[]
  ): DixitRevealedCard[] {
    // Monta el tablero revelado directamente desde storytellerCardId, playedCards y votes
    // cuando el backend aún no manda una estructura de reveal más elaborada.
    const cardOwners = new Map<string, string>();
    const storytellerId = this.resolveStorytellerId({ currentRound: currentRoundState });
    const storytellerCardCode = this.normalizeDynamicCardCode(currentRoundState['storytellerCardId']);
    if (storytellerId && storytellerCardCode) {
      cardOwners.set(storytellerCardCode, storytellerId);
    }

    const playedCards = asRecord(currentRoundState['playedCards']) ?? {};
    for (const [playerId, cardValue] of Object.entries(playedCards)) {
      const cardCode = this.normalizeDynamicCardCode(cardValue);
      if (cardCode) {
        cardOwners.set(cardCode, playerId);
      }
    }

    if (cardOwners.size === 0) {
      return [];
    }

    const voteCounts = new Map<string, number>();
    for (const vote of votes) {
      voteCounts.set(vote.targetCardCode, (voteCounts.get(vote.targetCardCode) ?? 0) + 1);
    }

    return Array.from(cardOwners.entries()).map(([cardCode, ownerId], index) => ({
      card: this.normalizeChoiceCard(cardCode, index) ?? {
        code: cardCode,
        image: DEFAULT_CARD_IMAGE,
        value: cardCode,
        suit: 'DIXIT',
      },
      ownerName: this.playerRoster.find((player) => player.id === ownerId)?.name ?? ownerId,
      votes: voteCounts.get(cardCode) ?? 0,
    }));
  }

  private buildRankingFromScores(
    state: Record<string, unknown>,
    previousPointsByPlayer: Map<string, number>
  ): DixitRankingRow[] {
    // Calcula la tabla visible de scoring a partir de state.scores comparando
    // contra la fotografía de puntos previa a la ronda.
    const scoresRecord = asRecord(state['scores']);
    if (!scoresRecord) {
      return [];
    }

    return Object.entries(scoresRecord)
      .map(([playerId, totalPointsValue]) => {
        if (typeof totalPointsValue !== 'number' || !Number.isFinite(totalPointsValue)) {
          return null;
        }

        const totalPoints = totalPointsValue;
        const pointsBefore = previousPointsByPlayer.get(playerId) ?? 0;
        return {
          playerId,
          playerName: this.playerRoster.find((player) => player.id === playerId)?.name ?? playerId,
          pointsBefore,
          pointsEarned: totalPoints - pointsBefore,
          totalPoints,
        };
      })
      .filter((entry): entry is DixitRankingRow => entry !== null)
      .sort((left, right) => right.totalPoints - left.totalPoints);
  }

  private normalizeRoundVotes(currentRoundState: Record<string, unknown>): RoundVoteEntry[] {
    // Acepta varios alias de claves para los votos porque la forma exacta puede
    // variar entre modos o versiones del backend.
    return this.readArrayFromCandidates(currentRoundState, ['votes'])
      .map((entry) => {
        const vote = asRecord(entry);
        if (!vote) {
          return null;
        }

        const voterId = this.readStringFromCandidates(vote, ['voterId', 'playerId', 'userId']) ?? '';
        const targetCardCode =
          this.normalizeDynamicCardCode(vote['targetCardId']) ??
          this.normalizeDynamicCardCode(vote['cardId']) ??
          this.normalizeDynamicCardCode(vote['target']) ??
          '';

        if (!voterId || !targetCardCode) {
          return null;
        }

        return {
          voterId,
          targetCardCode,
        };
      })
      .filter((entry): entry is RoundVoteEntry => entry !== null);
  }

  private resolveRealtimePhase(
    state: Record<string, unknown>,
    lastAction?: string
  ): ResolvedPhaseState {
    // Prioriza state.phase cuando existe. lastAction queda como fallback para
    // soportar payloads heredados o incompletos.
    const rawPhase =
      this.readStringFromCandidates(state, [
        'phase',
        'stage',
        'turnPhase',
        'currentPhase',
      ]) ??
      '';
    const normalizedAction = (lastAction ?? '').toLowerCase();
    const resolvedPhaseFromState = this.mapRealtimePhase(rawPhase);

    if (resolvedPhaseFromState) {
      return resolvedPhaseFromState;
    }

    if (normalizedAction.includes('ended') || normalizedAction.includes('finish')) {
      return { phase: 'finished', pointsStage: 'ranking' };
    }

    if (
      normalizedAction.includes('vote')
    ) {
      return { phase: 'choice', pointsStage: 'waiting' };
    }

    if (
      normalizedAction.includes('reveal') ||
      normalizedAction.includes('ranking')
    ) {
      if (normalizedAction.includes('ranking')) {
        return { phase: 'points', pointsStage: 'ranking' };
      }

      if (normalizedAction.includes('reveal')) {
        return { phase: 'points', pointsStage: 'reveal' };
      }

      return { phase: 'points', pointsStage: 'waiting' };
    }

    return { phase: 'hand', pointsStage: 'waiting' };
  }

  private mapRealtimePhase(rawPhase: string): ResolvedPhaseState | null {
    // Traduce las etiquetas del backend a las tres fases visuales del frontend.
    const normalizedPhase = rawPhase.trim().toLowerCase();
    if (!normalizedPhase) {
      return null;
    }

    if (this.phaseMatches(normalizedPhase, ['ranking', 'rank'])) {
      return { phase: 'points', pointsStage: 'ranking' };
    }

    if (this.phaseMatches(normalizedPhase, ['finished', 'finish', 'ended', 'end'])) {
      return { phase: 'finished', pointsStage: 'ranking' };
    }

    if (
      this.phaseMatches(normalizedPhase, [
        'reveal',
        'result',
        'results',
        'resolution',
        'score',
        'scores',
        'scoring',
        'points',
        'point',
      ])
    ) {
      return { phase: 'points', pointsStage: 'reveal' };
    }

    if (
      this.phaseMatches(normalizedPhase, [
        'vote',
        'voting',
        'choice',
        'guess',
        'guessing',
        'pick',
        'picking',
        'select',
        'selection',
        'choosing',
      ])
    ) {
      return { phase: 'choice', pointsStage: 'waiting' };
    }

    if (
      this.phaseMatches(normalizedPhase, [
        'hand',
        'story',
        'storytelling',
        'submit',
        'submission',
        'submitting',
        'play',
        'playing',
      ])
    ) {
      return { phase: 'hand', pointsStage: 'waiting' };
    }

    return null;
  }

  private phaseMatches(normalizedPhase: string, aliases: readonly string[]): boolean {
    return aliases.some(
      (alias) => normalizedPhase === alias || normalizedPhase.includes(alias)
    );
  }

  private resolveCurrentPlayerState(state: Record<string, unknown>): Record<string, unknown> {
    // Busca el bloque del jugador local dentro del state público para recuperar
    // mano/voto/carta jugada cuando el backend lo expone.
    const currentRoundState = this.resolveCurrentRoundState(state);
    return (
      this.findPlayerStateInEntries(
        this.readArrayFromCandidates(currentRoundState, ['players', 'participants'])
      ) ??
      this.findPlayerStateInEntries(this.readArrayFromCandidates(state, ['players', 'participants'])) ??
      {}
    );
  }

  // Evita concatenar arrays intermedios cada vez que buscamos el bloque del usuario
  // actual dentro del state recibido por websocket.
  private findPlayerStateInEntries(entries: unknown[]): Record<string, unknown> | null {
    for (const entry of entries) {
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

    return null;
  }

  private resolveCurrentRoundState(state: Record<string, unknown>): Record<string, unknown> {
    return this.readRecordFromCandidates(state, ['currentRound']) ?? {};
  }

  private collectRoundChoiceEntries(currentRoundState: Record<string, unknown>): unknown[] {
    const playedCards = asRecord(currentRoundState['playedCards']);
    const choiceEntries: unknown[] = [];

    if (playedCards) {
      for (const value of Object.values(playedCards)) {
        if (value !== null && value !== undefined) {
          choiceEntries.push(value);
        }
      }
    }

    const storytellerCardId = currentRoundState['storytellerCardId'];
    const normalizedStorytellerCardCode = this.normalizeDynamicCardCode(storytellerCardId);
    if (
      normalizedStorytellerCardCode &&
      !choiceEntries.some(
        (entry) => this.normalizeDynamicCardCode(entry) === normalizedStorytellerCardCode
      )
    ) {
      choiceEntries.push(storytellerCardId);
    }

    return choiceEntries;
  }

  private resolveStorytellerId(state: Record<string, unknown>): string {
    // El storyteller puede venir tanto en la raíz como dentro de currentRound.
    // Se prueban varios alias usados por backend.
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

  private normalizeChoiceCards(entries: unknown[]): DeckCard[] {
    return entries
      .map((entry, index) => this.normalizeChoiceCard(entry, index))
      .filter((entry): entry is DeckCard => entry !== null);
  }

  private buildPrivateHandCards(hand: RealtimePrivateHandEntry[]): DeckCard[] {
    const usedOwnedCardIndexes = new Set<number>();
    return hand
      .map((cardEntry, index) => {
        const code = this.normalizePrivateHandCardCode(cardEntry);
        if (!code) {
          return null;
        }

        const ownedCardIndex = this.findOwnedCardIndexForPrivateHand(code, index, usedOwnedCardIndexes);
        if (ownedCardIndex >= 0) {
          usedOwnedCardIndexes.add(ownedCardIndex);
          const ownedCard = this.ownedCards[ownedCardIndex];
          const normalizedRealtimeCard = this.normalizeCard(cardEntry, index);
          return {
            ...ownedCard,
            ...(normalizedRealtimeCard ?? {}),
            code,
          };
        }

        return this.normalizeCard(cardEntry, index);
      })
      .filter((entry): entry is DeckCard => entry !== null);
  }

  private normalizePrivateHandCardCode(cardId: RealtimePrivateHandEntry): string {
    if (typeof cardId === 'number' && Number.isFinite(cardId)) {
      return String(cardId);
    }

    if (typeof cardId === 'string') {
      return cardId.trim();
    }

    const card = asRecord(cardId);
    if (!card) {
      return '';
    }

    return (
      this.readStringFromCandidates(card, ['cardId', 'card_id', 'id', 'code']) ??
      this.readNumber(card, ['cardId', 'card_id', 'id'])?.toString() ??
      ''
    );

  }

  private findOwnedCardIndexForPrivateHand(
    code: string,
    preferredIndex: number,
    usedOwnedCardIndexes: Set<number>
  ): number {
    const exactMatchIndex = this.ownedCards.findIndex(
      (card, index) => !usedOwnedCardIndexes.has(index) && card.code === code
    );
    if (exactMatchIndex >= 0) {
      return exactMatchIndex;
    }

    if (this.ownedCards[preferredIndex] && !usedOwnedCardIndexes.has(preferredIndex)) {
      return preferredIndex;
    }

    return this.ownedCards.findIndex((_card, index) => !usedOwnedCardIndexes.has(index));
  }

  private normalizeCard(entry: unknown, index: number): DeckCard | null {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      const code = String(entry);
      const knownCard = this.findKnownCardByCode(code);
      return {
        code,
        image: this.preferKnownCardImage(this.dynamicCardUrls.get(code) ?? DEFAULT_CARD_IMAGE, knownCard),
        value: knownCard?.value ?? code,
        suit: knownCard?.suit ?? 'DIXIT',
      };
    }

    if (typeof entry === 'string') {
      const code = entry.trim();
      if (!code) {
        return null;
      }

      const knownCard = this.findKnownCardByCode(code);
      return {
        code,
        image: this.preferKnownCardImage(this.dynamicCardUrls.get(code) ?? DEFAULT_CARD_IMAGE, knownCard),
        value: knownCard?.value ?? code,
        suit: knownCard?.suit ?? 'DIXIT',
      };
    }

    const card = asRecord(entry);
    if (!card) {
      return null;
    }

    const code =
      this.readStringFromCandidates(card, ['code', 'cardId', 'card_id', 'id']) ??
      this.readNumber(card, ['cardId', 'card_id', 'id'])?.toString() ??
      `card-${index + 1}`;
    const knownCard = this.findKnownCardByCode(code);
    const image =
      this.preferKnownCardImage(
        this.readStringFromCandidates(card, ['url_image', 'image', 'imageUrl', 'image_url', 'url']) ??
          this.dynamicCardUrls.get(code) ??
          DEFAULT_CARD_IMAGE,
        knownCard
      );
    const value =
      this.readStringFromCandidates(card, ['title', 'name', 'value']) ?? knownCard?.value ?? code;
    const suit =
      this.readStringFromCandidates(card, ['suit', 'collection']) ?? knownCard?.suit ?? 'DIXIT';

    return {
      code,
      image,
      value,
      suit,
    };
  }

  private normalizeChoiceCard(entry: unknown, index: number): DeckCard | null {
    const normalizedCard = this.normalizeCard(entry, index);
    if (!normalizedCard) {
      return null;
    }

    const knownCard = this.findKnownCardByCode(normalizedCard.code);
    if (!knownCard) {
      return normalizedCard;
    }

    return {
      code: normalizedCard.code,
      image: normalizedCard.image,
      value: normalizedCard.value || knownCard.value,
      suit: normalizedCard.suit || knownCard.suit,
    };
  }

  private findKnownCardByCode(code: string): DeckCard | null {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return null;
    }

    const knownCardSources = [this.choiceCards, this.cards, this.ownedCards];
    for (const source of knownCardSources) {
      const match = source.find((card) => card.code === normalizedCode);
      if (match) {
        return match;
      }
    }

    return null;
  }

  private syncDynamicCardUrls(
    state: Record<string, unknown>,
    currentRoundState: Record<string, unknown>
  ): void {
    this.dynamicCardUrls.clear();
    this.collectDynamicCardUrls(this.readRecordFromCandidates(state, ['cardUrls']));
    this.collectDynamicCardUrls(this.readRecordFromCandidates(currentRoundState, ['cardUrls']));
    this.collectDynamicCardUrlsFromEntries(
      this.readArrayFromCandidates(currentRoundState, ['boardCardsDetailed', 'boardCards'])
    );
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
        continue;
      }

      const cardData = asRecord(value);
      const url = cardData
        ? this.readStringFromCandidates(cardData, ['url_image', 'image', 'imageUrl', 'image_url', 'url'])
        : null;
      if (url) {
        this.registerDynamicCardUrl(normalizedCode, url);
      }
    }
  }

  private collectDynamicCardUrlsFromEntries(entries: unknown[]): void {
    for (const entry of entries) {
      const cardData = asRecord(entry);
      if (!cardData) {
        continue;
      }

      const cardCode =
        this.readStringFromCandidates(cardData, ['code', 'cardId', 'card_id', 'id']) ??
        this.readNumber(cardData, ['cardId', 'card_id', 'id'])?.toString() ??
        '';
      const url = this.readStringFromCandidates(cardData, [
        'url_image',
        'image',
        'imageUrl',
        'image_url',
        'url',
      ]);
      if (!cardCode || !url) {
        continue;
      }

      this.registerDynamicCardUrl(cardCode, url);
    }
  }

  private registerDynamicCardUrl(cardCode: string, url: string): void {
    const normalizedCardCode = cardCode.trim();
    const normalizedUrl = url.trim();
    if (!normalizedCardCode || !normalizedUrl) {
      return;
    }

    for (const equivalentCode of this.buildEquivalentCardCodes(normalizedCardCode)) {
      this.dynamicCardUrls.set(equivalentCode, normalizedUrl);
    }
  }

  private resolveCurrentPlayerPlayedCardCode(
    currentRoundState: Record<string, unknown>,
    currentPlayerState: Record<string, unknown>
  ): string {
    // Reconstruye cuál es la carta propia ya enviada para bloquearla en votación
    // y evitar que el jugador se vote a sí mismo.
    const ownPlayedCard =
      this.normalizeDynamicCardCode(asRecord(currentRoundState['playedCards'])?.[this.currentUserId]) ??
      this.normalizeDynamicCardCode(currentRoundState['playedCard']) ??
      this.readStringFromCandidates(currentPlayerState, [
        'submittedCardCode',
        'selectedCardCode',
        'playedCardCode',
      ]) ??
      this.normalizeDynamicCardCode(currentPlayerState['playedCard']) ??
      this.normalizeDynamicCardCode(asRecord(currentPlayerState['selectedCard'])?.['cardId']) ??
      this.normalizeDynamicCardCode(asRecord(currentPlayerState['selectedCard'])?.['id']) ??
      this.normalizeDynamicCardCode(asRecord(currentPlayerState['selectedCard'])?.['code']);

    return ownPlayedCard ?? '';
  }

  private resolveDisplayedChoiceCardCode(cardCode: string): string {
    const normalizedCardCode = cardCode.trim();
    if (!normalizedCardCode) {
      return '';
    }

    if (this.choiceCards.some((card) => card.code === normalizedCardCode)) {
      return normalizedCardCode;
    }

    const equivalentCard = this.choiceCards.find((card) =>
      this.areEquivalentCardCodes(card.code, normalizedCardCode)
    );
    return equivalentCard?.code ?? normalizedCardCode;
  }

  private areEquivalentCardCodes(leftCode: string, rightCode: string): boolean {
    const normalizedLeftCode = leftCode.trim();
    const normalizedRightCode = rightCode.trim();
    if (!normalizedLeftCode || !normalizedRightCode) {
      return false;
    }

    if (normalizedLeftCode === normalizedRightCode) {
      return true;
    }

    return this.buildEquivalentCardCodes(normalizedLeftCode).includes(normalizedRightCode);
  }

  private buildEquivalentCardCodes(cardCode: string): string[] {
    const normalizedCardCode = cardCode.trim();
    if (!normalizedCardCode) {
      return [];
    }

    const equivalents = new Set<string>([normalizedCardCode]);
    const numericSuffix = normalizedCardCode.match(/(\d+)$/)?.[1];
    if (numericSuffix) {
      equivalents.add(numericSuffix);
      equivalents.add(`c_${numericSuffix}`);
      equivalents.add(`C_${numericSuffix}`);
    }

    return [...equivalents];
  }

  private normalizeDynamicCardCode(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    const record = asRecord(value);
    if (!record) {
      return null;
    }

    return (
      this.readStringFromCandidates(record, ['code', 'cardId', 'id']) ??
      this.readNumber(record, ['cardId', 'id'])?.toString() ??
      null
    );
  }

  private normalizeRevealedCards(entries: unknown[]): DixitRevealedCard[] {
    // Normaliza estructuras de reveal ya preparadas por backend si vienen disponibles.
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
    // Normaliza scoreboards enviados por backend para que la tabla de puntos
    // no dependa de un único nombre de campo.
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

  private reconcileCardList(nextCards: DeckCard[], currentCards: DeckCard[]): DeckCard[] {
    const currentCardsByCode = new Map(currentCards.map((card) => [card.code, card]));
    return nextCards.map((nextCard) => {
      const currentCard = currentCardsByCode.get(nextCard.code);
      return currentCard && this.areCardsEquivalent(currentCard, nextCard) ? currentCard : nextCard;
    });
  }

  private areCardsEquivalent(left: DeckCard, right: DeckCard): boolean {
    return (
      left.code === right.code &&
      left.image === right.image &&
      left.value === right.value &&
      left.suit === right.suit
    );
  }

  private areCardArraysIdentical(left: DeckCard[], right: DeckCard[]): boolean {
    return left.length === right.length && left.every((card, index) => card === right[index]);
  }

  private preferKnownCardImage(image: string, knownCard: DeckCard | null): string {
    if (!knownCard || !knownCard.image || knownCard.image === DEFAULT_CARD_IMAGE) {
      return image;
    }

    return knownCard.image;
  }

  private removeCardFromVisibleHand(cardCode: string): void {
    const nextCards = this.cards.filter((card) => card.code !== cardCode);
    if (nextCards.length === this.cards.length) {
      return;
    }

    const currentHandCodes = new Set(this.cards.map((card) => card.code));
    const choiceCardsMirrorHand =
      this.phase === 'hand' ||
      this.choiceCards.length === 0 ||
      this.choiceCards.every((card) => currentHandCodes.has(card.code));

    this.cards = nextCards;
    if (choiceCardsMirrorHand) {
      this.choiceCards = [...nextCards];
    }
  }

  private markHandSubmitted(): void {
    this.handSubmitted = true;
    this.submittedHandRoundNumber = this.roundNumber;
  }

  private resetHandSubmissionState(): void {
    this.selectedHandCardCode = '';
    this.handSubmitted = false;
    this.submittedHandRoundNumber = null;
    this.currentPlayerPlayedCardCode = '';
  }

  // --- Acciones de interfaz ------------------------------------------------
  onHandCardSelected(card: DeckCard): void {
    if (this.handSubmitted) {
      return;
    }

    this.selectedHandCardCode = card.code;
  }

  clearHandSelection(): void {
    this.resetHandSubmissionState();
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

    this.removeCardFromVisibleHand(this.selectedHandCardCode);
    this.storySubmitted = true;
    this.markHandSubmitted();
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
    try {
      this.realtime.sendGameAction('SUBMIT_CARD', { cardId });
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo enviar la jugada';
      return;
    }

    this.removeCardFromVisibleHand(this.selectedHandCardCode);
    this.markHandSubmitted();
    this.errorMessage = '';
  }

  goHome(): void {
    void this.router.navigate(['/menu']);
  }

  toggleFinalRanking(): void {
    if (!this.hasFinalRanking) {
      return;
    }

    this.showFinalRanking = !this.showFinalRanking;
  }

  returnToGames(): void {
    this.realtime.disconnect(false);
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

  emitEndGameFromStateDrawer(): void {
    try {
      this.realtime.endGame();
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo enviar el fin de partida';
    }
  }

  closeMinigame1(): void {
    if (this.activeMinigame) {
      return;
    }

    this.isMinigame1Open = false;
  }

  simulateDuelSquareLanding(): void {
    if (this.duelTargetPlayers.length === 0) {
      this.errorMessage = 'No hay rivales disponibles para simular una casilla de duelo.';
      return;
    }

    this.closeSimulationDrawer();
    this.errorMessage = '';
    this.simulationTriggerMode = 'duel';
    this.activeDuelChallenge = {
      challengerId: this.currentUserId || this.localCurrentPlayerId,
      receivedAt: Date.now(),
    };
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
      return;
    }
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
    if (
      this.phase !== 'choice' ||
      this.voteSubmitted ||
      this.isCurrentPlayerStoryteller ||
      this.areEquivalentCardCodes(card.code, this.currentPlayerPlayedCardCode)
    ) {
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
    if (
      this.phase !== 'choice' ||
      this.isCurrentPlayerStoryteller ||
      !this.selectedChoiceCardCode ||
      this.areEquivalentCardCodes(this.selectedChoiceCardCode, this.currentPlayerPlayedCardCode)
    ) {
      return;
    }

    const cardId = this.resolveActionCardId(this.selectedChoiceCardCode);
    try {
      this.realtime.sendGameAction('CAST_VOTE', {
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

  requestNextRound(): void {
    if (!this.isCurrentPlayerHost || this.phase !== 'points') {
      return;
    }

    try {
      this.realtime.sendGameAction('NEXT_ROUND');
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo avanzar a la siguiente ronda';
    }
  }

  prepareNextRound(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'ranking') {
      return;
    }

    this.clearRevealRankingTimer();
    this.clearNextRoundTimer();
    this.roundNumber += 1;
    this.phase = 'hand';
    this.pointsStage = 'waiting';
    this.resetHandSubmissionState();
    this.selectedChoiceCardCode = '';
    this.voteSubmitted = false;
    this.pointsVotesReceived = 0;
    this.pointsVotesTotal = 0;
    this.pointsRevealedCards = [];
    this.pointsRanking = [];
    this.currentRoundPlayers = [];
    this.pendingBoardTokens = null;
    this.currentClue = '';
    this.clueDraft = '';
    this.storySubmitted = false;
    this.currentPlayerPlayedCardCode = '';
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

  closeDuelModal(): void {
    this.activeDuelChallenge = null;
    this.simulationTriggerMode = null;
    this.realtime.clearDuelChallenge();
  }

  closeModeChangeOffer(): void {
    this.dismissModeChangeOffer();
  }

  acceptModeChangeOffer(): void {
    if (!this.activeModeChangeOffer) {
      return;
    }

    try {
      this.realtime.sendGameAction('ACCEPT_MODE_CHANGE', {});
      this.errorMessage = '';
      this.dismissModeChangeOffer();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo aceptar el cambio de modo';
    }
  }

  resolveDuel(targetId: string): void {
    if (!targetId.trim()) {
      return;
    }

    try {
      this.realtime.sendGameAction('RESOLVE_DUEL', { targetId });
      this.errorMessage = '';
      this.closeDuelModal();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo resolver el duelo';
    }
  }

  claimVisibleStar(): void {
    // El backend decide al ganador final. El cliente solo solicita la captura
    // mientras la estrella siga visible y la conexión realtime esté viva.
    if (!this.activeStar || this.realtime.connectionStatus() !== 'connected') {
      return;
    }

    try {
      this.realtime.claimStar();
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo capturar la estrella fugaz';
    }
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
    return getRoundPlayers(this.playerRoster, this.choiceCards, this.pointsByPlayer);
  }

  private buildRevealAndRanking(roundPlayers: RoundPlayer[]): {
    revealedCards: DixitRevealedCard[];
    ranking: DixitRankingRow[];
  } {
    return buildRevealAndRanking(
      roundPlayers,
      this.choiceCards,
      this.playerRoster,
      this.selectedChoiceCardCode,
      this.localCurrentPlayerId
    );
  }

  private scheduleRevealRanking(): void {
    if (this.revealRankingTimer !== null) {
      return;
    }

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

  private syncRealtimePhaseTimers(): void {
    if (this.phase !== 'points') {
      this.clearRevealRankingTimer();
      this.clearNextRoundTimer();
      return;
    }

    if (this.pointsStage === 'reveal') {
      this.scheduleRevealRanking();
      this.scheduleNextRound();
      return;
    }

    if (this.pointsStage === 'ranking') {
      this.clearRevealRankingTimer();
      this.scheduleNextRound();
      return;
    }

    this.clearNextRoundTimer();
  }

  private syncModeChangeOfferVisibility(): void {
    if (this.phase === 'points') {
      return;
    }

    this.dismissModeChangeOffer();
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

  private scheduleNextRound(): void {
    if (!this.isCurrentPlayerHost) {
      this.clearNextRoundTimer();
      return;
    }

    if (this.nextRoundTimer !== null && this.nextRoundTimerRoundNumber === this.roundNumber) {
      return;
    }

    this.clearNextRoundTimer();
    this.nextRoundTimerRoundNumber = this.roundNumber;
    this.nextRoundTimer = setTimeout(() => {
      this.nextRoundTimer = null;
      this.nextRoundTimerRoundNumber = null;

      if (
        !this.isCurrentPlayerHost ||
        this.phase !== 'points' ||
        (this.pointsStage !== 'reveal' && this.pointsStage !== 'ranking')
      ) {
        return;
      }

      try {
        this.realtime.sendGameAction('NEXT_ROUND');
        this.errorMessage = '';
      } catch (error) {
        this.errorMessage =
          error instanceof Error ? error.message : 'No se pudo avanzar a la siguiente ronda';
      }
    }, 9000);
  }

  private clearNextRoundTimer(): void {
    if (this.nextRoundTimer === null) {
      return;
    }

    clearTimeout(this.nextRoundTimer);
    this.nextRoundTimer = null;
    this.nextRoundTimerRoundNumber = null;
  }

  private dismissModeChangeOffer(): void {
    this.activeModeChangeOffer = null;
    this.modeChangeOfferSecondsLeft = 0;
    this.clearModeChangeOfferTimer();
    this.realtime.clearModeChangeOffer();
  }

  private clearModeChangeOfferTimer(): void {
    if (this.modeChangeOfferTimer === null) {
      return;
    }

    clearInterval(this.modeChangeOfferTimer);
    this.modeChangeOfferTimer = null;
  }

  private applyRealtimeStarClaim(claim: RealtimeStarClaim): void {
    // Evita reprocesar el mismo claim si reaparece por reactividad o recuperación.
    if (claim.receivedAt <= this.lastAppliedStarClaimReceivedAt) {
      return;
    }

    this.lastAppliedStarClaimReceivedAt = claim.receivedAt;
    this.activeStar = null;
    this.applyStarClaimScores(claim.newScores);
    this.starWinnerLabel = this.resolvePlayerName(claim.winnerId) || 'Estrella capturada';
    this.starClaimSequence += 1;
    this.clearStarWinnerTimer();
    this.starWinnerTimer = setTimeout(() => {
      this.starWinnerLabel = '';
      this.starWinnerTimer = null;
      this.cdr.detectChanges();
    }, 1800);
  }

  private applyStarClaimScores(newScores: Record<string, number>): void {
    // El backend manda las puntuaciones completas, no un delta. Por eso aquí
    // se sustituyen los totales del marcador y, si estamos en scoring,
    // también se recompone la tabla de ranking visible.
    const scoreEntries = Object.entries(newScores);
    if (scoreEntries.length === 0) {
      return;
    }

    for (const [playerId, totalPoints] of scoreEntries) {
      this.pointsByPlayer.set(playerId, totalPoints);
    }

    if (this.pointsRanking.length > 0) {
      this.pointsRanking = this.pointsRanking
        .map((row) => {
          const totalPoints = newScores[row.playerId];
          if (typeof totalPoints !== 'number') {
            return row;
          }

          return {
            ...row,
            totalPoints,
            pointsEarned: totalPoints - row.pointsBefore,
          };
        })
        .sort((left, right) => right.totalPoints - left.totalPoints);
    }

    this.boardTokens = this.buildBoardTokensFromScores();
  }

  private applyRealtimeGameEnded(gameEndedResult: RealtimeGameEnded): void {
    if (gameEndedResult.receivedAt <= this.lastAppliedGameEndedReceivedAt) {
      return;
    }

    this.lastAppliedGameEndedReceivedAt = gameEndedResult.receivedAt;
    this.phase = 'finished';
    this.gameEnded = true;
    this.gameEndRequested = true;
    this.finalRanking = gameEndedResult.ranking.map((entry) => ({
      ...entry,
      playerName: this.resolvePlayerName(entry.playerId),
      isCurrentPlayer: entry.playerId === this.currentUserId,
    }));
    this.finalResultsError = gameEndedResult.error ?? '';
    this.showFinalRanking = false;
  }

  private applyRealtimeWalletUpdated(walletUpdated: RealtimeWalletUpdated): void {
    if (walletUpdated.receivedAt <= this.lastAppliedWalletUpdatedAt) {
      return;
    }

    this.lastAppliedWalletUpdatedAt = walletUpdated.receivedAt;
    this.finalWalletBalance = walletUpdated.balance;
  }

  private applyRealtimeMinigameStart(minigame: RealtimeMinigameStart): void {
    if (minigame.receivedAt <= this.lastAppliedMinigameReceivedAt) {
      return;
    }

    this.lastAppliedMinigameReceivedAt = minigame.receivedAt;
    this.clearMinigameResolutionTimer();
    this.clearMinigameUnavailableSubmitTimer();
    this.simulationTriggerMode = null;
    this.activeMinigame = minigame;
    this.minigameResultSent = false;
    this.minigameUiState = 'playing';
    this.minigameStatusMessage = '';
    this.closeDuelModal();
    this.realtime.clearMinigameStart();

    if (!this.isCurrentPlayerInActiveMinigame) {
      this.isMinigame1Open = false;
      this.isMinigame2Open = false;
      this.isMinigame3Open = false;
      this.minigameStatusMessage =
        this.resolveMinigameView(minigame.type) === null
          ? 'Minijuego no disponible en este cliente. Esperando resolucion del servidor...'
          : 'Duelo en curso. Esperando resolucion del servidor...';
      this.closeSimulationDrawer();
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

    this.closeSimulationDrawer();
  }

  private applyRealtimeModeChangeOffer(offer: RealtimeModeChangeOffer): void {
    if (offer.receivedAt <= this.lastAppliedModeChangeOfferAt) {
      return;
    }

    this.lastAppliedModeChangeOfferAt = offer.receivedAt;
    this.activeModeChangeOffer = offer;
    this.modeChangeOfferSecondsLeft = 10;
    this.clearModeChangeOfferTimer();
    this.modeChangeOfferTimer = setInterval(() => {
      this.modeChangeOfferSecondsLeft = Math.max(0, this.modeChangeOfferSecondsLeft - 1);
      if (this.modeChangeOfferSecondsLeft === 0) {
        this.dismissModeChangeOffer();
      }
      this.cdr.detectChanges();
    }, 1000);
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

  private applyRealtimeSpecialEvent(specialEvent: RealtimeSpecialEvent): void {
    if (!this.activeMinigame) {
      return;
    }

    if (specialEvent.effect === 'CONFLICT_RESOLVED') {
      if (specialEvent.winnerId === this.currentUserId) {
        this.minigameUiState = 'won';
        this.minigameStatusMessage = 'Victoria';
      } else if (specialEvent.loserId === this.currentUserId) {
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
      this.minigameUiState = 'cancelled';
      this.minigameStatusMessage =
        specialEvent.message || 'El minijuego ha terminado sin ganador.';
      this.scheduleMinigameClose(2000);
    }
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
    this.clearMinigameUnavailableSubmitTimer();
    this.clearMinigameResolutionTimer();
    this.activeMinigame = null;
    this.simulationTriggerMode = null;
    this.minigameResultSent = false;
    this.minigameUiState = 'playing';
    this.minigameStatusMessage = '';
  }

  private resolvePlayerName(playerId: string): string {
    if (!playerId.trim()) {
      return '';
    }

    return this.playerRoster.find((player) => player.id === playerId)?.name ?? playerId;
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

  private clearStarWinnerTimer(): void {
    // El banner de ganador es efímero. Si llega otro claim o se destruye el
    // componente, el timer anterior debe cancelarse para no pisar el estado nuevo.
    if (this.starWinnerTimer === null) {
      return;
    }

    clearTimeout(this.starWinnerTimer);
    this.starWinnerTimer = null;
  }

  private buildBoardTokensFromScores(): TrackBoardToken[] {
    return buildBoardTokensFromScores(this.playerRoster, this.pointsByPlayer);
  }

  // --- Resolucion visual de tablero ---------------------------------------
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
      eventBackCellPositions: this.eventBackCellPositions,
      eventForwardCellPositions: this.eventForwardCellPositions,
      roundNumber: this.roundNumber,
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
  private enqueueEffectPopup(popup: BoardEffectPopup): void {
    if (this.activeEffectPopup === null) {
      this.activeEffectPopup = popup;
      return;
    }

    this.effectPopupQueue.push(popup);
  }
}
