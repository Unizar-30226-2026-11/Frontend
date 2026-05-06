import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { Register } from './register';
import { Auth } from '../services/auth';
import { RegisterForm } from './components/register-form/register-form';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let routerSpy: jasmine.SpyObj<Router>;
  let authSpy: jasmine.SpyObj<Auth>;

  beforeEach(async () => {
    vi.useRealTimers();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    authSpy = jasmine.createSpyObj<Auth>('Auth', ['register']);
    authSpy.register.and.resolveTo({
      message: 'Usuario registrado exitosamente.',
      user: {
        id: 'u_12',
        username: 'tester',
        email: 'tester@example.com',
      },
    });

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: Auth, useValue: authSpy },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('passes register state down to the register form', () => {
    component.error = 'Error de prueba';
    component.submitting = true;
    component.isRedirecting = false;
    fixture.detectChanges();

    const registerForm = fixture.debugElement.query(By.directive(RegisterForm)).componentInstance as RegisterForm;

    expect(registerForm.submitting).toBeTrue();
    expect(registerForm.errorMessage).toBe('Error de prueba');
    expect(registerForm.register).toBe(component.registerUser);
  });

  it('shows success feedback before redirecting to login', async () => {
    vi.useFakeTimers();

    const registerPromise = component.registerUser('tester@example.com', 'tester', 'abc123');
    await registerPromise;

    expect(component.error).toBeNull();
    expect(component.successMessage).toBe(
      'Registro completado correctamente. Redirigiendo a iniciar sesion...'
    );
    expect(component.isRedirecting).toBeTrue();
    expect(authSpy.register).toHaveBeenCalledOnceWith('tester@example.com', 'tester', 'abc123');
    expect(routerSpy.navigate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/login']);
  });

  it('shows the duplicate-user error returned during registration', async () => {
    authSpy.register.and.rejectWith(new Error('El usuario ya existe'));

    await component.registerUser('tester@example.com', 'tester', 'abc123');

    expect(component.error).toBe('El usuario ya existe');
    expect(component.successMessage).toBeNull();
    expect(component.isRedirecting).toBeFalsy();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('navigates to login when clicking the existing-account button', () => {
    component.goLogin();

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/login']);
  });
});
