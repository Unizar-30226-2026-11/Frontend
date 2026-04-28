import { Component, Input, output } from '@angular/core';
import { FormsModule, FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { required } from '@angular/forms/signals';

@Component({
  selector: 'app-login-form',
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <div class="page-center">
      <div class="img-box">
        <div class="img-title">Inicia Sesion</div>
        <form class="img-login-form" [formGroup]="profileForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <label for="username">Usuario:</label>
            <input id="username" type="text" formControlName="username" name="username">
            <label for="password">Contrasena:</label>
            <input id="password" type="password" formControlName="password" name="password">
            <button class="form-submit" type="submit" [disabled]="!profileForm.valid">Iniciar Sesion</button>
          </div>
        </form>
        <img src="/assets/LoginFormImage.jpg" alt="Imagen para formulario de login">
      </div>
    </div>
  `,
  styles: `
    .img-box {
      position: relative;
      width: 500px;
      height: 300px;
      overflow: hidden;
      border-radius: 8px;
    }

    .img-title {
      position: absolute;
      padding-top: 10px;
      top: 10%;
      left: 0;
      right: 0;
      text-align: center;
      color: #fff;
      font-weight: 600;
      font-size: 24px;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
      z-index: 1;
      pointer-events: none;
    }

    .img-login-form {
      position: absolute;
      text-align: center;
      top: 33%;
      width: 100%;
      z-index: 1;
      pointer-events: auto;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 10px 14px;
      align-items: center;
      max-width: 360px;
      margin: 0 auto;
    }

    .form-grid label {
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
      text-align: right;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    }

    .form-grid input {
      width: 100%;
      box-sizing: border-box;
      height: 36px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 8px;
      color: #f5f5f5;
      background: rgba(20, 20, 20, 0.55);
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .form-grid input::placeholder {
      color: rgba(255, 255, 255, 0.55);
    }

    .form-grid input:focus {
      border-color: rgba(255, 255, 255, 0.7);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.15);
      background: rgba(20, 20, 20, 0.7);
    }

    .form-submit {
      grid-column: 1 / -1;
      width: 100%;
      height: 38px;
      margin-top: 8px;
      border: none;
      border-radius: 10px;
      color: #1b1b1b;
      font-weight: 700;
      letter-spacing: 0.3px;
      background: linear-gradient(135deg, #ffffff, #d9d9d9);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
    }

    .form-submit:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
      filter: brightness(1.02);
    }

    .form-submit:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    .img-box img {
      width: 100%;
      height: 100%;
      object-fit: cover; /* o "contain" si no quieres recorte */
      display: block;
    }
  `,
})
export class LoginForm {
  profileForm = new FormGroup({
    username: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required),
  });
  @Input() logIn: (username: string, password: string) => void = () => {};
  usernameOut = output<string>();

  onSubmit() {
    console.log('Usuario:', this.profileForm.get('username')?.value);
    console.log('Contrasena:', this.profileForm.get('password')?.value);
    this.logIn(
      this.profileForm.get('username')?.value || '',
      this.profileForm.get('password')?.value || ''
    );
    this.usernameOut.emit(this.profileForm.get('username')?.value || '');
  }
}
