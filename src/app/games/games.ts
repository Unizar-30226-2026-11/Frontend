import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Game } from '../interfaces/game';
import { GamesPull } from '../services/games-pull';
import { GameCard } from './components/game-card/game-card';
import { Auth } from '../services/auth';

@Component({
  selector: 'app-games-view',
  standalone: true,
  imports: [CommonModule, GameCard],
  template: `
    <section class="games-view">
      <header class="games-header">
        <h1>Salas disponibles</h1>
        <span class="games-count">{{ games().length }} resultados</span>
      </header>

      @if (!auth.isLoggedIn()) {
        <div class="loading-error">
          Debes iniciar sesion para consultar las salas.
        </div>
      } @else if (loading()) {
        <div class="loading-state">
          <img src="/assets/loading.gif" alt="Cargando salas..." />
        </div>
      } @else if (error()) {
        <div class="loading-error">
          {{ error() }}
        </div>
      } @else if (games().length === 0) {
        <div class="loading-error">
          No hay salas disponibles.
        </div>
      } @else {
        <div class="games-grid">
          @for (game of games(); track game.id) {
            <app-game-card
              [gameTitle]="game.title"
              [gameImage]="game.image"
              [gameDescription]="game.description"
              [gameId]="game.id"
            />
          }
        </div>
      }
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
      color: black;
    }

    .games-header h1 {
      margin: 0;
      font-size: clamp(1.4rem, 2vw, 2rem);
      letter-spacing: 0.02em;
    }

    .games-count {
      padding-top: 10px;
      font-size: 1.5rem;
      color: black;
    }

    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
    }

    .loading-state {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 260px;
    }

    .loading-state img {
      width: min(220px, 80vw);
      height: auto;
    }

    .loading-error {
      margin: auto;
      padding-top: 20px;
      font-size: 40px;
      color: black;
      text-align: center;
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
export class Games {
  readonly auth = inject(Auth);
  private readonly gameService = inject(GamesPull);

  readonly games = signal<Game[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (this.auth.isLoggedIn()) {
      void this.loadGames(1, 20);
    }
  }

  loadGames(page: number, pageSize: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    return this.gameService
      .getGames(page, pageSize)
      .then((games) => {
        this.games.set(games);
      })
      .catch((error: unknown) => {
        this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar las salas');
      })
      .finally(() => {
        this.loading.set(false);
      });
  }
}
