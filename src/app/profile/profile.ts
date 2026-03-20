import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="profile-view">
      <header class="profile-hero">
        <p class="eyebrow">Perfil</p>
        <h1>Datos de la cuenta</h1>
        <p class="subtitle">
          Esta vista muestra la informacion devuelta por la API para el usuario autenticado.
        </p>
      </header>

      @if (!auth.isLoggedIn()) {
        <article class="profile-card empty-state">
          <h2>Sesion no iniciada</h2>
          <p>Necesitas iniciar sesion para consultar tu perfil.</p>
          <a routerLink="/login" class="primary-action">Ir a login</a>
        </article>
      } @else if (playerStore.loading()) {
        <article class="profile-card">
          <p>Cargando perfil...</p>
        </article>
      } @else if (playerStore.error()) {
        <article class="profile-card">
          <h2>No se pudo cargar el perfil</h2>
          <p>{{ playerStore.error() }}</p>
          <button type="button" class="primary-action" (click)="reloadProfile(true)">
            Reintentar
          </button>
        </article>
      } @else if (playerStore.player(); as player) {
        <div class="profile-grid">
          <article class="profile-card featured-card">
            <p class="chip">Cuenta activa</p>
            <h2>{{ player.username }}</h2>
            <p class="main-email">{{ player.email }}</p>

            <dl class="details-list">
              <div>
                <dt>ID</dt>
                <dd>{{ player.id }}</dd>
              </div>
              <div>
                <dt>USER_ID</dt>
                <dd>{{ player.legacyUserId }}</dd>
              </div>
            </dl>
          </article>

          <article class="profile-card">
            <h3>Informacion base</h3>
            <dl class="details-list">
              <div>
                <dt>Nombre de usuario</dt>
                <dd>{{ player.username }}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{{ player.email }}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{{ player.state }}</dd>
              </div>
              <div>
                <dt>Estado personal</dt>
                <dd>{{ player.personalState }}</dd>
              </div>
            </dl>
          </article>

          <article class="profile-card">
            <h3>Progreso</h3>
            <dl class="details-list">
              <div>
                <dt>Nivel de experiencia</dt>
                <dd>{{ player.experienceLevel }}</dd>
              </div>
              <div>
                <dt>Progreso de nivel</dt>
                <dd>{{ player.progressLevel }}</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd>{{ player.balance }}</dd>
              </div>
            </dl>
          </article>
        </div>

        <button type="button" class="primary-action refresh-button" (click)="reloadProfile(true)">
          Actualizar perfil
        </button>
      } @else {
        <article class="profile-card">
          <p>No hay datos de perfil disponibles.</p>
        </article>
      }
    </section>
  `,
  styles: `
    .profile-view {
      min-height: calc(100dvh - var(--navbar-height, 72px));
      padding: 32px 24px 40px;
      color: #f4efe1;
      background:
        radial-gradient(circle at top left, rgba(196, 152, 58, 0.24), transparent 26%),
        linear-gradient(160deg, #0f2435 0%, #153a46 44%, #224f4b 100%);
      box-sizing: border-box;
    }

    .profile-hero {
      max-width: 760px;
      margin-bottom: 28px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: #e2cc93;
      font-size: 0.85rem;
      letter-spacing: 0.22rem;
      text-transform: uppercase;
    }

    .profile-hero h1 {
      margin: 0;
      font-size: clamp(2.2rem, 5vw, 4rem);
      line-height: 0.98;
      color: #fff5d9;
    }

    .subtitle {
      margin: 12px 0 0;
      max-width: 620px;
      color: rgba(244, 239, 225, 0.82);
      font-size: 1rem;
    }

    .profile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }

    .profile-card {
      padding: 24px;
      border-radius: 22px;
      background: rgba(10, 24, 31, 0.56);
      border: 1px solid rgba(226, 204, 147, 0.24);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
      backdrop-filter: blur(6px);
    }

    .profile-card h2,
    .profile-card h3 {
      margin-top: 0;
      margin-bottom: 12px;
      color: #fff5d9;
    }

    .featured-card {
      background: linear-gradient(145deg, rgba(224, 192, 109, 0.18), rgba(14, 38, 53, 0.78));
    }

    .chip {
      display: inline-flex;
      align-items: center;
      margin: 0 0 12px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255, 245, 217, 0.12);
      color: #f4deb0;
      font-size: 0.8rem;
      letter-spacing: 0.08rem;
      text-transform: uppercase;
    }

    .main-email {
      margin: 0 0 18px;
      color: rgba(244, 239, 225, 0.82);
      word-break: break-word;
    }

    .details-list {
      display: grid;
      gap: 14px;
      margin: 0;
    }

    .details-list div {
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(226, 204, 147, 0.12);
    }

    .details-list div:last-child {
      padding-bottom: 0;
      border-bottom: none;
    }

    .details-list dt {
      margin-bottom: 4px;
      color: rgba(244, 239, 225, 0.65);
      font-size: 0.86rem;
      text-transform: uppercase;
      letter-spacing: 0.05rem;
    }

    .details-list dd {
      margin: 0;
      color: #fffdf7;
      font-size: 1rem;
      word-break: break-word;
    }

    .primary-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-top: 18px;
      min-width: 170px;
      min-height: 44px;
      padding: 0 18px;
      border: none;
      border-radius: 999px;
      background: linear-gradient(135deg, #f0d28d, #d7b261);
      color: #11242a;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }

    .refresh-button {
      margin-top: 24px;
    }

    .empty-state {
      max-width: 480px;
    }

    @media (max-width: 720px) {
      .profile-view {
        padding: 24px 16px 32px;
      }

      .profile-card {
        padding: 20px;
      }

      .primary-action {
        width: 100%;
      }
    }
  `,
})
export class Profile {
  readonly auth = inject(Auth);
  readonly playerStore = inject(PlayerStore);

  constructor() {
    this.reloadProfile();
  }

  reloadProfile(forceRefresh = false): void {
    if (!this.auth.isLoggedIn()) {
      return;
    }

    if (!forceRefresh && (this.playerStore.loading() || this.playerStore.player())) {
      return;
    }

    void this.playerStore.loadPlayer({ forceRefresh });
  }
}
