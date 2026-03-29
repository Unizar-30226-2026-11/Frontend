import { Component, OnDestroy, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth } from '../services/auth';

const REDIRECT_DELAY_MS = 1500;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <div class="register-screen">

      <h1 class="title">A Tale Of Recognition</h1>

      <form class="register-form"
            [formGroup]="registerForm"
            (ngSubmit)="onSubmit()">

        <input
          type="email"
          placeholder="Email"
          formControlName="email"
        />

        <input
          type="text"
          placeholder="Nombre de Usuario"
          formControlName="username"
        />

        <input
          type="password"
          placeholder="Contraseña"
          formControlName="password"
        />

        <input
          type="password"
          placeholder="Repetir Contraseña"
          formControlName="confirmPassword"
        />

        <button class="submit-button"
                type="submit"
                [disabled]="!registerForm.valid || submitting || isRedirecting">
          {{ isRedirecting ? 'Redirigiendo...' : submitting ? 'Registrando...' : 'Registrarse' }}
        </button>

      </form>

      <button class="login-button" type="button" (click)="goLogin()">Ya tengo una cuenta</button>

      <div *ngIf="error" class="error" role="alert" aria-live="polite">
        <span class="error-icon" aria-hidden="true">!</span>
        <p>{{ error }}</p>
      </div>
      <p *ngIf="successMessage" class="success">{{ successMessage }}</p>

    </div>
  `,
  styles: `
    .register-screen {
      min-height: 100dvh;
      width: 100%;
      background: url('/background.jpg') no-repeat center center;
      background-size: cover;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: clamp(1rem, 2.5vh, 1.5rem);
      padding: var(--page-padding-y) var(--page-padding-x);
      box-sizing: border-box;
      position: relative;
    }

    .title {
      font-size: var(--title-size-page);
      color: #f2d78c;
      text-shadow: 2px 2px 6px black;
      font-family: "FuenteDilana", sans-serif;
      margin: 0;
      text-align: center;
      line-height: 0.95;
      margin-bottom: clamp(1rem, 12vh, 7rem);
      transform: translateY(clamp(-0.5rem, -6vh, -4.5rem));
    }

    .register-form {
      display: flex;
      flex-direction: column;
      gap: clamp(0.85rem, 2vh, 1.35rem);
      width: var(--panel-width);
      max-width: 100%;
      align-items: center;
    }

    input {
      width: 100%;
      box-sizing: border-box;
      padding: var(--field-padding-y) var(--field-padding-x);
      border-radius: var(--field-radius);
      border: none;
      background: #e6d28f;
      text-align: center;
      font-size: clamp(1rem, 1.2vw, 1.05rem);
      box-shadow: inset 0 3px 6px rgba(0,0,0,0.25);
    }

    input::placeholder {
      color: #333;
      font-weight: 500;
      transition: opacity 0.15s ease;
    }

    input:focus::placeholder {
      opacity: 0;
    }

    .submit-button {
      margin-top: 0.5rem;
      padding: var(--button-padding-y) var(--button-padding-x);
      border-radius: var(--button-radius);
      border: 2px solid #355652;
      background: #d9ece8;
      color: #10211f;
      cursor: pointer;
      font-weight: 700;
      font-size: clamp(1rem, 1.4vw, 1.15rem);
      letter-spacing: 0.2px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
      transition: 0.2s;
    }

    .submit-button:hover:not(:disabled) {
      transform: scale(1.05);
    }

    .submit-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .login-button {
      position: absolute;
      bottom: clamp(1rem, 3vh, 1.9rem);
      right: clamp(1rem, 3vw, 2.5rem);
      padding: var(--button-padding-y) var(--button-padding-x);
      border-radius: var(--button-radius);
      border: 2px solid #355652;
      background: #d9ece8;
      color: #10211f;
      cursor: pointer;
      font-weight: 700;
      font-size: clamp(0.95rem, 1.4vw, 1.05rem);
      letter-spacing: 0.2px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
    }

    .error {
      width: var(--panel-width);
      max-width: 100%;
      margin-top: 0.9rem;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.9rem 1rem;
      box-sizing: border-box;
      border-radius: var(--field-radius);
      border: 1px solid rgba(255, 190, 190, 0.48);
      background: linear-gradient(180deg, rgba(94, 22, 22, 0.9), rgba(61, 14, 14, 0.84));
      color: #ffe6e1;
      box-shadow: 0 12px 28px rgba(12, 4, 4, 0.34);
      backdrop-filter: blur(8px);
    }

    .error p {
      margin: 0;
      font-weight: 600;
      line-height: 1.35;
      text-align: left;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    }

    .error-icon {
      flex: 0 0 auto;
      width: 1.45rem;
      height: 1.45rem;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      background: rgba(255, 237, 230, 0.18);
      border: 1px solid rgba(255, 237, 230, 0.4);
      font-size: 0.92rem;
      font-weight: 800;
      line-height: 1;
    }

    .success {
      color: #d9ece8;
      margin-top: 0.9rem;
      padding: 0.8rem 1rem;
      border-radius: var(--field-radius);
      background: rgba(16, 33, 31, 0.78);
      border: 1px solid rgba(217, 236, 232, 0.35);
      text-align: center;
      width: var(--panel-width);
      max-width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 640px) {
      .register-screen {
        justify-content: center;
        padding-bottom: max(5.5rem, 12vh);
      }

      .title {
        margin-bottom: 1.5rem;
        transform: none;
      }

      .login-button {
        position: static;
        width: var(--panel-width);
        max-width: 100%;
      }
    }
  `
})
export class Register implements OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private redirectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  error: string | null = null;
  successMessage: string | null = null;
  submitting = false;
  isRedirecting = false;

  registerForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid || this.submitting || this.isRedirecting) {
      return;
    }

    this.error = null;
    this.successMessage = null;

    const { email, username, password, confirmPassword } = this.registerForm.getRawValue();

    if (password !== confirmPassword) {
      this.error = 'Las contrasenas no coinciden';
      this.isRedirecting = false;
      return;
    }

    this.submitting = true;

    try {
      await this.auth.register(email, username, password);
      this.isRedirecting = true;
      this.clearRedirectTimeout();
      this.successMessage = 'Registro completado correctamente. Redirigiendo a iniciar sesion...';

      this.redirectTimeoutId = setTimeout(() => {
        void this.router.navigate(['/login']);
      }, REDIRECT_DELAY_MS);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'No se pudo completar el registro';
      this.isRedirecting = false;
    } finally {
      this.submitting = false;
    }
  }

  goLogin() {
    void this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.clearRedirectTimeout();
  }

  private clearRedirectTimeout(): void {
    if (this.redirectTimeoutId !== null) {
      clearTimeout(this.redirectTimeoutId);
      this.redirectTimeoutId = null;
    }
  }
}
