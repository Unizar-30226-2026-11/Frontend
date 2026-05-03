import { Injectable, signal } from '@angular/core';
import type {
  DixitConnectionStatus,
  DixitGameActionType,
  RealtimeChatMessage,
  RealtimeDuelChallenge,
  RealtimeGameEnded,
  RealtimeGameStateUpdate,
  RealtimeLobbyPlayer,
  RealtimeLobbyState,
  RealtimeMinigameStart,
  RealtimeModeChangeOffer,
  RealtimePrivateHand,
  RealtimeSpecialEvent,
  RealtimeStarClaim,
  RealtimeStarSpawn,
  RealtimeWalletUpdated,
} from '../../interfaces/dixit-realtime';

type SimulatorPhase = 'hand' | 'choice' | 'points-reveal' | 'points-ranking' | 'finished';

interface SimulatorPlayerState {
  id: string;
  username: string;
  score: number;
  hand: string[];
  playedCardCode: string | null;
  voteCardCode: string | null;
}

interface SimulatorActiveModifier {
  type: 'HAND_LIMIT';
  value: number;
  turnsLeft: number;
}

export interface DixitSimulatorLogEntry {
  id: number;
  timestamp: string;
  message: string;
}

export interface DixitSimulatorSnapshot {
  lobbyCode: string;
  phase: SimulatorPhase;
  roundNumber: number;
  storytellerId: string;
  clue: string;
  boardCards: string[];
  playedCards: Record<string, string>;
  votes: Array<{ voterId: string; targetCardCode: string }>;
  activeModifiers: Record<string, SimulatorActiveModifier>;
  players: Array<{
    id: string;
    username: string;
    score: number;
    hand: string[];
    playedCardCode: string | null;
    voteCardCode: string | null;
  }>;
  lastMinigameResolution: {
    type: number;
    isDuel: boolean;
    reason: 'manual_close' | 'timeout' | 'cancelled';
    payload: Record<string, unknown>;
  } | null;
}

const CURRENT_USER_ID = 'u_self';
const CURRENT_USER_NAME = 'Tester local';
const FALLBACK_LOBBY_CODE = 'TEST-DIXIT';
const STAR_REWARD_POINTS = 3;
const DEFAULT_STAR_DURATION_MS = 2600;
const DEFAULT_FINAL_BALANCE = 250;
const TEST_CARD_LIBRARY = [
  'c_101',
  'c_102',
  'c_103',
  'c_104',
  'c_105',
  'c_106',
  'c_107',
  'c_108',
  'c_109',
  'c_110',
  'c_111',
  'c_112',
  'c_113',
  'c_114',
  'c_115',
  'c_116',
  'c_117',
  'c_118',
  'c_119',
  'c_120',
  'c_121',
  'c_122',
  'c_123',
  'c_124',
];

@Injectable()
export class DixitRealtimeSimulator {
  private readonly connectionStatusSignal = signal<DixitConnectionStatus>('idle');
  private readonly lobbyStateSignal = signal<RealtimeLobbyState | null>(null);
  private readonly gameStateSignal = signal<RealtimeGameStateUpdate | null>(null);
  private readonly privateHandSignal = signal<RealtimePrivateHand | null>(null);
  private readonly duelChallengeSignal = signal<RealtimeDuelChallenge | null>(null);
  private readonly activeMinigameSignal = signal<RealtimeMinigameStart | null>(null);
  private readonly specialEventSignal = signal<RealtimeSpecialEvent | null>(null);
  private readonly modeChangeOfferSignal = signal<RealtimeModeChangeOffer | null>(null);
  private readonly activeStarSignal = signal<RealtimeStarSpawn | null>(null);
  private readonly starClaimSignal = signal<RealtimeStarClaim | null>(null);
  private readonly gameEndedSignal = signal<RealtimeGameEnded | null>(null);
  private readonly walletUpdatedSignal = signal<RealtimeWalletUpdated | null>(null);
  private readonly chatMessagesSignal = signal<RealtimeChatMessage[]>([]);
  private readonly lastErrorSignal = signal('');
  private readonly logEntriesSignal = signal<DixitSimulatorLogEntry[]>([]);
  private readonly snapshotSignal = signal<DixitSimulatorSnapshot | null>(null);

  private lobbyCode = FALLBACK_LOBBY_CODE;
  private roundNumber = 1;
  private phase: SimulatorPhase = 'hand';
  private storytellerId = CURRENT_USER_ID;
  private clue = '';
  private players: SimulatorPlayerState[] = [];
  private activeModifiers: Record<string, SimulatorActiveModifier> = {};
  private finalBalance = DEFAULT_FINAL_BALANCE;
  private logSequence = 0;
  private minigameTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private minigameResolutionEmitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private revealTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastMinigameResolution: DixitSimulatorSnapshot['lastMinigameResolution'] = null;

  constructor() {
    this.resetDemo();
  }

  lobbyState(): RealtimeLobbyState | null {
    return this.lobbyStateSignal();
  }

  gameState(): RealtimeGameStateUpdate | null {
    return this.gameStateSignal();
  }

  privateHand(): RealtimePrivateHand | null {
    return this.privateHandSignal();
  }

  duelChallenge(): RealtimeDuelChallenge | null {
    return this.duelChallengeSignal();
  }

  minigameStart(): RealtimeMinigameStart | null {
    return this.activeMinigameSignal();
  }

  activeMinigame(): RealtimeMinigameStart | null {
    return this.activeMinigameSignal();
  }

  specialEvent(): RealtimeSpecialEvent | null {
    return this.specialEventSignal();
  }

  modeChangeOffer(): RealtimeModeChangeOffer | null {
    return this.modeChangeOfferSignal();
  }

  activeStar(): RealtimeStarSpawn | null {
    return this.activeStarSignal();
  }

  starClaim(): RealtimeStarClaim | null {
    return this.starClaimSignal();
  }

  gameEndedResult(): RealtimeGameEnded | null {
    return this.gameEndedSignal();
  }

  walletUpdated(): RealtimeWalletUpdated | null {
    return this.walletUpdatedSignal();
  }

  chatMessages(): RealtimeChatMessage[] {
    return this.chatMessagesSignal();
  }

  lastError(): string {
    return this.lastErrorSignal();
  }

  activeLobbyCode(): string {
    return this.lobbyCode;
  }

  connectionStatus(): DixitConnectionStatus {
    return this.connectionStatusSignal();
  }

  simulatorSnapshot(): DixitSimulatorSnapshot | null {
    return this.snapshotSignal();
  }

  simulatorLogs(): DixitSimulatorLogEntry[] {
    return this.logEntriesSignal();
  }

  async ensureLobbyConnection(lobbyCode: string): Promise<void> {
    this.lobbyCode = normalizeLobbyCode(lobbyCode) || FALLBACK_LOBBY_CODE;
    this.connectionStatusSignal.set('joining');
    this.connectionStatusSignal.set('connecting');
    this.connectionStatusSignal.set('connected');
    this.publishLobbyState();
    this.emitPrivateHand();
    this.emitGameState('SIM_CONNECTED');
    this.pushLog(`Conexion simulada a la sala ${this.lobbyCode}.`);
  }

  disconnect(preserveSession = true): void {
    this.clearMinigameTimeout();
    this.clearMinigameResolutionEmitTimeout();
    this.clearRevealTransitionTimeout();
    this.connectionStatusSignal.set(preserveSession ? 'disconnected' : 'idle');
    if (preserveSession) {
      this.pushLog('Conexion simulada cerrada.');
      return;
    }

    this.resetDemo();
    this.connectionStatusSignal.set('idle');
    this.pushLog('Sandbox reiniciado por desconexion completa.');
  }

  sendGameAction(actionType: DixitGameActionType, payload: Record<string, unknown> = {}): void {
    switch (actionType) {
      case 'SEND_STORY':
        this.handleStorySubmission(payload);
        return;
      case 'SUBMIT_CARD':
        this.handleCardSubmission(payload);
        return;
      case 'CAST_VOTE':
        this.handleVoteSubmission(payload);
        return;
      case 'NEXT_ROUND':
        this.advanceToNextRound();
        return;
      case 'RESOLVE_DUEL':
        this.resolveDuel(payload);
        return;
      default:
        this.pushLog(`Accion simulada ignorada: ${actionType}.`);
    }
  }

  sendChat(text: string): void {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return;
    }

    this.chatMessagesSignal.update((messages) => [
      ...messages,
      {
        username: CURRENT_USER_NAME,
        text: normalizedText,
        timestamp: new Date().toISOString(),
      },
    ]);
    this.pushLog(`Chat local: ${normalizedText}`);
  }

  clearStarClaim(): void {
    this.starClaimSignal.set(null);
  }

  clearGameEndedResult(): void {
    this.gameEndedSignal.set(null);
  }

  clearMinigameStart(): void {
    this.activeMinigameSignal.set(null);
  }

  clearSpecialEvent(): void {
    this.specialEventSignal.set(null);
  }

  clearModeChangeOffer(): void {
    this.modeChangeOfferSignal.set(null);
  }

  clearDuelChallenge(): void {
    this.duelChallengeSignal.set(null);
  }

  sendMinigameScore(score: number): void {
    const activeMinigame = this.activeMinigameSignal();
    if (!activeMinigame) {
      return;
    }

    this.clearMinigameTimeout();
    this.clearMinigameResolutionEmitTimeout();
    this.pushLog(`Puntuacion local enviada al servidor simulado: ${score}.`);

    const normalizedScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
    this.minigameResolutionEmitTimeoutId = setTimeout(() => {
      this.minigameResolutionEmitTimeoutId = null;
      this.resolveMinigameFromScores(activeMinigame, normalizedScore);
    }, 550);
  }

  claimStar(): void {
    this.resolveStarClaim(CURRENT_USER_ID);
  }

  endGame(): void {
    this.finishGame('Fin de partida solicitado desde la UI.');
  }

  resetDemo(): void {
    this.clearMinigameTimeout();
    this.clearMinigameResolutionEmitTimeout();
    this.clearRevealTransitionTimeout();
    this.players = [
      {
        id: CURRENT_USER_ID,
        username: CURRENT_USER_NAME,
        score: 0,
        hand: [],
        playedCardCode: null,
        voteCardCode: null,
      },
      {
        id: 'u_mara',
        username: 'Mara',
        score: 0,
        hand: [],
        playedCardCode: null,
        voteCardCode: null,
      },
      {
        id: 'u_teo',
        username: 'Teo',
        score: 0,
        hand: [],
        playedCardCode: null,
        voteCardCode: null,
      },
      {
        id: 'u_lia',
        username: 'Lia',
        score: 0,
        hand: [],
        playedCardCode: null,
        voteCardCode: null,
      },
    ];
    this.roundNumber = 1;
    this.phase = 'hand';
    this.storytellerId = CURRENT_USER_ID;
    this.clue = '';
    this.activeModifiers = {};
    this.finalBalance = DEFAULT_FINAL_BALANCE;
    this.lastMinigameResolution = null;
    this.dealHandsForRound();
    this.connectionStatusSignal.set('connected');
    this.duelChallengeSignal.set(null);
    this.activeMinigameSignal.set(null);
    this.specialEventSignal.set(null);
    this.activeStarSignal.set(null);
    this.starClaimSignal.set(null);
    this.gameEndedSignal.set(null);
    this.walletUpdatedSignal.set(null);
    this.lastErrorSignal.set('');
    this.chatMessagesSignal.set([]);
    this.publishLobbyState();
    this.emitPrivateHand();
    this.emitGameState('SIM_RESET');
    this.pushLog('Sandbox de Dixit reiniciado.');
  }

  startRoundWithStoryteller(playerId: string): void {
    const normalizedPlayerId = this.findPlayerById(playerId)?.id ?? CURRENT_USER_ID;
    this.roundNumber = Math.max(1, this.roundNumber);
    this.phase = 'hand';
    this.storytellerId = normalizedPlayerId;
    this.clue = normalizedPlayerId === CURRENT_USER_ID ? '' : `Pista de ${this.playerName(normalizedPlayerId)}`;
    this.dealHandsForRound();
    const storyteller = this.requirePlayer(normalizedPlayerId);
    storyteller.playedCardCode = storyteller.hand[0] ?? null;
    if (storyteller.playedCardCode) {
      storyteller.hand = storyteller.hand.filter((cardCode) => cardCode !== storyteller.playedCardCode);
    }
    this.emitPrivateHand();
    this.emitGameState('SIM_ROUND_PREPARED');
    this.pushLog(`Nueva ronda preparada. Cuenta-cuentos: ${this.playerName(normalizedPlayerId)}.`);
  }

  setClue(clue: string): void {
    this.clue = clue.trim();
    this.emitGameState('SIM_CLUE_UPDATED');
  }

  openVotingPhase(): void {
    this.clearRevealTransitionTimeout();
    this.ensureStorytellerSubmission();
    this.autoSubmitBotCards();
    this.phase = 'choice';
    this.emitPrivateHand();
    this.emitGameState('SIM_VOTING_OPENED');
    this.pushLog('La ronda ha pasado a votacion.');
  }

  openRevealPhase(): void {
    this.clearRevealTransitionTimeout();
    this.ensureStorytellerSubmission();
    this.autoSubmitBotCards();
    this.autoVoteBots();
    this.ensureCurrentPlayerVote();
    this.applyVoteScores();
    this.phase = 'points-reveal';
    this.emitGameState('SIM_REVEAL_OPENED');
    this.pushLog('La ronda ha pasado a reveal/puntuacion.');
  }

  showRankingPhase(): void {
    this.clearRevealTransitionTimeout();
    this.openRevealPhase();
    this.phase = 'points-ranking';
    this.emitGameState('SIM_RANKING_OPENED');
    this.pushLog('La clasificacion de la ronda ya esta visible.');
  }

  emitDuel(): void {
    this.duelChallengeSignal.set({
      challengerId: CURRENT_USER_ID,
      receivedAt: Date.now(),
    });
    this.pushLog('Evento duel_available simulado.');
  }

  startMinigame(type: number, isDuel = false): void {
    this.clearMinigameTimeout();
    this.clearMinigameResolutionEmitTimeout();
    const opponentId =
      this.players.find((player) => player.id !== CURRENT_USER_ID)?.id ?? 'u_other';
    this.activeMinigameSignal.set({
      player1: CURRENT_USER_ID,
      player2: opponentId,
      type,
      isDuel,
      duration: 15_000,
      receivedAt: Date.now(),
    });
    this.duelChallengeSignal.set(null);
    this.specialEventSignal.set(null);
    this.scheduleMinigameTimeout(15_000);
    this.pushLog(`Minijuego ${type} simulado${isDuel ? ' desde duelo' : ''}.`);
  }

  cancelMinigame(): void {
    this.resolveActiveMinigame('cancelled');
  }

  closeActiveMinigame(): void {
    this.resolveActiveMinigame('manual_close');
  }

  completeActiveMinigameByTimeout(): void {
    this.resolveActiveMinigame('timeout');
  }

  spawnStar(): void {
    this.activeStarSignal.set({
      starId: `sim-star-${Date.now()}`,
      path: {
        start: { x: 12, y: 18 },
        end: { x: 82, y: 68 },
      },
      duration: DEFAULT_STAR_DURATION_MS,
      receivedAt: Date.now(),
    });
    this.pushLog('Evento star_spawned simulado.');
  }

  resolveStarClaim(winnerId: string): void {
    if (!this.activeStarSignal()) {
      this.spawnStar();
    }

    const winner = this.requirePlayer(winnerId);
    winner.score += STAR_REWARD_POINTS;
    this.activeStarSignal.set(null);
    this.starClaimSignal.set({
      winnerId: winner.id,
      newScores: Object.fromEntries(this.players.map((player) => [player.id, player.score])),
      receivedAt: Date.now(),
    });
    this.emitGameState('SIM_STAR_CLAIMED');
    this.pushLog(`Estrella capturada por ${winner.username}.`);
  }

  updatePlayerScore(playerId: string, nextScore: number): void {
    const player = this.findPlayerById(playerId);
    if (!player) {
      return;
    }

    player.score = Math.max(0, Math.round(nextScore));
    this.emitGameState('SIM_SCORE_UPDATED');
  }

  setHandLimitModifier(value: number, turnsLeft: number): void {
    const normalizedValue = Math.trunc(value) || 1;
    const normalizedTurnsLeft = Math.max(1, Math.floor(turnsLeft));
    this.activeModifiers = {
      hand_limit: {
        type: 'HAND_LIMIT',
        value: normalizedValue,
        turnsLeft: normalizedTurnsLeft,
      },
    };
    this.emitGameState('SIM_HAND_LIMIT_MODIFIER_UPDATED');
    const signedValue = normalizedValue > 0 ? `+${normalizedValue}` : `${normalizedValue}`;
    this.pushLog(
      `Modificador HAND_LIMIT activado: ${signedValue} carta(s) durante ${normalizedTurnsLeft} turno(s).`
    );
  }

  clearHandLimitModifier(): void {
    this.activeModifiers = {};
    this.emitGameState('SIM_HAND_LIMIT_MODIFIER_CLEARED');
    this.pushLog('Modificador HAND_LIMIT desactivado.');
  }

  finishGame(reason = 'Fin de partida simulado.'): void {
    this.clearRevealTransitionTimeout();
    this.phase = 'finished';
    const ranking = [...this.players]
      .sort((left, right) => right.score - left.score)
      .map((player, index) => ({
        playerId: player.id,
        points: player.score,
        place: index + 1,
        coinsEarned: Math.max(10, 50 - index * 10),
      }));

    this.gameEndedSignal.set({
      ranking,
      receivedAt: Date.now(),
    });
    this.finalBalance += ranking.find((entry) => entry.playerId === CURRENT_USER_ID)?.coinsEarned ?? 0;
    this.walletUpdatedSignal.set({
      balance: this.finalBalance,
      receivedAt: Date.now(),
    });
    this.emitGameState('SIM_GAME_FINISHED');
    this.pushLog(reason);
  }

  private handleStorySubmission(payload: Record<string, unknown>): void {
    const storyteller = this.requirePlayer(CURRENT_USER_ID);
    const clue = (readString(payload['clue']) ?? this.clue) || 'Pista simulada';
    const cardId = readCardCode(payload['cardId']) ?? storyteller.hand[0];
    if (!cardId) {
      return;
    }

    storyteller.playedCardCode = cardId;
    storyteller.hand = storyteller.hand.filter((cardCode) => cardCode !== cardId);
    this.storytellerId = CURRENT_USER_ID;
    this.clue = clue;
    this.phase = 'choice';
    this.autoSubmitBotCards();
    this.emitPrivateHand();
    this.emitGameState('SEND_STORY');
    this.pushLog(`Story enviada con ${cardId} y pista "${clue}".`);
  }

  private handleCardSubmission(payload: Record<string, unknown>): void {
    const currentPlayer = this.requirePlayer(CURRENT_USER_ID);
    const cardId = readCardCode(payload['cardId']) ?? currentPlayer.hand[0];
    if (!cardId) {
      return;
    }

    currentPlayer.playedCardCode = cardId;
    currentPlayer.hand = currentPlayer.hand.filter((cardCode) => cardCode !== cardId);
    this.autoSubmitBotCards();

    if (this.storytellerId !== CURRENT_USER_ID) {
      this.ensureStorytellerSubmission();
    }

    this.phase = 'choice';
    this.emitPrivateHand();
    this.emitGameState('SUBMIT_CARD');
    this.pushLog(`Carta enviada: ${cardId}.`);
  }

  private handleVoteSubmission(payload: Record<string, unknown>): void {
    const currentPlayer = this.requirePlayer(CURRENT_USER_ID);
    const cardId = readCardCode(payload['cardId']);
    if (!cardId || cardId === currentPlayer.playedCardCode) {
      return;
    }

    currentPlayer.voteCardCode = cardId;
    this.autoVoteBots();
    this.pushLog(`Voto emitido hacia ${cardId}.`);

    if (this.hasAllExpectedVotes()) {
      this.emitGameState('CAST_VOTE');
      this.scheduleRevealTransition();
      return;
    }

    this.emitGameState('CAST_VOTE');
  }

  private resolveDuel(payload: Record<string, unknown>): void {
    const targetId = readString(payload['targetId']) ?? this.players[1]?.id ?? 'u_mara';
    this.duelChallengeSignal.set(null);
    this.startMinigame(0, true);
    this.pushLog(`Duelo resuelto contra ${this.playerName(targetId)}.`);
  }

  private advanceToNextRound(): void {
    this.roundNumber += 1;
    const nextStorytellerIndex =
      (this.players.findIndex((player) => player.id === this.storytellerId) + 1) % this.players.length;
    this.storytellerId = this.players[nextStorytellerIndex]?.id ?? CURRENT_USER_ID;
    this.phase = 'hand';
    this.clue = this.storytellerId === CURRENT_USER_ID ? '' : `Pista de ${this.playerName(this.storytellerId)}`;
    this.dealHandsForRound();
    this.ensureStorytellerSubmission();
    this.emitPrivateHand();
    this.emitGameState('NEXT_ROUND');
    this.pushLog(`Nueva ronda ${this.roundNumber} iniciada.`);
  }

  private ensureStorytellerSubmission(): void {
    const storyteller = this.requirePlayer(this.storytellerId);
    if (storyteller.playedCardCode) {
      return;
    }

    storyteller.playedCardCode = storyteller.hand[0] ?? null;
    if (storyteller.playedCardCode) {
      storyteller.hand = storyteller.hand.filter((cardCode) => cardCode !== storyteller.playedCardCode);
    }
  }

  private autoSubmitBotCards(): void {
    for (const player of this.players) {
      if (player.id === this.storytellerId || player.id === CURRENT_USER_ID || player.playedCardCode) {
        continue;
      }

      const nextCardCode = player.hand[0] ?? null;
      player.playedCardCode = nextCardCode;
      if (nextCardCode) {
        player.hand = player.hand.filter((cardCode) => cardCode !== nextCardCode);
      }
    }
  }

  private ensureCurrentPlayerVote(): void {
    const currentPlayer = this.requirePlayer(CURRENT_USER_ID);
    if (this.storytellerId === CURRENT_USER_ID || currentPlayer.voteCardCode) {
      return;
    }

    const fallbackVote = this.availableVoteTargets(currentPlayer.id)[0] ?? null;
    currentPlayer.voteCardCode = fallbackVote;
  }

  private autoVoteBots(): void {
    for (const player of this.players) {
      if (player.id === this.storytellerId || player.id === CURRENT_USER_ID || player.voteCardCode) {
        continue;
      }

      player.voteCardCode = this.availableVoteTargets(player.id)[0] ?? null;
    }
  }

  private availableVoteTargets(voterId: string): string[] {
    const ownCardCode = this.findPlayerById(voterId)?.playedCardCode ?? null;
    return this.boardCards().filter((cardCode) => cardCode !== ownCardCode);
  }

  private applyVoteScores(): void {
    const voteCounts = new Map<string, number>();
    for (const player of this.players) {
      if (!player.voteCardCode) {
        continue;
      }

      voteCounts.set(player.voteCardCode, (voteCounts.get(player.voteCardCode) ?? 0) + 1);
    }

    for (const player of this.players) {
      const ownCardCode = player.playedCardCode;
      if (!ownCardCode) {
        continue;
      }

      player.score += voteCounts.get(ownCardCode) ?? 0;
    }
  }

  private emitGameState(lastAction: string): void {
    const playedCards = Object.fromEntries(
      this.players
        .filter((player) => player.playedCardCode)
        .map((player) => [player.id, player.playedCardCode as string])
    );
    const boardCards = this.boardCards();
    const votes = this.players
      .filter((player) => player.voteCardCode)
      .map((player) => ({
        voterId: player.id,
        targetCardId: player.voteCardCode as string,
      }));
    const state: Record<string, unknown> = {
      phase: this.mapPhaseForRealtime(),
      roundNumber: this.roundNumber,
      activeModifiers: { ...this.activeModifiers },
      players: this.players.map((player) => ({
        id: player.id,
        username: player.username,
        score: player.score,
      })),
      scores: Object.fromEntries(this.players.map((player) => [player.id, player.score])),
      currentRound: {
        storytellerId: this.storytellerId,
        clue: this.clue,
      currentClue: this.clue,
        storytellerCardId: this.findPlayerById(this.storytellerId)?.playedCardCode,
        boardCards,
        playedCards,
        votes,
        players: this.players.map((player) => ({
          id: player.id,
          username: player.username,
          hand: player.id === CURRENT_USER_ID ? [...player.hand] : undefined,
          playedCardCode: player.playedCardCode,
          voteCardCode: player.voteCardCode,
        })),
      },
    };

    this.gameStateSignal.set({
      state,
      lastAction,
      receivedAt: Date.now(),
    });
    this.snapshotSignal.set({
      lobbyCode: this.lobbyCode,
      phase: this.phase,
      roundNumber: this.roundNumber,
      storytellerId: this.storytellerId,
      clue: this.clue,
      boardCards,
      playedCards,
      votes: votes.map((entry) => ({
        voterId: entry.voterId,
        targetCardCode: String(entry.targetCardId),
      })),
      activeModifiers: { ...this.activeModifiers },
      lastMinigameResolution: this.lastMinigameResolution,
      players: this.players.map((player) => ({
        id: player.id,
        username: player.username,
        score: player.score,
        hand: [...player.hand],
        playedCardCode: player.playedCardCode,
        voteCardCode: player.voteCardCode,
      })),
    });
  }

  private emitPrivateHand(): void {
    const currentPlayer = this.requirePlayer(CURRENT_USER_ID);
    this.privateHandSignal.set({
      lobbyCode: this.lobbyCode,
      hand: [...currentPlayer.hand],
      receivedAt: Date.now(),
    });
  }

  private publishLobbyState(): void {
    const players: RealtimeLobbyPlayer[] = this.players.map((player) => ({
      id: player.id,
      username: player.username,
    }));

    this.lobbyStateSignal.set({
      id: `sim-${this.lobbyCode.toLowerCase()}`,
      code: this.lobbyCode,
      hostId: CURRENT_USER_ID,
      players,
    });
  }

  private dealHandsForRound(): void {
    for (let playerIndex = 0; playerIndex < this.players.length; playerIndex += 1) {
      const nextHand: string[] = [];
      const startOffset = (this.roundNumber - 1) * this.players.length + playerIndex * 6;
      for (let cardIndex = 0; cardIndex < 6; cardIndex += 1) {
        nextHand.push(TEST_CARD_LIBRARY[(startOffset + cardIndex) % TEST_CARD_LIBRARY.length]);
      }

      this.players[playerIndex] = {
        ...this.players[playerIndex],
        hand: nextHand,
        playedCardCode: null,
        voteCardCode: null,
      };
    }
  }

  private boardCards(): string[] {
    return this.players
      .map((player) => player.playedCardCode)
      .filter((cardCode): cardCode is string => !!cardCode);
  }

  private mapPhaseForRealtime(): string {
    switch (this.phase) {
      case 'choice':
        return 'VOTING';
      case 'points-reveal':
        return 'SCORING';
      case 'points-ranking':
        return 'RANKING';
      case 'finished':
        return 'FINISHED';
      case 'hand':
      default:
        return 'HAND';
    }
  }

  private playerName(playerId: string): string {
    return this.findPlayerById(playerId)?.username ?? playerId;
  }

  private findPlayerById(playerId: string): SimulatorPlayerState | undefined {
    return this.players.find((player) => player.id === playerId);
  }

  private requirePlayer(playerId: string): SimulatorPlayerState {
    const player = this.findPlayerById(playerId);
    if (!player) {
      throw new Error(`No existe el jugador simulado ${playerId}.`);
    }

    return player;
  }

  private pushLog(message: string): void {
    this.logSequence += 1;
    const entry: DixitSimulatorLogEntry = {
      id: this.logSequence,
      timestamp: new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      message,
    };
    this.logEntriesSignal.update((entries) => [...entries.slice(-39), entry]);
  }

  private resolveActiveMinigame(
    reason: 'manual_close' | 'timeout' | 'cancelled'
  ): void {
    const activeMinigame = this.activeMinigameSignal();
    if (!activeMinigame) {
      return;
    }

    this.clearMinigameTimeout();
    this.clearMinigameResolutionEmitTimeout();
    this.activeMinigameSignal.set(null);
    this.duelChallengeSignal.set(null);

    const payload = {
      lobbyCode: this.lobbyCode,
      minigameType: activeMinigame.type,
      isDuel: activeMinigame.isDuel,
      duration: activeMinigame.duration,
      reason,
      resolvedAt: new Date().toISOString(),
      actorId: CURRENT_USER_ID,
    };

    this.lastMinigameResolution = {
      type: activeMinigame.type,
      isDuel: activeMinigame.isDuel,
      reason,
      payload,
    };
    this.emitGameState('SIM_MINIGAME_RESOLVED');
    this.pushLog(
      `Emit websocket simulado: client:game:minigame_result ${JSON.stringify(payload)}`
    );
  }

  private scheduleMinigameTimeout(durationMs: number): void {
    this.minigameTimeoutId = setTimeout(() => {
      this.minigameTimeoutId = null;
      this.completeActiveMinigameByTimeout();
    }, durationMs);
  }

  private clearMinigameTimeout(): void {
    if (this.minigameTimeoutId === null) {
      return;
    }

    clearTimeout(this.minigameTimeoutId);
    this.minigameTimeoutId = null;
  }

  private clearMinigameResolutionEmitTimeout(): void {
    if (this.minigameResolutionEmitTimeoutId === null) {
      return;
    }

    clearTimeout(this.minigameResolutionEmitTimeoutId);
    this.minigameResolutionEmitTimeoutId = null;
  }

  private resolveMinigameFromScores(
    activeMinigame: RealtimeMinigameStart,
    currentPlayerScore: number
  ): void {
    if (this.activeMinigameSignal()?.receivedAt !== activeMinigame.receivedAt) {
      return;
    }

    const opponentId =
      activeMinigame.player1 === CURRENT_USER_ID ? activeMinigame.player2 : activeMinigame.player1;
    const opponentScore = this.simulateOpponentMinigameScore(activeMinigame.type, currentPlayerScore);
    const winnerId = currentPlayerScore >= opponentScore ? CURRENT_USER_ID : opponentId;
    const loserId = winnerId === CURRENT_USER_ID ? opponentId : CURRENT_USER_ID;
    const winnerName = this.playerName(winnerId);
    const loserName = this.playerName(loserId);

    if (activeMinigame.isDuel) {
      const winner = this.requirePlayer(winnerId);
      const loser = this.requirePlayer(loserId);
      winner.score += 2;
      loser.score = Math.max(0, loser.score - 2);
      this.emitGameState('SIM_MINIGAME_STATE_UPDATED');
    }

    this.specialEventSignal.set({
      effect: 'CONFLICT_RESOLVED',
      message: `¡${winnerName} ha ganado el ${activeMinigame.isDuel ? 'Duelo' : 'desempate'} contra ${loserName}!`,
      winnerId,
      loserId,
      isDuel: activeMinigame.isDuel,
      receivedAt: Date.now(),
    });
    this.pushLog(
      `Resolucion simulada del minijuego: ${winnerName} (${currentPlayerScore} vs ${opponentScore}).`
    );
  }

  private simulateOpponentMinigameScore(type: number, currentPlayerScore: number): number {
    const baseline = type === 1 ? 6 : 4;
    const variance = (this.roundNumber + type + currentPlayerScore) % 5;
    return Math.max(0, baseline + variance);
  }

  private hasAllExpectedVotes(): boolean {
    const expectedVotes = this.players.filter((player) => player.id !== this.storytellerId).length;
    const submittedVotes = this.players.filter(
      (player) => player.id !== this.storytellerId && !!player.voteCardCode
    ).length;

    return expectedVotes > 0 && submittedVotes >= expectedVotes;
  }

  private scheduleRevealTransition(): void {
    if (this.phase !== 'choice') {
      return;
    }

    this.clearRevealTransitionTimeout();
    this.pushLog('Todos los votos estan listos. Preparando reveal automatico.');
    this.revealTransitionTimeoutId = setTimeout(() => {
      this.revealTransitionTimeoutId = null;
      this.openRevealPhase();
    }, 650);
  }

  private clearRevealTransitionTimeout(): void {
    if (this.revealTransitionTimeoutId === null) {
      return;
    }

    clearTimeout(this.revealTransitionTimeoutId);
    this.revealTransitionTimeoutId = null;
  }
}

function normalizeLobbyCode(lobbyCode: string): string {
  return lobbyCode.trim().toUpperCase();
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readCardCode(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return readString(value);
}
