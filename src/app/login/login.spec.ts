import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { Auth } from '../services/auth';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authSpy: jasmine.SpyObj<Auth>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<Auth>('Auth', ['logIn']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: Auth, useValue: authSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('logs in through Auth and redirects to the main menu', async () => {
    authSpy.logIn.and.resolveTo({
      token: 'token-123',
      activeGameId: null,
      activeGameEngine: null,
      user: {
        id: 'u_1',
        username: 'tester',
        email: 'tester@example.com',
      },
    });

    await component.logIn('tester@example.com', 'secret');

    expect(authSpy.logIn).toHaveBeenCalledWith('tester@example.com', 'secret');
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/menu');
    expect(component.error).toBeNull();
    expect(component.submitting).toBeFalse();
  });

  it('redirects straight to the active game when login returns one', async () => {
    authSpy.logIn.and.resolveTo({
      token: 'token-123',
      activeGameId: 'A1B2',
      activeGameEngine: 'Stella',
      user: {
        id: 'u_1',
        username: 'tester',
        email: 'tester@example.com',
      },
    });

    await component.logIn('tester@example.com', 'secret');

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/game/A1B2');
  });

  it('shows the API error when authentication fails', async () => {
    authSpy.logIn.and.rejectWith(new Error('Credenciales invalidas'));

    await component.logIn('tester@example.com', 'wrong');

    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    expect(component.error).toBe('Credenciales invalidas');
    expect(component.submitting).toBeFalse();
  });
});
