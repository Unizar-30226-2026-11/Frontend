import { Injectable } from '@angular/core';
import { PlayerInfo } from '../interfaces/player-info';
@Injectable({
  providedIn: 'root',
})
export class PlayerInfoPull {
  private readonly playerInfoEndpoint = 'https://jsonplaceholder.typicode.com/users/1';
  private readonly cache = new Map<string, PlayerInfo>();

  getPlayerInfo(
    username: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<PlayerInfo> {
    const cacheKey = this.getCacheKey(username);
    const cachedPlayer = this.cache.get(cacheKey);
    if (cachedPlayer && !options.forceRefresh) {
      return Promise.resolve(cachedPlayer);
    }

    return this.fetchPlayerInfo(username).then((playerInfo) => {
      this.cache.set(cacheKey, playerInfo);
      return playerInfo;
    });
  }

  savePlayerInfoToCache(playerInfo: PlayerInfo): void {
    this.cache.set(this.getCacheKey(playerInfo.username), playerInfo);
  }

  invalidatePlayerInfo(username: string): void {
    this.cache.delete(this.getCacheKey(username));
  }

  private async fetchPlayerInfo(username: string): Promise<PlayerInfo> {
    const response = await fetch(this.playerInfoEndpoint);
    if (!response.ok) {
      throw new Error('No se pudo cargar la informacion del jugador');
    }

    const data: unknown = await response.json();
    if (!this.isUserResponse(data)) {
      throw new Error('Formato de respuesta invalido para la informacion del jugador');
    }

    const normalizedUsername = username.trim() || data.username || 'player';
    const hash = normalizedUsername
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    return {
      id: String(data.id),
      username: normalizedUsername,
      coins: 1000 + hash * 7,
      level: 1 + (hash % 30),
    };
  }

  private getCacheKey(username: string): string {
    const normalizedUsername = username.trim().toLowerCase() || 'anonymous';
    return `player:info:${normalizedUsername}`;
  }

  private isUserResponse(value: unknown): value is { id: number; username?: string } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as { id?: unknown; username?: unknown };
    const usernameIsValid =
      typeof candidate.username === 'undefined' || typeof candidate.username === 'string';
    return typeof candidate.id === 'number' && usernameIsValid;
  }
}
