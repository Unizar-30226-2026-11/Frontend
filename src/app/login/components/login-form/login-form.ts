import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css',
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
