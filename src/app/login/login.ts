import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth } from '../services/auth';
import { LoginForm } from './components/login-form/login-form';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LoginForm],
  template: `
    <div class="login-screen">
      <div class="login-content">
        <h1 class="title">A Tale Of Recognition</h1>

        <app-login-form
          [logIn]="logIn"
          [submitting]="submitting"
          [errorMessage]="error"
        ></app-login-form>
      </div>

      <button class="login-button" (click)="goHome()">Volver al inicio</button>
    </div>
  `,
  styles: `
    .login-screen {
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

    .login-content {
      width: min(94vw, 36rem);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: clamp(1rem, 2.5vh, 1.75rem);
    }

    .title {
      margin: 0;
      font-style: normal;
      font-synthesis: none;
      font-size: var(--title-size-hero);
      font-family: "FuenteDilana", sans-serif;
      color: black;
      -webkit-text-stroke: clamp(1px, 0.18vw, 2px) #e8d9a8;
      text-align: center;
      line-height: 0.95;
    }

    .login-form {
      margin-top:5px;
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

    @media (max-width: 640px) {
      .login-screen {
        justify-content: center;
        padding-bottom: max(5.5rem, 12vh);
      }

      .title {
        margin-bottom: 0;
      }

      .login-button {
        position: static;
        width: var(--panel-width);
        max-width: 100%;
      }
    }
  `
})
export class Login {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);

  error: string | null = null;
  submitting = false;

  readonly logIn = async (email: string, password: string): Promise<void> => {
    if (this.submitting) {
      return;
    }

    this.submitting = true;
    this.error = null;

    try {
      const session = await this.auth.logIn(email, password);
      const targetRoute = session.activeGameId
        ? ['/dixit', session.activeGameId]
        : ['/games'];
      await this.router.navigate(targetRoute);
    } catch (error: unknown) {
      this.error =
        error instanceof Error ? error.message : 'No se pudo iniciar sesion';
    } finally {
      this.submitting = false;
    }
  };

  goHome(): void {
    void this.router.navigate(['/']);
  }
}
