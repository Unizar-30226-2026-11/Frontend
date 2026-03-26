import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Register } from './register';
import { Auth } from '../services/auth';
import { RegisterForm } from './components/register-form/register-form';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let routerSpy: jasmine.SpyObj<Router>;
  let authSpy: jasmine.SpyObj<Auth>;

  beforeEach(async () => {
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

  it('shows success feedback before redirecting to login', fakeAsync(() => {
    void component.registerUser('tester@example.com', 'tester', 'abc123');
    flushMicrotasks();

    expect(component.error).toBeNull();
    expect(component.successMessage).toBe(
      'Registro completado correctamente. Redirigiendo a iniciar sesion...'
    );
    expect(component.isRedirecting).toBeTrue();
    expect(authSpy.register).toHaveBeenCalledOnceWith('tester@example.com', 'tester', 'abc123');
    expect(routerSpy.navigate).not.toHaveBeenCalled();

    tick(1500);

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/login']);
  }));
});
