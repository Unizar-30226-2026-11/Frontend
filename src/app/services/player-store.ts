import { Injectable, inject, signal } from '@angular/core';
import { PlayerInfo } from '../interfaces/player-info';
import { PlayerInfoPull } from './player-info-pull';

@Injectable({
  providedIn: 'root',
})
export class PlayerStore {
  private readonly playerInfoPull = inject(PlayerInfoPull);

  player = signal<PlayerInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  loadPlayer(username: string, options: { forceRefresh?: boolean } = {}): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    return this.playerInfoPull
      .getPlayerInfo(username, options)
      .then((playerInfo) => {
        this.player.set(playerInfo);
      })
      .catch((error: unknown) => {
        this.player.set(null);
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Ha ocurrido un error cargando la informacion del jugador'
        );
      })
      .finally(() => {
        this.loading.set(false);
      });
  }

  canAfford(amount: number): boolean {
    // const currentPlayer = this.player();
    // if (!currentPlayer) {
    //   return false;
    // }
    // return currentPlayer.coins >= amount;
    return true;
  }

  spendCoins(amount: number): boolean {
    const currentPlayer = this.player();
    if (!currentPlayer || currentPlayer.coins < amount) {
      return false;
    }

    const updatedPlayer = {
      ...currentPlayer,
      coins: currentPlayer.coins - amount,
    };
    this.player.set(updatedPlayer);
    this.playerInfoPull.savePlayerInfoToCache(updatedPlayer);
    return true;
  }

  updateCoins(nextCoins: number): void {
    const currentPlayer = this.player();
    if (!currentPlayer) {
      return;
    }
    const updatedPlayer = {
      ...currentPlayer,
      coins: nextCoins,
    };
    this.player.set(updatedPlayer);
    this.playerInfoPull.savePlayerInfoToCache(updatedPlayer);
  }

  clearPlayer(): void {
    this.player.set(null);
    this.loading.set(false);
    this.error.set(null);
  }
}
