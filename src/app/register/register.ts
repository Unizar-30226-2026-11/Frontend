import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth } from '../services/auth';
import { RegisterForm } from './components/register-form/register-form';

const REDIRECT_DELAY_MS = 1500;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RegisterForm],
  template: `
    <div class="register-screen">

      <h1 class="title">A Tale Of Recognition</h1>

      <!-- <form class="register-form"
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

      </form> -->

      <app-register-form
        [register]="registerUser"
        [submitting]="submitting || isRedirecting"
        [errorMessage]="error"
      />

      <button class="login-button" (click)="goLogin()">Ya tengo una cuenta</button>

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
      gap: 20px;
      padding: 24px 16px;
      box-sizing: border-box;
      position: relative;
    }

    .title {
      color: black;
      font-size: 100px;
      font-style: normal;
      font-synthesis: none;
      font-family: "FuenteDilana", sans-serif;
      margin: 0;
      -webkit-text-stroke: 2px #e8d9a8;
      margin-top: 0px;
      text-align: center;
      margin-bottom: 30px;
    }

    .register-form {
      display: flex;
      flex-direction: column;
      gap: 22px;
      width: 420px;
      align-items: center;
    }

    input {
      width: 100%;
      padding: 14px;
      border-radius: 10px;
      border: none;
      background: #e6d28f;
      text-align: center;
      font-size: 16px;
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
      margin-top: 10px;
      padding: 12px 28px;
      border-radius: 12px;
      border: 2px solid #355652;
      background: #d9ece8;
      color: #10211f;
      cursor: pointer;
      font-weight: 700;
      font-size: 18px;
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
      bottom: 30px;
      right: 40px;
      padding: 12px 28px;
      border-radius: 12px;
      border: 2px solid #355652;
      background: #d9ece8;
      color: #10211f;
      cursor: pointer;
      font-weight: 700;
      font-size: 17px;
      letter-spacing: 0.2px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
    }

    .error {
      color: red;
      margin-top: 15px;
    }

    .success {
      color: #d9ece8;
      margin-top: 15px;
      padding: 10px 14px;
      border-radius: 10px;
      background: rgba(16, 33, 31, 0.78);
      border: 1px solid rgba(217, 236, 232, 0.35);
      text-align: center;
    }

    @media (max-width: 760px) {
      .register-screen {
        justify-content: flex-start;
        gap: 16px;
        padding: 20px 14px 96px;
      }

      .title {
        font-size: clamp(48px, 13vw, 84px);
        margin-bottom: 16px;
      }

      .login-button {
        right: 14px;
        bottom: 18px;
        padding: 10px 18px;
        font-size: 15px;
      }

      .success {
        width: min(100%, 640px);
        box-sizing: border-box;
      }
    }

    @media (max-width: 480px) {
      .register-screen {
        padding: 16px 12px 88px;
      }

      .title {
        margin-bottom: 10px;
      }

      .login-button {
        left: 12px;
        right: 12px;
        width: auto;
        text-align: center;
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

  // Lógica anterior mantenida como referencia tras mover el formulario al componente hijo.
  // registerForm = new FormGroup({
  //   email: new FormControl('', {
  //     nonNullable: true,
  //     validators: [Validators.required, Validators.email],
  //   }),
  //   username: new FormControl('', {
  //     nonNullable: true,
  //     validators: [Validators.required],
  //   }),
  //   password: new FormControl('', {
  //     nonNullable: true,
  //     validators: [Validators.required],
  //   }),
  //   confirmPassword: new FormControl('', {
  //     nonNullable: true,
  //     validators: [Validators.required],
  //   }),
  // });
  //
  // async onSubmit(): Promise<void> {
  //   if (this.registerForm.invalid || this.submitting || this.isRedirecting) {
  //     return;
  //   }
  //
  //   this.error = null;
  //   this.successMessage = null;
  //
  //   const { email, username, password, confirmPassword } = this.registerForm.getRawValue();
  //
  //   if (password !== confirmPassword) {
  //     this.error = 'Las contrasenas no coinciden';
  //     this.isRedirecting = false;
  //     return;
  //   }
  //
  //   this.submitting = true;
  //
  //   try {
  //     await this.auth.register(email, username, password);
  //     this.isRedirecting = true;
  //     this.clearRedirectTimeout();
  //     this.successMessage = 'Registro completado correctamente. Redirigiendo a iniciar sesion...';
  //
  //     this.redirectTimeoutId = setTimeout(() => {
  //       void this.router.navigate(['/login']);
  //     }, REDIRECT_DELAY_MS);
  //   } catch (error: unknown) {
  //     this.error = error instanceof Error ? error.message : 'No se pudo completar el registro';
  //     this.isRedirecting = false;
  //   } finally {
  //     this.submitting = false;
  //   }
  // }

  readonly registerUser = async (email: string, username: string, password: string): Promise<void> => {
    if (this.submitting || this.isRedirecting) {
      return;
    }

    this.error = null;
    this.successMessage = null;
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
  };

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
