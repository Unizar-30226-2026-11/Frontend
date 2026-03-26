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
      <h1 class="title">A Tale Of Recognition</h1>

      <app-login-form
        [logIn]="logIn"
        [submitting]="submitting"
        [errorMessage]="error"
      ></app-login-form>

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

    .login-form {
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
      await this.auth.logIn(email, password);
      await this.router.navigate(['/games']);
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
