export type LobbyEngine = 'Classic' | 'Stella';

export interface LobbySummaryApi {
  lobbyCode: string;
  name: string;
  hostId: string;
  players: string[];
  maxPlayers: number;
  engine: LobbyEngine;
  status: string;
}

export interface LobbyDetailsApi extends LobbySummaryApi {
  isPrivate: boolean;
}

export interface LobbyListResponse {
  lobbies: LobbySummaryApi[];
}

export interface CreateLobbyPayload {
  name: string;
  maxPlayers: number;
  engine: LobbyEngine;
  isPrivate: boolean;
}

export interface CreateLobbyResponse {
  message?: string;
  lobby?: {
    lobbyCode?: string;
    status?: string;
  } & LobbyDetailsApi;
}

export interface LobbyDetailsResponse {
  message: string;
  lobby: LobbyDetailsApi;
}

export interface LobbyStartApi {
  lobbyCode?: string;
  status?: string;
}

export interface StartedGameApi {
  id?: string;
  route?: string;
  engine?: LobbyEngine;
}

export interface LobbyStartResponse {
  message?: string;
  lobby?: LobbyStartApi;
  game?: StartedGameApi;
}

export interface LobbyStartResult {
  message: string;
  lobbyCode: string;
  status: string;
  route: string;
}

export interface LobbyCreationResult {
  message: string;
  lobbyCode: string;
  route: string;
}

export interface Game {
  id: string;
  title: string;
  description: string;
  image: string;
  hostId: string;
  players: string[];
  playerCount: number;
  maxPlayers: number;
  engine: LobbyEngine;
  status: string;
  isPrivate: boolean;
}

export function buildGameRoute(gameId: string, engine: LobbyEngine = 'Classic'): string {
  const encodedGameId = encodeURIComponent(gameId);
  return engine === 'Stella' ? `/dixit-stella/${encodedGameId}` : `/dixit/${encodedGameId}`;
}
