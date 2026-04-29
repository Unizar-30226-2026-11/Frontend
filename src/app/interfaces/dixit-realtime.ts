import type { LobbyEngine } from './game';

export type DixitConnectionStatus =
  | 'idle'
  | 'joining'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type DixitGameActionType =
  | 'SEND_STORY'
  | 'SUBMIT_CARD'
  | 'SUBMIT_MINIGAME_SCORE'
  | 'CAST_VOTE'
  | 'NEXT_ROUND'
  | 'RESOLVE_DUEL'
  | 'CHANGE_MODE'
  | 'STELLA_SUBMIT_MARKS'
  | 'STELLA_REVEAL_MARK';

export interface LobbyJoinResponse {
  message?: string;
  ticket?: string;
  token?: string;
  code?: string;
  wsToken?: string;
  socketUrl?: string;
  wsUrl?: string;
  websocket?: Record<string, unknown>;
  ws?: Record<string, unknown>;
  lobby?: Record<string, unknown>;
}

export interface RealtimeLobbyPlayer {
  id: string;
  username: string;
}

export interface RealtimeLobbyState {
  id: string;
  code: string;
  hostId: string;
  players: RealtimeLobbyPlayer[];
}

export interface RealtimeGameStateUpdate {
  state: Record<string, unknown>;
  lastAction?: string;
  receivedAt: number;
}

export interface RealtimeGameStarted {
  lobbyCode: string;
  state?: Record<string, unknown>;
  engine?: LobbyEngine;
  receivedAt: number;
}

export interface RealtimeGameEndedRankingEntry {
  playerId: string;
  points: number;
  place: number;
  coinsEarned: number;
}

export interface RealtimeGameEnded {
  ranking: RealtimeGameEndedRankingEntry[];
  error?: string;
  receivedAt: number;
}

export interface RealtimeWalletUpdated {
  balance: number;
  receivedAt: number;
}

export interface RealtimePrivateHand {
  lobbyCode: string;
  hand: RealtimePrivateHandEntry[];
  receivedAt: number;
}

export type RealtimePrivateHandEntry =
  | number
  | string
  | {
      id?: unknown;
      cardId?: unknown;
      card_id?: unknown;
      code?: unknown;
      url_image?: unknown;
      image?: unknown;
      imageUrl?: unknown;
      image_url?: unknown;
      title?: unknown;
      name?: unknown;
      value?: unknown;
      suit?: unknown;
      collection?: unknown;
    };

export interface RealtimeChatMessage {
  username: string;
  text: string;
  timestamp: string;
}

export interface RealtimeSession {
  lobbyCode: string;
  ticket?: string;
  authToken?: string;
  socketUrl: string;
  joinedAt: string;
  joinOnConnect?: boolean;
}

export interface RealtimeToast {
  id: number;
  message: string;
}

export interface RealtimeDuelChallenge {
  challengerId: string;
  receivedAt: number;
}

export interface RealtimeMinigameStart {
  player1: string;
  player2: string;
  type: number;
  duration: number;
  isDuel: boolean;
  receivedAt: number;
}

export interface RealtimeSpecialEvent {
  effect: string;
  message: string;
  winnerId?: string;
  loserId?: string;
  isDuel?: boolean;
  receivedAt: number;
}

// Punto expresado en porcentaje de pantalla. El backend envía 0..100
// y el frontend lo proyecta directamente sobre un overlay fixed.
export interface RealtimeStarPoint {
  x: number;
  y: number;
}

// Payload normalizado de una estrella fugaz activa. Se conserva receivedAt
// para poder descartar o coordinar estados tardíos si hiciera falta.
export interface RealtimeStarSpawn {
  starId: string;
  path: {
    start: RealtimeStarPoint;
    end: RealtimeStarPoint;
  };
  duration: number;
  receivedAt: number;
}

// Resultado de la captura de la estrella. El backend devuelve el ganador
// y las puntuaciones completas ya recalculadas con el +3 aplicado.
export interface RealtimeStarClaim {
  winnerId: string;
  newScores: Record<string, number>;
  receivedAt: number;
}
