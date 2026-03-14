import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
                [disabled]="!registerForm.valid">
          Registrarse
        </button>

      </form>

      <button class="login-button" (click)="goLogin()">Ya tengo una cuenta</button>

      <p *ngIf="error" class="error">{{ error }}</p>

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
      font-size: clamp(56px, 8vw, 100px);
      color: #f2d78c;
      text-shadow: 2px 2px 6px black;
      font-family: "FuenteDilana", sans-serif;
      margin: 0;
      margin-top: -110px;
      text-align: center;
      margin-bottom: 110px;
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
  `
})
export class Register {

  private router = inject(Router);

  error: string | null = null;

  registerForm = new FormGroup({
    username: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required),
    confirmPassword: new FormControl('', Validators.required),
  });

  onSubmit() {

    const { password, confirmPassword } = this.registerForm.value;

    if (password !== confirmPassword) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }

    console.log('Registro correcto', this.registerForm.value);

    this.router.navigate(['/login']);
  }

  goLogin() {
    this.router.navigate(['/']);
  }
}
