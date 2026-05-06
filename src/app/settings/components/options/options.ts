import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../../services/auth';
import { BoardsPull } from '../../../services/boards-pull';
import { CardPull } from '../../../services/card-pull';
import { PlayerStore } from '../../../services/player-store';

@Component({
  selector: 'app-options',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="configuracion-layout">
      @if (!auth.isLoggedIn()) {
        <article class="estado-panel">
          <h1>Sesion no iniciada</h1>
          <p>Necesitas iniciar sesion para consultar tu cuenta.</p>
        </article>
      } @else {
        @if (playerStore.player(); as player) {
          <article class="perfil-resumen">
            <div class="avatar-badge">
              {{ player.username.charAt(0).toUpperCase() }}
            </div>

            <div class="perfil-texto">
              <h1>{{ player.username }}</h1>
              <p>{{ player.email }}</p>
              <span class="estado-pill" [class.estado-pill--offline]="player.state !== 'CONNECTED'">
                {{ describeStatus(player.state) }}
              </span>
            </div>
          </article>
        } @else if (playerStore.loading()) {
          <article class="estado-panel">
            <p>Cargando perfil...</p>
          </article>
        } @else {
          <article class="estado-panel">
            <h1>Perfil no disponible</h1>
            <p>{{ playerStore.error() || 'No se pudo cargar la informacion de la cuenta.' }}</p>
          </article>
        }

        <section class="metricas-grid">
          <article class="metrica-card">
            <span class="metrica-icono" aria-hidden="true">CR</span>
            <strong>{{ cardsCount() }}</strong>
            <span class="metrica-label">Cartas</span>
          </article>

          <article class="metrica-card">
            <span class="metrica-icono" aria-hidden="true">TB</span>
            <strong>{{ boardsCount() }}</strong>
            <span class="metrica-label">Tableros</span>
          </article>
        </section>

        @if (inventoryError()) {
          <p class="mensaje-error">{{ inventoryError() }}</p>
        }

        @if (accountMessage(); as message) {
          <p class="mensaje-estado">{{ message }}</p>
        }

        <div class="acciones-configuracion">
          <button
            type="button"
            class="btn-config btn-peligro"
            (click)="eliminarCuenta()"
            [disabled]="accountSubmitting()"
          >
            @if (accountSubmitting()) {
              Eliminando cuenta...
            } @else {
              Eliminar cuenta
            }
          </button>

          <button
            type="button"
            class="btn-config btn-cerrar-sesion"
            (click)="cerrarSesion()"
            [disabled]="accountSubmitting()"
          >
            Cerrar sesion
          </button>
        </div>
      }
    </section>
  `,
  styleUrls: ['./options.css'],
})
export class Options {
  readonly auth = inject(Auth);
  readonly playerStore = inject(PlayerStore);

  private readonly cardPull = inject(CardPull);
  private readonly boardsPull = inject(BoardsPull);
  private readonly router = inject(Router);

  readonly cardsCount = signal<number | string>('...');
  readonly boardsCount = signal<number | string>('...');
  readonly inventoryError = signal<string | null>(null);
  readonly accountMessage = signal<string | null>(null);
  readonly accountSubmitting = signal(false);

  constructor() {
    this.loadProfile();
    void this.loadInventorySummary();
  }

  async eliminarCuenta(): Promise<void> {
    if (this.accountSubmitting()) {
      return;
    }

    const confirmed = globalThis.confirm(
      'Esta accion eliminara tu cuenta permanentemente. Quieres continuar?'
    );
    if (!confirmed) {
      return;
    }

    this.accountSubmitting.set(true);
    this.accountMessage.set(null);

    try {
      const message = await this.playerStore.deleteAccount();
      this.auth.logOut();
      await this.router.navigate(['/login']);
      this.accountMessage.set(message);
    } catch (error: unknown) {
      this.accountMessage.set(
        error instanceof Error ? error.message : 'No se pudo eliminar la cuenta'
      );
    } finally {
      this.accountSubmitting.set(false);
    }
  }

  cerrarSesion(): void {
    this.playerStore.clearPlayer();
    this.auth.logOut();
    void this.router.navigate(['/login']);
  }

  describeStatus(status: string): string {
    return status === 'CONNECTED' ? 'Conectado' : 'Desconectado';
  }

  private loadProfile(): void {
    if (!this.auth.isLoggedIn()) {
      return;
    }

    if (!this.playerStore.player() && !this.playerStore.loading()) {
      void this.playerStore.loadPlayer();
    }
  }

  private async loadInventorySummary(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.cardsCount.set(0);
      this.boardsCount.set(0);
      return;
    }

    this.inventoryError.set(null);

    try {
      const [cards, boards] = await Promise.all([
        this.cardPull.getCards(),
        this.boardsPull.getUserBoards(),
      ]);

      this.cardsCount.set(cards.length);
      this.boardsCount.set(boards.length);
    } catch (error: unknown) {
      this.cardsCount.set('-');
      this.boardsCount.set('-');
      this.inventoryError.set(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el resumen de cartas y tableros'
      );
    }
  }
}
