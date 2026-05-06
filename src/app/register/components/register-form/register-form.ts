import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators, ValidatorFn, AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-register-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './register-form.html',
  styleUrl: './register-form.css',
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
