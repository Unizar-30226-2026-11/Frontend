import { Injectable, inject } from '@angular/core';
import {
  PlayerInfo,
  UserBalanceResponse,
  UserProfileApi,
  UserProfileResponse,
} from '../interfaces/player-info';
import { Auth } from './auth';
import { ApiClient } from './api-client';

@Injectable({
  providedIn: 'root',
})
export class PlayerInfoPull {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);

  getPlayerInfo(options: { forceRefresh?: boolean } = {}): Promise<PlayerInfo> {
    const token = this.requireToken();

    return Promise.all([
      this.apiClient.request<UserProfileResponse>('/users/profile', {
        token,
        ttlMs: 60_000,
        forceRefresh: options.forceRefresh,
      }),
      this.apiClient.request<UserBalanceResponse>('/users/balance', {
        token,
        ttlMs: 15_000,
        forceRefresh: options.forceRefresh,
      }),
    ]).then(([profileResponse, balanceResponse]) =>
      this.normalizePlayer(profileResponse.profile, balanceResponse.balance.balance)
    );
  }

  savePlayerInfoToCache(playerInfo: PlayerInfo): void {
    const token = this.requireToken();

    this.apiClient.setCache<UserProfileResponse>(
      this.apiClient.buildCacheKey('/users/profile', 'GET', token),
      {
        profile: {
          id_user: playerInfo.legacyUserId,
          username: playerInfo.username,
          email: playerInfo.email,
          exp_level: playerInfo.experienceLevel,
          progress_level: playerInfo.progressLevel,
          state: playerInfo.state,
          personal_state: playerInfo.personalState,
          id: playerInfo.id,
        },
      },
      60_000
    );

    this.apiClient.setCache<UserBalanceResponse>(
      this.apiClient.buildCacheKey('/users/balance', 'GET', token),
      {
        balance: {
          balance: playerInfo.balance,
        },
      },
      15_000
    );
  }

  invalidatePlayerInfo(): void {
    this.apiClient.invalidateCache('/users/profile');
    this.apiClient.invalidateCache('/users/balance');
  }

  private normalizePlayer(profile: UserProfileApi, balance: number): PlayerInfo {
    return {
      id: profile.id,
      legacyUserId: profile.id_user,
      username: profile.username,
      email: profile.email,
      experienceLevel: profile.exp_level,
      progressLevel: profile.progress_level,
      state: profile.state,
      personalState: profile.personal_state,
      balance,
    };
  }

  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para cargar tu perfil');
    }
    return token;
  }
}
