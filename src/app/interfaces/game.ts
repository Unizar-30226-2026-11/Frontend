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

export interface LobbyDetailsResponse {
  message: string;
  lobby: LobbyDetailsApi;
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
