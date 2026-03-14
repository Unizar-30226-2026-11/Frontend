import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';

import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [{ provide: Router, useValue: routerSpy }],
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
      username: 'tester',
      password: 'abc123',
      confirmPassword: 'xyz789',
    });

    component.onSubmit();

    expect(component.error).toBe('Las contraseñas no coinciden');
    expect(component.successMessage).toBeNull();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('shows success feedback before redirecting to login', fakeAsync(() => {
    component.registerForm.setValue({
      username: 'tester',
      password: 'abc123',
      confirmPassword: 'abc123',
    });

    component.onSubmit();

    expect(component.error).toBeNull();
    expect(component.successMessage).toBe(
      'Registro completado correctamente. Redirigiendo a iniciar sesion...'
    );
    expect(component.isRedirecting).toBeTrue();
    expect(routerSpy.navigate).not.toHaveBeenCalled();

    tick(1500);

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/login']);
  }));
});
