import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators, ValidatorFn, AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-register-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <section class="register-shell">
      <div class="register-card">
        <img class="register-art" src="/assets/LoginFormImage.png" alt="Imagen para formulario de register" />

        <form class="register-form" [formGroup]="profileForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email" name="email" />

            <label for="username">Usuario</label>
            <input id="username" type="text" formControlName="username" name="usuario" />

            <label for="password">Contraseña</label>
            <input id="password" type="password" formControlName="password" name="password" />

            <label for="password_2">Repetir contraseña</label>
            <input id="password_2" type="password" formControlName="password_2" name="password_2" />
          </div>

          <button class="form-submit" type="submit" [disabled]="!profileForm.valid || submitting">
            @if (submitting) {
              Registrando...
            } @else {
              Registrarse
            }
          </button>

          @if (errorMessage) {
            <p class="form-error">{{ errorMessage }}</p>
          }
          @if (profileForm.hasError('passwordMismatch') && profileForm.get('password_2')?.touched) {
            <p class="form-error">Las contraseñas no coinciden</p>
          }
        </form>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      width: min(100%, 720px);
    }

    .register-shell {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .register-card {
      position: relative;
      width: min(100%, 720px);
      overflow: hidden;
      border-radius: 22px;
      border: 1px solid rgba(232, 217, 168, 0.4);
      background:
        linear-gradient(135deg, rgba(12, 52, 88, 0.78) 0%, rgba(20, 97, 136, 0.58) 44%, rgba(241, 232, 191, 0.2) 100%);
      box-shadow:
        0 22px 44px rgba(8, 26, 46, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.16);
      backdrop-filter: blur(8px);
    }

    .register-art {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.38;
      filter: saturate(1.05) contrast(1.02);
    }

    .register-card::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(7, 19, 34, 0.6) 0%, rgba(7, 19, 34, 0.26) 100%);
    }

    .register-form {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      padding: 32px 38px 22px;
      box-sizing: border-box;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr);
      gap: 12px 18px;
      align-items: center;
    }

    .form-grid label {
      color: rgba(245, 246, 251, 0.96);
      font-size: 1rem;
      font-weight: 700;
      text-align: right;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
    }

    .form-grid input {
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
      height: 46px;
      padding: 0 16px;
      border: 1px solid rgba(233, 238, 244, 0.2);
      border-radius: 14px;
      color: #f5f5f5;
      font-size: 1rem;
      background: rgba(13, 31, 43, 0.62);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .form-grid input::placeholder {
      color: rgba(255, 255, 255, 0.55);
    }

    .form-grid input:focus {
      border-color: rgba(232, 217, 168, 0.78);
      box-shadow: 0 0 0 3px rgba(232, 217, 168, 0.2);
      background: rgba(13, 31, 43, 0.8);
    }

    .form-submit {
      align-self: flex-end;
      min-width: 220px;
      height: 48px;
      margin-top: 2px;
      border: 2px solid #355652;
      border-radius: 14px;
      padding: 0 28px;
      color: #10211f;
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: 0.3px;
      background: linear-gradient(180deg, #ecf5f2 0%, #d9ece8 100%);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease, opacity 120ms ease;
    }

    .form-submit:hover:not(:disabled) {
      transform: translateY(-1px) scale(1.01);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
      filter: brightness(1.02);
    }

    .form-submit:disabled {
      cursor: not-allowed;
      opacity: 0.72;
    }

    .form-error {
      margin: 0;
      max-width: 100%;
      color: #ffd7d7;
      font-weight: 600;
      line-height: 1.35;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    }

    @media (max-width: 760px) {
      .register-form {
        padding: 24px 20px 18px;
        gap: 12px;
      }

      .form-grid {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .form-grid label {
        text-align: left;
        font-size: 0.96rem;
      }

      .form-grid input {
        height: 44px;
      }

      .form-submit {
        width: 100%;
        min-width: 0;
        margin-top: 4px;
      }
    }

    @media (max-width: 480px) {
      .register-card {
        border-radius: 18px;
      }

      .register-form {
        padding: 18px 14px 14px;
        gap: 10px;
      }

      .form-grid {
        gap: 6px;
      }

      .form-grid input {
        height: 42px;
        padding: 0 14px;
        border-radius: 12px;
      }

      .form-grid label {
        font-size: 0.92rem;
      }

      .form-submit {
        height: 44px;
        padding: 0 20px;
        border-radius: 12px;
        font-size: 0.96rem;
      }

      .form-error {
        font-size: 0.92rem;
      }
    }

  `,
})
export class RegisterForm {

  passwordsMatchValidator: ValidatorFn = (
    control: AbstractControl
  ): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const password2 = control.get('password_2')?.value;
    return password === password2 ? null : { passwordMismatch: true };
  };

  profileForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password_2: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  },
  {
    validators: [this.passwordsMatchValidator],
  });

  @Input() register: (email: string, username: string, password: string) => Promise<void> | void = () => {};
  @Input() submitting = false;
  @Input() errorMessage: string | null = null;

  async onSubmit(): Promise<void> {
    if (this.profileForm.invalid || this.submitting) {
      return;
    }

    const { email, username, password } = this.profileForm.getRawValue();
    await this.register(email, username, password);
  }
}
