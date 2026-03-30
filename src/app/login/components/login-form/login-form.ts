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
            <div class="form-error" role="alert" aria-live="polite">
              <span class="form-error-icon" aria-hidden="true">!</span>
              <p>{{ errorMessage }}</p>
            </div>
          }
        </form>
        <img src="/assets/LoginFormImage.png" alt="Imagen para formulario de login" />
      </div>
    </div>
  `,
  styles: `
    .page-center {
      width: 100%;
      display: grid;
      place-items: center;
    }

    .img-box {
      position: relative;
      width: var(--panel-width-wide);
      aspect-ratio: 1.8 / 1;
      overflow: hidden;
      border-radius: clamp(0.75rem, 1vw, 1rem);
    }

    .img-login-form {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      z-index: 1;
      pointer-events: auto;
    }

    .form-grid {
      display: grid;
      grid-template-columns: minmax(5.8rem, 7rem) 1fr;
      gap: clamp(0.65rem, 1.2vh, 0.9rem) clamp(0.8rem, 1.5vw, 1rem);
      align-items: center;
      width: min(80%, 22rem);
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
      min-height: clamp(2.35rem, 4vh, 2.8rem);
      padding: 0 var(--field-padding-x);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: var(--field-radius);
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
      min-height: clamp(2.5rem, 4.3vh, 3rem);
      margin-top: 0.5rem;
      border: none;
      border-radius: var(--button-radius);
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
      margin: 0.9rem auto 0;
      width: min(80%, 22rem);
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      box-sizing: border-box;
      border-radius: clamp(0.75rem, 1vw, 1rem);
      border: 1px solid rgba(255, 179, 179, 0.45);
      background: linear-gradient(180deg, rgba(96, 20, 20, 0.88), rgba(62, 12, 12, 0.82));
      color: #ffe7e2;
      box-shadow: 0 12px 28px rgba(12, 4, 4, 0.35);
      backdrop-filter: blur(8px);
    }

    .form-error p {
      margin: 0;
      font-weight: 600;
      line-height: 1.35;
      text-align: left;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    }

    .form-error-icon {
      flex: 0 0 auto;
      width: 1.4rem;
      height: 1.4rem;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      background: rgba(255, 234, 224, 0.18);
      border: 1px solid rgba(255, 231, 226, 0.4);
      font-size: 0.9rem;
      font-weight: 800;
      line-height: 1;
    }

    .img-box img {
      width: 100%;
      height: 120%;
      object-fit: cover;
      display: block;
      border-radius: clamp(0.75rem, 1vw, 1rem);
    }

    @media (max-width: 640px) {
      .img-box {
        aspect-ratio: 1.2 / 1;
      }

      .form-grid {
        grid-template-columns: 1fr;
        width: min(86%, 20rem);
      }

      .form-grid label {
        text-align: left;
      }

      .form-error {
        width: min(86%, 20rem);
      }
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
