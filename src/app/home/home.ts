import { Component, inject } from '@angular/core';
import { LoginForm } from '../login-form/login-form.js';
import { Auth } from '../services/auth.js';
import { Router } from '@angular/router';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [LoginForm],
  template: `
    <section class="home-screen">
      <h1 class="title">A Tale of Recognition</h1>
      @if (!auth.isLoggedIn()) {
        <div class="login-form-wrapper">
          <app-login-form [logIn]="handleLogin.bind(this)" (usernameOut)="username = $event"></app-login-form>
        </div>
      }
      <h2>{{username}}</h2>
    </section>
  `,
  styles: `
    .home-screen {
      min-height: 100dvh;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 24px 16px;
      box-sizing: border-box;
    }

    .title {
      margin: 20px 0;
      font-style: normal;
      font-synthesis: none;
      font-size: clamp(56px, 8vw, 100px);
      line-height: 1;
      font-family: "FuenteDilana", sans-serif;
      color: #f2d78c;
      -webkit-text-stroke: 1px #2b2217;
      text-shadow: 0 4px 14px rgba(0, 0, 0, 0.75);
      text-align: center;
      padding-inline: 16px;
    }

    .login-form-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
    }
  `,
})
export class Home {
  auth = inject(Auth);
  private router = inject(Router);
  username='';

  handleLogin(username: string, password: string): void {
    const isLoggedIn = this.auth.LogIn(username, password);
    if (isLoggedIn) {
      this.router.navigateByUrl('/games');
    }
  }
}
