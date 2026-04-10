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
  receivedAt: number;
}

export interface RealtimePrivateHand {
  lobbyCode: string;
  hand: Array<number | string>;
  receivedAt: number;
}

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
