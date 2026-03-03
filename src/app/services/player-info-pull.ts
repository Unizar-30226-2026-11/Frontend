import { Injectable } from '@angular/core';
import { PlayerInfo } from '../interfaces/player-info';
@Injectable({
  providedIn: 'root',
})
export class PlayerInfoPull {
  getPlayerInfo(username: string): Promise<PlayerInfo> {
    return fetch('https://jsonplaceholder.typicode.com/users/1')
      .then((response) => {
        if (!response.ok) {
          throw new Error('No se pudo cargar la informacion del jugador');
        }
        return response.json();
      })
      .then((data: { id: number; username?: string }) => {
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
      });
  }
}
