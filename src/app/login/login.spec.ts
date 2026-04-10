import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Auth } from '../services/auth';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authSpy: jasmine.SpyObj<Auth>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<Auth>('Auth', ['logIn']);

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: Auth, useValue: authSpy }],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('logs in through Auth and redirects to the main menu', async () => {
    authSpy.logIn.and.resolveTo({
      token: 'token-123',
      activeGameId: null,
      user: {
        id: 'u_1',
        username: 'tester',
        email: 'tester@example.com',
      },
    });

    await component.logIn('tester@example.com', 'secret');

    expect(authSpy.logIn).toHaveBeenCalledWith('tester@example.com', 'secret');
    expect(router.navigate).toHaveBeenCalledWith(['/games']);
    expect(component.error).toBeNull();
    expect(component.submitting).toBeFalse();
  });

  it('redirects straight to the active game when login returns one', async () => {
    authSpy.logIn.and.resolveTo({
      token: 'token-123',
      activeGameId: 'A1B2',
      user: {
        id: 'u_1',
        username: 'tester',
        email: 'tester@example.com',
      },
    });

    await component.logIn('tester@example.com', 'secret');

    expect(router.navigate).toHaveBeenCalledWith(['/dixit', 'A1B2']);
  });

  it('shows the API error when authentication fails', async () => {
    authSpy.logIn.and.rejectWith(new Error('Credenciales invalidas'));

    await component.logIn('tester@example.com', 'wrong');

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.error).toBe('Credenciales invalidas');
    expect(component.submitting).toBeFalse();
  });
});
