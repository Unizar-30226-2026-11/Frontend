import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Game } from '../interfaces/game';
import { GamesPull } from '../services/games-pull';
import { GameCard } from '../game-card/game-card';
@Component({
  selector: 'app-games-view',
  standalone: true,
  imports: [CommonModule, GameCard],
  template: `
    <section class="games-view">
      <header class="games-header">
        <h1>Games</h1>
        <span class="games-count">{{ games().length }} results</span>
      </header>

      <div class="games-grid">
        @for (game of games(); track game.id) {
          <app-game-card
            [gameTitle]="game.title"
            [gameImage]="game.image"
            [gameDescription]="game.body"
            [gameId]="game.id"
          ></app-game-card>
        }
      </div>
    </section>
  `,
  styles: `
    .games-view {
      padding: 24px clamp(16px, 4vw, 48px) 48px;
      color: #e6e7eb;
    }

    .games-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }

    .games-header h1 {
      margin: 0;
      font-size: clamp(1.4rem, 2vw, 2rem);
      letter-spacing: 0.02em;
    }

    .games-count {
      font-size: 0.95rem;
      color: rgba(230, 231, 235, 0.7);
    }

    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
    }

    @media (min-width: 1200px) {
      .games-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    }

    @media (min-width: 900px) and (max-width: 1199px) {
      .games-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
  `,
})
export class GamesView {
  games = signal<Game[]>([]);

  constructor(private gameService: GamesPull) {
    this.loadGames(1, 20);
  }

  loadGames(page: number, pageSize: number) {
    this.gameService
      .getGames(page, pageSize)
      .then((games) => {
        this.games.set(games);
      })
      .catch((error) => {
        console.error('games load failed', error);
      });
  }
}
