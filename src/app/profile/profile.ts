import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PLAYER_PRESENCE_STATUSES,
  PlayerPresenceStatus,
} from '../interfaces/player-info';
import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';

const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="profile-view">
      <header class="profile-hero">
        <p class="eyebrow">Perfil</p>
        <h1>Datos de la cuenta</h1>
        <p class="subtitle">
          Edita tu nombre de usuario y configura como quieres aparecer ante el resto de
          jugadores.
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
            <p class="presence-pill">{{ describeStatus(player.state) }}</p>

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
                <dt>Estado del jugador</dt>
                <dd>{{ describeStatus(player.state) }}</dd>
              </div>
              <div>
                <dt>Estado personal de la API</dt>
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

          <article class="profile-card">
            <h3>Cambiar nombre de usuario</h3>
            <p class="card-copy">
              Debe tener entre 3 y 20 caracteres y usar solo letras, numeros, guiones o
              guion bajo.
            </p>

            <form class="settings-form" [formGroup]="usernameForm" (ngSubmit)="saveUsername()">
              <label class="field-label" for="profile-username">Nombre de usuario</label>
              <input
                id="profile-username"
                class="field-control"
                type="text"
                formControlName="username"
                autocomplete="username"
              />

              @if (showUsernameErrors()) {
                <p class="form-error">{{ usernameErrorMessage() }}</p>
              }

              @if (usernameSuccessMessage) {
                <p class="form-success">{{ usernameSuccessMessage }}</p>
              }

              @if (usernameRequestError) {
                <p class="form-error">{{ usernameRequestError }}</p>
              }

              <button
                type="submit"
                class="primary-action"
                [disabled]="isUsernameSubmitDisabled(player.username)"
              >
                @if (usernameSubmitting) {
                  Guardando...
                } @else {
                  Guardar nombre
                }
              </button>
            </form>
          </article>

          <article class="profile-card">
            <h3>Estado del jugador</h3>
            <p class="card-copy">
              Elige si apareces disponible, ausente, ocupado o invisible en la capa social.
            </p>

            <form class="settings-form" [formGroup]="statusForm" (ngSubmit)="saveStatus()">
              <label class="field-label" for="profile-status">Presencia</label>
              <select id="profile-status" class="field-control" formControlName="status">
                @for (statusOption of statusOptions; track statusOption.value) {
                  <option [value]="statusOption.value">
                    {{ statusOption.label }}
                  </option>
                }
              </select>

              <p class="status-description">
                {{ describeStatusSelection(statusForm.controls.status.value) }}
              </p>

              @if (statusSuccessMessage) {
                <p class="form-success">{{ statusSuccessMessage }}</p>
              }

              @if (statusRequestError) {
                <p class="form-error">{{ statusRequestError }}</p>
              }

              <button
                type="submit"
                class="primary-action"
                [disabled]="isStatusSubmitDisabled(player.state)"
              >
                @if (statusSubmitting) {
                  Guardando...
                } @else {
                  Guardar estado
                }
              </button>
            </form>
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

    .presence-pill {
      display: inline-flex;
      align-items: center;
      margin: 0 0 18px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(15, 36, 53, 0.72);
      color: #fff5d9;
      font-size: 0.9rem;
      font-weight: 600;
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

    .card-copy {
      margin: 0 0 18px;
      color: rgba(244, 239, 225, 0.76);
      line-height: 1.5;
    }

    .settings-form {
      display: grid;
      gap: 12px;
    }

    .field-label {
      color: rgba(244, 239, 225, 0.74);
      font-size: 0.86rem;
      text-transform: uppercase;
      letter-spacing: 0.05rem;
    }

    .field-control {
      min-height: 46px;
      padding: 0 14px;
      border: 1px solid rgba(226, 204, 147, 0.3);
      border-radius: 14px;
      background: rgba(11, 28, 37, 0.88);
      color: #fffdf7;
      font: inherit;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .field-control:focus {
      border-color: rgba(240, 210, 141, 0.9);
      box-shadow: 0 0 0 3px rgba(240, 210, 141, 0.14);
    }

    .status-description {
      margin: -2px 0 0;
      color: rgba(244, 239, 225, 0.72);
      line-height: 1.45;
    }

    .form-error,
    .form-success {
      margin: 0;
      padding: 11px 14px;
      border-radius: 14px;
      font-weight: 600;
    }

    .form-error {
      color: #ffdede;
      background: rgba(120, 24, 24, 0.28);
      border: 1px solid rgba(255, 166, 166, 0.26);
    }

    .form-success {
      color: #def7d8;
      background: rgba(40, 110, 74, 0.26);
      border: 1px solid rgba(164, 227, 180, 0.24);
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

    .primary-action:disabled {
      opacity: 0.62;
      cursor: not-allowed;
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
  readonly statusOptions = PLAYER_PRESENCE_STATUSES.map((status) => ({
    value: status,
    label: this.describeStatus(status),
  }));

  readonly auth = inject(Auth);
  readonly playerStore = inject(PlayerStore);

  readonly usernameForm = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
        Validators.pattern(USERNAME_PATTERN),
      ],
    }),
  });

  readonly statusForm = new FormGroup({
    status: new FormControl<PlayerPresenceStatus>('ONLINE', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  usernameSubmitting = false;
  statusSubmitting = false;
  usernameSubmitted = false;
  usernameSuccessMessage: string | null = null;
  usernameRequestError: string | null = null;
  statusSuccessMessage: string | null = null;
  statusRequestError: string | null = null;

  constructor() {
    effect(() => {
      const player = this.playerStore.player();
      if (!player) {
        return;
      }

      this.usernameForm.patchValue({ username: player.username }, { emitEvent: false });
      this.statusForm.patchValue({ status: player.state }, { emitEvent: false });
    });

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

  async saveUsername(): Promise<void> {
    this.usernameSubmitted = true;
    this.usernameSuccessMessage = null;
    this.usernameRequestError = null;
    this.usernameForm.controls.username.markAsTouched();

    if (this.usernameForm.invalid || this.usernameSubmitting) {
      return;
    }

    const player = this.playerStore.player();
    if (!player) {
      return;
    }

    const username = this.usernameForm.controls.username.value.trim();
    if (username === player.username) {
      return;
    }

    this.usernameSubmitting = true;

    try {
      this.usernameSuccessMessage = await this.playerStore.updateUsername(username);
      this.usernameForm.patchValue({ username }, { emitEvent: false });
    } catch (error: unknown) {
      this.usernameRequestError =
        error instanceof Error ? error.message : 'No se pudo actualizar el nombre de usuario';
    } finally {
      this.usernameSubmitting = false;
    }
  }

  async saveStatus(): Promise<void> {
    this.statusSuccessMessage = null;
    this.statusRequestError = null;

    if (this.statusForm.invalid || this.statusSubmitting) {
      return;
    }

    const player = this.playerStore.player();
    if (!player) {
      return;
    }

    const status = this.statusForm.controls.status.value;
    if (status === player.state) {
      return;
    }

    this.statusSubmitting = true;

    try {
      this.statusSuccessMessage = await this.playerStore.updateStatus(status);
    } catch (error: unknown) {
      this.statusRequestError =
        error instanceof Error ? error.message : 'No se pudo actualizar el estado del jugador';
    } finally {
      this.statusSubmitting = false;
    }
  }

  showUsernameErrors(): boolean {
    const control = this.usernameForm.controls.username;
    return control.invalid && (control.touched || this.usernameSubmitted);
  }

  usernameErrorMessage(): string {
    const control = this.usernameForm.controls.username;

    if (control.hasError('required')) {
      return 'El nombre de usuario es obligatorio.';
    }

    if (control.hasError('minlength')) {
      return 'El nombre de usuario debe tener al menos 3 caracteres.';
    }

    if (control.hasError('maxlength')) {
      return 'El nombre de usuario no puede superar los 20 caracteres.';
    }

    if (control.hasError('pattern')) {
      return 'Usa solo letras, numeros, guiones o guion bajo.';
    }

    return 'Revisa el formato del nombre de usuario.';
  }

  isUsernameSubmitDisabled(currentUsername: string): boolean {
    return (
      this.usernameSubmitting ||
      this.usernameForm.invalid ||
      this.usernameForm.controls.username.value.trim() === currentUsername
    );
  }

  isStatusSubmitDisabled(currentStatus: PlayerPresenceStatus): boolean {
    return (
      this.statusSubmitting ||
      this.statusForm.invalid ||
      this.statusForm.controls.status.value === currentStatus
    );
  }

  describeStatus(status: PlayerPresenceStatus): string {
    switch (status) {
      case 'AWAY':
        return 'Ausente';
      case 'BUSY':
        return 'Ocupado';
      case 'INVISIBLE':
        return 'Invisible';
      case 'ONLINE':
      default:
        return 'Online';
    }
  }

  describeStatusSelection(status: PlayerPresenceStatus): string {
    switch (status) {
      case 'AWAY':
        return 'Indica que no estas disponible en este momento.';
      case 'BUSY':
        return 'Muestra que estas ocupado y no quieres interrupciones.';
      case 'INVISIBLE':
        return 'Apareceras como desconectado para jugar con mas privacidad.';
      case 'ONLINE':
      default:
        return 'Tu perfil sera visible para tus amigos como conectado.';
    }
  }
}
