import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Game, type LobbyEngine } from '../interfaces/game';
import { GamesPull } from '../services/games-pull';
import { GameCard } from './components/game-card/game-card';
import { Auth } from '../services/auth';

@Component({
  selector: 'app-games-view',
  standalone: true,
  imports: [CommonModule, FormsModule, GameCard],
  template: `
    <section class="games-view">
      <header class="games-header">
        <div class="games-header-copy">
          <h1>Salas disponibles</h1>
          <span class="games-count">{{ games().length }} resultados</span>
        </div>

        <button
          type="button"
          class="create-lobby-button"
          [disabled]="!auth.isLoggedIn() || createLobbyLoading()"
          (click)="toggleCreateLobbyPanel()"
        >
          {{ isCreateLobbyPanelOpen() ? 'Cerrar' : 'Crear lobby' }}
        </button>
      </header>

      @if (isCreateLobbyPanelOpen()) {
        <section class="create-lobby-panel">
          <div class="create-lobby-grid">
            <label class="field">
              <span>Nombre</span>
              <input
                type="text"
                maxlength="50"
                [(ngModel)]="createLobbyName"
                [disabled]="createLobbyLoading()"
                placeholder="Mi sala de Dixit"
              />
            </label>

            <label class="field">
              <span>Jugadores</span>
              <select [(ngModel)]="createLobbyMaxPlayers" [disabled]="createLobbyLoading()">
                @for (count of [3, 4, 5, 6]; track count) {
                  <option [ngValue]="count">{{ count }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Modo</span>
              <select [(ngModel)]="createLobbyEngine" [disabled]="createLobbyLoading()">
                @for (engine of availableLobbyEngines; track engine.value) {
                  <option [ngValue]="engine.value">{{ engine.label }}</option>
                }
              </select>
            </label>

            <label class="field checkbox-field">
              <input type="checkbox" [(ngModel)]="createLobbyPrivate" [disabled]="createLobbyLoading()" />
              <span>Lobby privado</span>
            </label>
          </div>

          @if (createLobbyMessage()) {
            <p class="form-feedback success">{{ createLobbyMessage() }}</p>
          }

          @if (createLobbyError()) {
            <p class="form-feedback error">{{ createLobbyError() }}</p>
          }

          <div class="create-lobby-actions">
            <button
              type="button"
              class="submit-lobby-button"
              [disabled]="createLobbyLoading() || !canCreateLobby()"
              (click)="submitCreateLobby()"
            >
              {{ createLobbyLoading() ? 'Creando...' : 'Crear y entrar' }}
            </button>
          </div>
        </section>
      }

      @if (!auth.isLoggedIn()) {
        <div class="loading-error">
          Debes iniciar sesion para consultar las salas.
        </div>
      } @else if (loading()) {
        <div class="loading-state" aria-label="Cargando salas..." role="status">
          <svg
            class="loading-spinner"
            width="72"
            height="72"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
            />
          </svg>
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
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
      color: black;
      flex-wrap: wrap;
    }

    .games-header-copy {
      display: grid;
      gap: 4px;
    }

    .games-header h1 {
      margin: 0;
      font-size: clamp(1.4rem, 2vw, 2rem);
      letter-spacing: 0.02em;
    }

    .games-count {
      font-size: 1rem;
      color: black;
    }

    .create-lobby-button,
    .submit-lobby-button {
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 160ms ease, opacity 160ms ease;
    }

    .create-lobby-button {
      background: linear-gradient(135deg, #101218, #1d2430);
      color: #f5f0e3;
    }

    .submit-lobby-button {
      background: linear-gradient(135deg, #d6891f, #f0bb61);
      color: #1d2430;
    }

    .create-lobby-button:disabled,
    .submit-lobby-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .create-lobby-panel {
      margin-bottom: 24px;
      padding: 20px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.84);
      border: 1px solid rgba(16, 18, 24, 0.08);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
      color: #1d2430;
    }

    .create-lobby-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      align-items: end;
    }

    .field {
      display: grid;
      gap: 8px;
      font-weight: 600;
    }

    .field span {
      font-size: 0.9rem;
    }

    .field input,
    .field select {
      min-height: 46px;
      border-radius: 12px;
      border: 1px solid rgba(16, 18, 24, 0.16);
      padding: 0 14px;
      font: inherit;
      background: #fff;
      color: #1d2430;
    }

    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 46px;
    }

    .checkbox-field input {
      min-height: auto;
      width: 18px;
      height: 18px;
      margin: 0;
    }

    .create-lobby-actions {
      margin-top: 18px;
      display: flex;
      justify-content: flex-end;
    }

    .form-feedback {
      margin: 14px 0 0;
      font-weight: 600;
    }

    .form-feedback.success {
      color: #136f4f;
    }

    .form-feedback.error {
      color: #ad2323;
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

    .loading-spinner {
      width: clamp(56px, 8vw, 72px);
      height: clamp(56px, 8vw, 72px);
      fill: #101218;
      transform-origin: center;
      animation: games-spinner-rotate 0.75s infinite linear;
    }

    @keyframes games-spinner-rotate {
      100% {
        transform: rotate(360deg);
      }
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
  private readonly router = inject(Router);

  readonly games = signal<Game[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isCreateLobbyPanelOpen = signal(false);
  readonly createLobbyLoading = signal(false);
  readonly createLobbyError = signal<string | null>(null);
  readonly createLobbyMessage = signal<string | null>(null);
  readonly availableLobbyEngines: ReadonlyArray<{ value: LobbyEngine; label: string }> = [
    { value: 'Classic', label: 'Classic' },
    { value: 'Stella', label: 'Stella' },
  ];

  createLobbyName = '';
  createLobbyMaxPlayers = 4;
  createLobbyEngine: LobbyEngine = 'Classic';
  createLobbyPrivate = false;

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

  canCreateLobby(): boolean {
    return this.createLobbyName.trim().length > 0;
  }

  toggleCreateLobbyPanel(): void {
    this.isCreateLobbyPanelOpen.update((currentState) => !currentState);
    this.createLobbyError.set(null);
    this.createLobbyMessage.set(null);
  }

  async submitCreateLobby(): Promise<void> {
    if (!this.auth.isLoggedIn() || !this.canCreateLobby()) {
      return;
    }

    this.createLobbyLoading.set(true);
    this.createLobbyError.set(null);
    this.createLobbyMessage.set(null);

    try {
      const result = await this.gameService.createLobby({
        name: this.createLobbyName.trim(),
        maxPlayers: this.createLobbyMaxPlayers,
        engine: this.createLobbyEngine,
        isPrivate: this.createLobbyPrivate,
      });

      this.createLobbyMessage.set(result.message);
      await this.router.navigateByUrl(result.route);
    } catch (error) {
      this.createLobbyError.set(
        error instanceof Error ? error.message : 'No se pudo crear la sala'
      );
    } finally {
      this.createLobbyLoading.set(false);
    }
  }
}
