import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <div class="page-center">
      <div class="img-box">
        <form class="img-login-form" [formGroup]="profileForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <label for="email">Email:</label>
            <input id="email" type="email" formControlName="email" name="email" />
            <label for="password">Contrasena:</label>
            <input id="password" type="password" formControlName="password" name="password" />
            <button class="form-submit" type="submit" [disabled]="!profileForm.valid || submitting">
              @if (submitting) {
                Iniciando...
              } @else {
                Iniciar sesion
              }
            </button>
          </div>

          @if (errorMessage) {
            <p class="form-error">{{ errorMessage }}</p>
          }
        </form>
        <img src="/assets/LoginFormImage.png" alt="Imagen para formulario de login" />
      </div>
    </div>
  `,
  styles: `
    .img-box {
      padding-top: 30px;
      position: relative;
      width: 450px;
      height: 250px;
      overflow: hidden;
      border-radius: 8px;
    }

    .img-login-form {
      position: absolute;
      text-align: center;
      top: 25%;
      padding-top: 20px;
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

    .form-error {
      margin: 14px auto 0;
      max-width: 360px;
      color: #ffd7d7;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    }

    .img-box img {
      width: 100%;
      height: 150%;
      object-fit: cover;
      display: block;
      border-radius: 8px;
    }
  `,
})
export class LoginForm {
  profileForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  @Input() logIn: (email: string, password: string) => Promise<void> | void = () => {};
  @Input() submitting = false;
  @Input() errorMessage: string | null = null;

  async onSubmit(): Promise<void> {
    if (this.profileForm.invalid || this.submitting) {
      return;
    }

    const { email, password } = this.profileForm.getRawValue();
    await this.logIn(email, password);
  }
}
