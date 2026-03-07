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

  loadPlayer(options: { forceRefresh?: boolean } = {}): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    return this.playerInfoPull
      .getPlayerInfo(options)
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
    const currentPlayer = this.player();
    if (!currentPlayer) {
      return false;
    }

    return currentPlayer.balance >= amount;
  }

  spendCoins(amount: number): boolean {
    const currentPlayer = this.player();
    if (!currentPlayer || currentPlayer.balance < amount) {
      return false;
    }

    const updatedPlayer = {
      ...currentPlayer,
      balance: currentPlayer.balance - amount,
    };
    this.player.set(updatedPlayer);
    this.playerInfoPull.savePlayerInfoToCache(updatedPlayer);
    return true;
  }

  updateBalance(nextBalance: number): void {
    const currentPlayer = this.player();
    if (!currentPlayer) {
      return;
    }

    const updatedPlayer = {
      ...currentPlayer,
      balance: nextBalance,
    };
    this.player.set(updatedPlayer);
    this.playerInfoPull.savePlayerInfoToCache(updatedPlayer);
  }

  clearPlayer(): void {
    this.player.set(null);
    this.loading.set(false);
    this.error.set(null);
    this.playerInfoPull.invalidatePlayerInfo();
  }
}
