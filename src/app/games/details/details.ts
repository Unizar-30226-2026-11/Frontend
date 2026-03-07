import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Game } from '../../interfaces/game';
import { GamesPull } from '../../services/games-pull';

@Component({
  selector: 'app-details',
  standalone: true,
  imports: [RouterModule],
  template: `
    <section class="details-view">
      @if (loading()) {
        <p>Cargando sala...</p>
      } @else if (error()) {
        <p>{{ error() }}</p>
      } @else if (game(); as game) {
        <h1>{{ game.title }}</h1>
        <p>Codigo: {{ game.id }}</p>
        <p>Motor: {{ game.engine }}</p>
        <p>Estado: {{ game.status }}</p>
        <p>Visibilidad: {{ game.isPrivate ? 'Privada' : 'Publica' }}</p>
        <p>Host: {{ game.hostId }}</p>
        <p>Jugadores: {{ game.playerCount }}/{{ game.maxPlayers }}</p>
        <p>{{ game.description }}</p>
      } @else {
        <p>No se encontro la sala.</p>
      }
    </section>
  `,
  styles: `
    .details-view {
      padding: 24px;
      color: black;
    }
  `,
})
export class Details {
  private readonly route = inject(ActivatedRoute);
  private readonly gamesPull = inject(GamesPull);

  readonly game = signal<Game | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    const lobbyCode = this.route.snapshot.paramMap.get('id');
    if (!lobbyCode) {
      this.error.set('Codigo de sala invalido');
      this.loading.set(false);
      return;
    }

    void this.gamesPull
      .getGameDetails(lobbyCode)
      .then((game) => {
        this.game.set(game);
      })
      .catch((error: unknown) => {
        this.error.set(error instanceof Error ? error.message : 'No se pudo cargar la sala');
      })
      .finally(() => {
        this.loading.set(false);
      });
  }
}
