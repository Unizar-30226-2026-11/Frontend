import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth } from '../services/auth';
import { RegisterForm } from './components/register-form/register-form';

const REDIRECT_DELAY_MS = 1500;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RegisterForm],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register implements OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private redirectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  error: string | null = null;
  successMessage: string | null = null;
  submitting = false;
  isRedirecting = false;

  // Lógica anterior mantenida como referencia tras mover el formulario al componente hijo.
  // registerForm = new FormGroup({
  //   email: new FormControl('', {
  //     nonNullable: true,
  //     validators: [Validators.required, Validators.email],
  //   }),
  //   username: new FormControl('', {
  //     nonNullable: true,
  //     validators: [Validators.required],
  //   }),
  //   password: new FormControl('', {
  //     nonNullable: true,
  //     validators: [Validators.required],
  //   }),
  //   confirmPassword: new FormControl('', {
  //     nonNullable: true,
  //     validators: [Validators.required],
  //   }),
  // });
  //
  // async onSubmit(): Promise<void> {
  //   if (this.registerForm.invalid || this.submitting || this.isRedirecting) {
  //     return;
  //   }
  //
  //   this.error = null;
  //   this.successMessage = null;
  //
  //   const { email, username, password, confirmPassword } = this.registerForm.getRawValue();
  //
  //   if (password !== confirmPassword) {
  //     this.error = 'Las contrasenas no coinciden';
  //     this.isRedirecting = false;
  //     return;
  //   }
  //
  //   this.submitting = true;
  //
  //   try {
  //     await this.auth.register(email, username, password);
  //     this.isRedirecting = true;
  //     this.clearRedirectTimeout();
  //     this.successMessage = 'Registro completado correctamente. Redirigiendo a iniciar sesion...';
  //
  //     this.redirectTimeoutId = setTimeout(() => {
  //       void this.router.navigate(['/login']);
  //     }, REDIRECT_DELAY_MS);
  //   } catch (error: unknown) {
  //     this.error = error instanceof Error ? error.message : 'No se pudo completar el registro';
  //     this.isRedirecting = false;
  //   } finally {
  //     this.submitting = false;
  //   }
  // }

  readonly registerUser = async (email: string, username: string, password: string): Promise<void> => {
    if (this.submitting || this.isRedirecting) {
      return;
    }

    this.error = null;
    this.successMessage = null;
    this.submitting = true;

    try {
      await this.auth.register(email, username, password);
      this.isRedirecting = true;
      this.clearRedirectTimeout();
      this.successMessage = 'Registro completado correctamente. Redirigiendo a iniciar sesion...';

      this.redirectTimeoutId = setTimeout(() => {
        void this.router.navigate(['/login']);
      }, REDIRECT_DELAY_MS);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'No se pudo completar el registro';
      this.isRedirecting = false;
    } finally {
      this.submitting = false;
    }
  };

  goLogin() {
    void this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.clearRedirectTimeout();
  }

  private clearRedirectTimeout(): void {
    if (this.redirectTimeoutId !== null) {
      clearTimeout(this.redirectTimeoutId);
      this.redirectTimeoutId = null;
    }
  }
}
