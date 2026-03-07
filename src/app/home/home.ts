import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LoginForm } from './components/login-form/login-form';
import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [LoginForm],
  template: `
    <h1>A Tale of Recognition</h1>

    @if (!auth.isLoggedIn()) {
      <div class="login-form-wrapper">
        <app-login-form
          [logIn]="handleLogin.bind(this)"
          [submitting]="loggingIn()"
          [errorMessage]="loginError()"
        />
      </div>
    } @else {
      <h2>{{ auth.username() }}</h2>
    }
  `,
  styles: `
    h1 {
      margin-top: 0px;
      padding-top: 20px;
      margin-bottom: 20px;
      font-style: normal;
      font-synthesis: none;
      font-size: 100px;
      font-family: "FuenteDilana", sans-serif;
      color: black;
      -webkit-text-stroke: 2px #e8d9a8;
      text-align: center;
    }

    .login-form-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
    }
  `,
})
export class Home {
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly playerStore = inject(PlayerStore);

  readonly loggingIn = signal(false);
  readonly loginError = signal<string | null>(null);

  async handleLogin(email: string, password: string): Promise<void> {
    this.loggingIn.set(true);
    this.loginError.set(null);

    try {
      await this.auth.logIn(email, password);
      await this.playerStore.loadPlayer({ forceRefresh: true });
      await this.router.navigateByUrl('/games');
    } catch (error: unknown) {
      this.loginError.set(error instanceof Error ? error.message : 'No se pudo iniciar sesion');
    } finally {
      this.loggingIn.set(false);
    }
  }
}
