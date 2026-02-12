import { Component } from '@angular/core';
import { LoginForm } from '../login-form/login-form.js';
import { Auth } from '../services/auth.js';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [LoginForm],
  template: `
    <h1>A Tale of Recognition</h1>
    @if (!auth.isLoggedIn()) {
      <div class="login-form-wrapper">
        <app-login-form [logIn]="auth.LogIn.bind(auth)" (usernameOut)="this.username = $event"></app-login-form>
      </div>
    }
    <h2>{{username}}</h2>
  `,
  styles: `
    h1 {
      margin: 0;
      margin-top: 20px;
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
  auth = new Auth();
  username='';
}
