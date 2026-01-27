import { Component } from '@angular/core';
import { LoginForm } from '../login-form/login-form.js';
import { Auth } from '../services/auth.js';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [LoginForm],
  template: `
    <h1>Welcome to the App {{ username }}!</h1>

    @if (!auth.isLoggedIn()) {
      <div class="login-form-wrapper">
        <app-login-form [logIn]="auth.LogIn.bind(auth)" (usernameOut)="this.username = $event"></app-login-form>
      </div>
    }
  `,
  styles: `
    h1 {
      color: blue;
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
