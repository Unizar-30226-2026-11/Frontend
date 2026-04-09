import { Injectable, inject } from '@angular/core';
import {
  CreateLobbyPayload,
  CreateLobbyResponse,
  Game,
  LobbyCreationResult,
  LobbyDetailsApi,
  LobbyDetailsResponse,
  LobbyListResponse,
  LobbyStartResponse,
  LobbyStartResult,
  LobbySummaryApi,
} from '../interfaces/game';
import { Auth } from './auth';
import { ApiClient } from './api-client';

@Injectable({
  providedIn: 'root',
})
export class GamesPull {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly lobbyImage = '/assets/Tablero.png';

  getGames(
    page: number,
    pageSize: number,
    options: { forceRefresh?: boolean; search?: string } = {}
  ): Promise<Game[]> {
    const token = this.requireToken();
    const search = options.search?.trim();
    const path = search ? `/lobbies?search=${encodeURIComponent(search)}` : '/lobbies';

    return this.apiClient
      .request<LobbyListResponse>(path, {
        token,
        ttlMs: 30_000,
        forceRefresh: options.forceRefresh,
      })
      .then(({ lobbies }) =>
        lobbies
          .map((lobby) => this.toGame(lobby))
          .slice((page - 1) * pageSize, page * pageSize)
      );
  }

  getGameDetails(lobbyCode: string, options: { forceRefresh?: boolean } = {}): Promise<Game> {
    const token = this.requireToken();

    return this.apiClient
      .request<LobbyDetailsResponse>(`/lobbies/${encodeURIComponent(lobbyCode)}`, {
        token,
        ttlMs: 30_000,
        forceRefresh: options.forceRefresh,
      })
      .then(({ lobby }) => this.toGame(lobby));
  }

  createLobby(payload: CreateLobbyPayload): Promise<LobbyCreationResult> {
    const token = this.requireToken();

    return this.apiClient
      .request<CreateLobbyResponse>('/lobbies', {
        method: 'POST',
        token,
        body: payload,
        useCache: false,
      })
      .then((response) => {
        const lobbyCode = response.lobby?.lobbyCode?.trim();
        if (!lobbyCode) {
          throw new Error('La API no devolvio el codigo de la nueva sala');
        }

        this.clearCache();

        return {
          message: response.message?.trim() || 'Sala creada correctamente.',
          lobbyCode,
          route: `/games/${encodeURIComponent(lobbyCode)}`,
        };
      });
  }

  startLobby(lobbyCode: string): Promise<LobbyStartResult> {
    const token = this.requireToken();
    const encodedLobbyCode = encodeURIComponent(lobbyCode);

    // TODO: confirmar el contrato final del endpoint de arranque cuando backend lo cierre.
    return this.apiClient
      .request<LobbyStartResponse>(`/lobbies/${encodedLobbyCode}/start`, {
        method: 'POST',
        token,
        useCache: false,
      })
      .then((response) => {
        const resolvedLobbyCode = response.lobby?.lobbyCode?.trim() || lobbyCode;

        this.clearCache();

        return {
          message:
            response.message?.trim() || 'Partida iniciada. Preparando el tablero de juego.',
          lobbyCode: resolvedLobbyCode,
          status: response.lobby?.status?.trim() || 'starting',
          route: this.resolveLobbyStartRoute(response, resolvedLobbyCode),
        };
      });
  }

  clearCache(): void {
    this.apiClient.invalidateCache('/lobbies');
  }

  private toGame(lobby: LobbySummaryApi | LobbyDetailsApi): Game {
    const playerCount = lobby.players.length;
    const isPrivate = 'isPrivate' in lobby ? lobby.isPrivate : false;
    const statusLabel = lobby.status === 'waiting' ? 'Esperando jugadores' : lobby.status;
    const visibilityLabel = isPrivate ? 'Privada' : 'Publica';

    return {
      id: lobby.lobbyCode,
      title: lobby.name,
      description: `${lobby.engine} - ${playerCount}/${lobby.maxPlayers} jugadores - ${statusLabel} - ${visibilityLabel}`,
      image: this.lobbyImage,
      hostId: lobby.hostId,
      players: lobby.players,
      playerCount,
      maxPlayers: lobby.maxPlayers,
      engine: lobby.engine,
      status: lobby.status,
      isPrivate,
    };
  }

  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para consultar las salas');
    }
    return token;
  }

  private resolveLobbyStartRoute(
    response: LobbyStartResponse,
    fallbackLobbyCode: string
  ): string {
    const rawRoute = response.game?.route?.trim();
    if (rawRoute) {
      return rawRoute.startsWith('/') ? rawRoute : `/${rawRoute}`;
    }

    const gameId = response.game?.id?.trim() || fallbackLobbyCode;
    return `/dixit/${encodeURIComponent(gameId)}`;
  }
}
