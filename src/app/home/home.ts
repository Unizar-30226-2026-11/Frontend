import { Component, inject } from '@angular/core';
// import { LoginForm } from './components/login-form/login-form.js';
import { Auth } from '../services/auth.js';
import { Router, RouterLink } from '@angular/router';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [/*LoginForm ,*/ RouterLink],
  template: `
    <h1>A Tale of Recognition</h1>
    <!-- @if (!auth.isLoggedIn()) {
      <div class="login-form-wrapper">
        <app-login-form [logIn]="handleLogin.bind(this)" (usernameOut)="username = $event"></app-login-form>
      </div>
    } -->
    
    <button class="top-button" routerLink="/register">Registrarse</button>

    <button routerLink="/login">Iniciar Sesión</button>




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
      padding-inline: 16px;
    }

    .top-button {
      margin-top: 100px;
    }

    button {
      display: block;
      margin: 12px auto;
      margin-top: 32px;
      padding: 12px 24px;
      font-size: 32px;
      font-family: "FuenteDilana", sans-serif;
      border-radius: 12px;
      border: 2px solid gray;
      background-color: #05816d;
      color: black;
      cursor: pointer;
    }

    button:hover {
      background-color: #0a9e8c;
      cursor: pointer;
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
      this.username = username;
      this.router.navigateByUrl('/menu');
    }
  }
}
