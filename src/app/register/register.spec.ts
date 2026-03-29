import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Register } from './register';
import { Auth } from '../services/auth';

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

  it('shows an error when passwords do not match', () => {
    component.registerForm.setValue({
      email: 'tester@example.com',
      username: 'tester',
      password: 'abc123',
      confirmPassword: 'xyz789',
    });

    void component.onSubmit();

    expect(component.error).toBe('Las contrasenas no coinciden');
    expect(component.successMessage).toBeNull();
    expect(authSpy.register).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('shows success feedback before redirecting to login', fakeAsync(() => {
    component.registerForm.setValue({
      email: 'tester@example.com',
      username: 'tester',
      password: 'abc123',
      confirmPassword: 'abc123',
    });

    void component.onSubmit();
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

  it('shows the duplicate-user error returned during registration', fakeAsync(() => {
    authSpy.register.and.rejectWith(new Error('El usuario ya existe'));

    component.registerForm.setValue({
      email: 'tester@example.com',
      username: 'tester',
      password: 'abc123',
      confirmPassword: 'abc123',
    });

    void component.onSubmit();
    flushMicrotasks();

    expect(component.error).toBe('El usuario ya existe');
    expect(component.successMessage).toBeNull();
    expect(component.isRedirecting).toBeFalsy();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  }));

  it('navigates to login when clicking the existing-account button', () => {
    component.goLogin();

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/login']);
  });
});
