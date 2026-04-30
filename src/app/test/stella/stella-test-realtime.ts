import { Injectable, signal } from '@angular/core';
import type {
  DixitConnectionStatus,
  DixitGameActionType,
  RealtimeGameStateUpdate,
  RealtimeLobbyPlayer,
  RealtimeLobbyState,
} from '../../interfaces/dixit-realtime';

export interface StellaSimulatorLogEntry {
  id: number;
  timestamp: string;
  message: string;
}

export interface StellaSimulatorSnapshot {
  lobbyCode: string;
  phase: string;
  roundNumber: number;
  word: string;
  currentScoutId: string;
  boardCards: number[];
  revealedCards: number[];
  players: Array<{
    id: string;
    username: string;
    score: number;
    marks: number[];
    submitted: boolean;
    roundPoints: number;
    successfulAssociations: number;
    hasFallen: boolean;
  }>;
}

interface StellaSimPlayer {
  id: string;
  username: string;
  score: number;
  marks: number[];
  submitted: boolean;
  roundPoints: number;
  successfulAssociations: number;
  hasFallen: boolean;
}

const CURRENT_USER_ID = 'u_self';
const FALLBACK_LOBBY_CODE = 'TEST-STELLA';
const STELLA_WORDS = ['Luz', 'Bosque', 'Eco', 'Nebula', 'Memoria', 'Sueno'];
const STELLA_BOARD_LIBRARY = Array.from({ length: 24 }, (_, index) => index + 1);

@Injectable()
export class StellaRealtimeSimulator {
  private readonly connectionStatusSignal = signal<DixitConnectionStatus>('idle');
  private readonly lobbyStateSignal = signal<RealtimeLobbyState | null>(null);
  private readonly gameStateSignal = signal<RealtimeGameStateUpdate | null>(null);
  private readonly lastErrorSignal = signal('');
  private readonly snapshotSignal = signal<StellaSimulatorSnapshot | null>(null);
  private readonly logEntriesSignal = signal<StellaSimulatorLogEntry[]>([]);

  private lobbyCode = FALLBACK_LOBBY_CODE;
  private roundNumber = 1;
  private phase:
    | 'STELLA_WORD_REVEAL'
    | 'STELLA_MARKING'
    | 'STELLA_REVEAL'
    | 'SCORING'
    | 'FINISHED' = 'STELLA_WORD_REVEAL';
  private word = STELLA_WORDS[0];
  private boardCards: number[] = STELLA_BOARD_LIBRARY.slice(0, 15);
  private revealedCards: number[] = [];
  private currentScoutId = CURRENT_USER_ID;
  private darkPlayerId = '';
  private winners: string[] = [];
  private players: StellaSimPlayer[] = [];
  private logSequence = 0;

  constructor() {
    this.resetDemo();
  }

  lobbyState(): RealtimeLobbyState | null {
    return this.lobbyStateSignal();
  }

  gameState(): RealtimeGameStateUpdate | null {
    return this.gameStateSignal();
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

  simulatorSnapshot(): StellaSimulatorSnapshot | null {
    return this.snapshotSignal();
  }

  simulatorLogs(): StellaSimulatorLogEntry[] {
    return this.logEntriesSignal();
  }

  async ensureLobbyConnection(lobbyCode: string): Promise<void> {
    this.lobbyCode = normalizeLobbyCode(lobbyCode) || FALLBACK_LOBBY_CODE;
    this.connectionStatusSignal.set('joining');
    this.connectionStatusSignal.set('connecting');
    this.connectionStatusSignal.set('connected');
    this.publishLobbyState();
    this.emitGameState('SIM_CONNECTED');
    this.pushLog(`Conexion simulada Stella a la sala ${this.lobbyCode}.`);
  }

  disconnect(): void {
    this.connectionStatusSignal.set('disconnected');
    this.pushLog('Conexion simulada Stella cerrada.');
  }

  sendGameAction(actionType: DixitGameActionType, payload: Record<string, unknown> = {}): void {
    switch (actionType) {
      case 'STELLA_SUBMIT_MARKS':
        this.submitMarks(payload);
        return;
      case 'STELLA_REVEAL_MARK':
        this.revealMark(payload);
        return;
      case 'NEXT_ROUND':
        this.nextRound();
        return;
      default:
        this.pushLog(`Accion Stella ignorada: ${actionType}.`);
    }
  }

  resetDemo(): void {
    this.players = [
      this.createPlayer(CURRENT_USER_ID, 'Tester local'),
      this.createPlayer('u_mara', 'Mara'),
      this.createPlayer('u_teo', 'Teo'),
      this.createPlayer('u_lia', 'Lia'),
    ];
    this.roundNumber = 1;
    this.phase = 'STELLA_WORD_REVEAL';
    this.word = STELLA_WORDS[0];
    this.boardCards = STELLA_BOARD_LIBRARY.slice(0, 15);
    this.revealedCards = [];
    this.currentScoutId = CURRENT_USER_ID;
    this.darkPlayerId = '';
    this.winners = [];
    this.lastErrorSignal.set('');
    this.connectionStatusSignal.set('connected');
    this.publishLobbyState();
    this.emitGameState('SIM_RESET');
    this.pushLog('Sandbox de Stella reiniciado.');
  }

  setWord(word: string): void {
    this.word = word.trim() || this.word;
    this.emitGameState('SIM_WORD_UPDATED');
  }

  openMarkingPhase(): void {
    this.phase = 'STELLA_MARKING';
    this.players = this.players.map((player) => ({
      ...player,
      submitted: false,
      marks: player.id === CURRENT_USER_ID ? player.marks : this.buildDefaultMarks(player.id),
      roundPoints: 0,
      successfulAssociations: 0,
      hasFallen: false,
    }));
    this.revealedCards = [];
    this.emitGameState('SIM_MARKING_OPENED');
    this.pushLog('Fase de marcado Stella abierta.');
  }

  openRevealPhase(): void {
    this.phase = 'STELLA_REVEAL';
    this.ensureBotsSubmitted();
    this.currentScoutId = this.players.find((player) => player.marks.length > 0)?.id ?? CURRENT_USER_ID;
    this.emitGameState('SIM_REVEAL_OPENED');
    this.pushLog(`Reveal Stella abierto. Scout: ${this.playerName(this.currentScoutId)}.`);
  }

  openScoringPhase(): void {
    this.phase = 'SCORING';
    this.ensureBotsSubmitted();
    this.revealedCards = Array.from(
      new Set(this.players.flatMap((player) => player.marks.slice(0, Math.min(player.marks.length, 2))))
    );
    this.applyScoring();
    this.emitGameState('SIM_SCORING_OPENED');
    this.pushLog('Scoring Stella calculado.');
  }

  finishGame(): void {
    this.phase = 'FINISHED';
    const maxScore = Math.max(...this.players.map((player) => player.score));
    this.winners = this.players.filter((player) => player.score === maxScore).map((player) => player.id);
    this.emitGameState('SIM_FINISHED');
    this.pushLog('Partida Stella finalizada.');
  }

  advanceScout(): void {
    const revealablePlayers = this.players.filter(
      (player) => player.marks.some((cardId) => !this.revealedCards.includes(cardId))
    );
    if (revealablePlayers.length === 0) {
      return;
    }

    const currentIndex = revealablePlayers.findIndex((player) => player.id === this.currentScoutId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % revealablePlayers.length : 0;
    this.currentScoutId = revealablePlayers[nextIndex].id;
    this.emitGameState('SIM_SCOUT_ADVANCED');
  }

  private submitMarks(payload: Record<string, unknown>): void {
    const cardIds = Array.isArray(payload['cardIds'])
      ? payload['cardIds']
          .map((entry) =>
            typeof entry === 'number' ? entry : typeof entry === 'string' ? Number(entry) : NaN
          )
          .filter((entry) => Number.isFinite(entry))
      : [];
    const currentPlayer = this.requirePlayer(CURRENT_USER_ID);
    currentPlayer.marks = cardIds.slice(0, 10);
    currentPlayer.submitted = true;
    this.ensureBotsSubmitted();
    this.emitGameState('STELLA_SUBMIT_MARKS');
    this.pushLog(`Marcas Stella enviadas: ${currentPlayer.marks.join(', ') || 'sin marcas'}.`);
  }

  private revealMark(payload: Record<string, unknown>): void {
    const cardId =
      typeof payload['cardId'] === 'number'
        ? payload['cardId']
        : typeof payload['cardId'] === 'string'
          ? Number(payload['cardId'])
          : NaN;
    if (!Number.isFinite(cardId) || this.revealedCards.includes(cardId)) {
      return;
    }

    const currentScout = this.requirePlayer(this.currentScoutId);
    if (!currentScout.marks.includes(cardId)) {
      return;
    }

    this.revealedCards = [...this.revealedCards, cardId];
    this.pushLog(
      `${currentScout.username} revela la carta ${cardId}.`
    );
    this.advanceScout();
    this.emitGameState('STELLA_REVEAL_MARK');
  }

  private nextRound(): void {
    this.roundNumber += 1;
    this.phase = 'STELLA_WORD_REVEAL';
    this.word = STELLA_WORDS[(this.roundNumber - 1) % STELLA_WORDS.length];
    this.boardCards = STELLA_BOARD_LIBRARY.slice(this.roundNumber - 1, this.roundNumber - 1 + 15);
    this.revealedCards = [];
    this.darkPlayerId = '';
    this.winners = [];
    this.players = this.players.map((player) => ({
      ...player,
      marks: [],
      submitted: false,
      roundPoints: 0,
      successfulAssociations: 0,
      hasFallen: false,
    }));
    this.currentScoutId = this.players[0]?.id ?? CURRENT_USER_ID;
    this.emitGameState('NEXT_ROUND');
    this.pushLog(`Nueva ronda Stella ${this.roundNumber}.`);
  }

  private applyScoring(): void {
    const revealedSet = new Set(this.revealedCards);
    this.darkPlayerId = '';
    let lowestMarks = Number.POSITIVE_INFINITY;

    this.players = this.players.map((player) => {
      const successfulAssociations = player.marks.filter((cardId) => revealedSet.has(cardId)).length;
      const penalty = player.marks.length === 0 ? 0 : Math.max(0, player.marks.length - successfulAssociations - 1);
      const roundPoints = successfulAssociations * 2 - penalty;
      const nextScore = Math.max(0, player.score + roundPoints);

      if (player.marks.length > 0 && player.marks.length < lowestMarks) {
        lowestMarks = player.marks.length;
        this.darkPlayerId = player.id;
      }

      return {
        ...player,
        score: nextScore,
        roundPoints,
        successfulAssociations,
        hasFallen: successfulAssociations === 0 && player.marks.length > 0,
      };
    });
  }

  private ensureBotsSubmitted(): void {
    this.players = this.players.map((player) =>
      player.id === CURRENT_USER_ID
        ? player
        : {
            ...player,
            marks: player.marks.length > 0 ? player.marks : this.buildDefaultMarks(player.id),
            submitted: true,
          }
    );
  }

  private buildDefaultMarks(playerId: string): number[] {
    const playerIndex = this.players.findIndex((player) => player.id === playerId);
    const offset = playerIndex >= 0 ? playerIndex : 0;
    return this.boardCards.filter((_, index) => (index + offset) % 4 === 0).slice(0, 4);
  }

  private emitGameState(lastAction: string): void {
    const scores = Object.fromEntries(this.players.map((player) => [player.id, player.score]));
    const playerMarks = Object.fromEntries(this.players.map((player) => [player.id, [...player.marks]]));
    const roundScores = Object.fromEntries(this.players.map((player) => [player.id, player.roundPoints]));
    const successfulMarks = Object.fromEntries(
      this.players.map((player) => [player.id, player.successfulAssociations])
    );

    this.gameStateSignal.set({
      state: {
        mode: 'STELLA',
        phase: this.phase,
        roundNumber: this.roundNumber,
        players: this.players.map((player) => player.id),
        scores,
        winners: [...this.winners],
        currentRound: {
          word: this.word,
          boardCards: [...this.boardCards],
          playerMarks,
          revealedCards: [...this.revealedCards],
          currentScoutId: this.currentScoutId,
          inTheDarkPlayerId: this.darkPlayerId,
          roundScores,
          successfulMarks,
          fallenPlayers: this.players.filter((player) => player.hasFallen).map((player) => player.id),
        },
      },
      lastAction,
      receivedAt: Date.now(),
    });

    this.snapshotSignal.set({
      lobbyCode: this.lobbyCode,
      phase: this.phase,
      roundNumber: this.roundNumber,
      word: this.word,
      currentScoutId: this.currentScoutId,
      boardCards: [...this.boardCards],
      revealedCards: [...this.revealedCards],
      players: this.players.map((player) => ({
        id: player.id,
        username: player.username,
        score: player.score,
        marks: [...player.marks],
        submitted: player.submitted,
        roundPoints: player.roundPoints,
        successfulAssociations: player.successfulAssociations,
        hasFallen: player.hasFallen,
      })),
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

  private createPlayer(id: string, username: string): StellaSimPlayer {
    return {
      id,
      username,
      score: 0,
      marks: [],
      submitted: false,
      roundPoints: 0,
      successfulAssociations: 0,
      hasFallen: false,
    };
  }

  private requirePlayer(playerId: string): StellaSimPlayer {
    const player = this.players.find((entry) => entry.id === playerId);
    if (!player) {
      throw new Error(`No existe el jugador Stella ${playerId}.`);
    }

    return player;
  }

  private playerName(playerId: string): string {
    return this.players.find((player) => player.id === playerId)?.username ?? playerId;
  }

  private pushLog(message: string): void {
    this.logSequence += 1;
    const entry: StellaSimulatorLogEntry = {
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
}

function normalizeLobbyCode(lobbyCode: string): string {
  return lobbyCode.trim().toUpperCase();
}
