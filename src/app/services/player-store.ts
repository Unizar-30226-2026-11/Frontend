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

<<<<<<< HEAD
  loadPlayer(username: string, options: { forceRefresh?: boolean } = {}): Promise<void> {
=======
  loadPlayer(username: string): Promise<void> {
>>>>>>> Menus-Regis
    this.loading.set(true);
    this.error.set(null);

    return this.playerInfoPull
<<<<<<< HEAD
      .getPlayerInfo(username, options)
=======
      .getPlayerInfo(username)
>>>>>>> Menus-Regis
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

<<<<<<< HEAD
    const updatedPlayer = {
      ...currentPlayer,
      coins: currentPlayer.coins - amount,
    };
    this.player.set(updatedPlayer);
    this.playerInfoPull.savePlayerInfoToCache(updatedPlayer);
=======
    this.player.set({
      ...currentPlayer,
      coins: currentPlayer.coins - amount,
    });
>>>>>>> Menus-Regis
    return true;
  }

  updateCoins(nextCoins: number): void {
    const currentPlayer = this.player();
    if (!currentPlayer) {
      return;
    }
<<<<<<< HEAD
    const updatedPlayer = {
      ...currentPlayer,
      coins: nextCoins,
    };
    this.player.set(updatedPlayer);
    this.playerInfoPull.savePlayerInfoToCache(updatedPlayer);
=======
    this.player.set({
      ...currentPlayer,
      coins: nextCoins,
    });
>>>>>>> Menus-Regis
  }

  clearPlayer(): void {
    this.player.set(null);
    this.loading.set(false);
    this.error.set(null);
  }
}
