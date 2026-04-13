import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, effect, inject } from '@angular/core';
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
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private readonly cdr = inject(ChangeDetectorRef);

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
      this.cdr.detectChanges();
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
      this.cdr.detectChanges();
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
