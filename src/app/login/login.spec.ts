import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ApiRequestError } from '../interfaces/api';
import { Auth } from '../services/auth';
import { DixitRealtime } from '../services/dixit-realtime';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authSpy: jasmine.SpyObj<Auth>;
  let realtimeSpy: jasmine.SpyObj<DixitRealtime>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<Auth>('Auth', ['logIn', 'activeGameId', 'setActiveGameId']);
    authSpy.activeGameId.and.returnValue(null);
    realtimeSpy = jasmine.createSpyObj<DixitRealtime>('DixitRealtime', ['restoreActiveGameConnection']);
    realtimeSpy.restoreActiveGameConnection.and.resolveTo();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: Auth, useValue: authSpy },
        { provide: DixitRealtime, useValue: realtimeSpy },
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

  it('goes to /menu and restores the active game connection when login returns one', async () => {
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

    expect(authSpy.setActiveGameId).toHaveBeenCalledOnceWith('A1B2', 'Stella');
    expect(realtimeSpy.restoreActiveGameConnection).toHaveBeenCalledOnceWith('A1B2');
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/menu');
  });

  it('clears a stale active game and goes to /menu when recovery returns 404', async () => {
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
    authSpy.activeGameId.and.returnValue('A1B2');
    realtimeSpy.restoreActiveGameConnection.and.rejectWith(
      new ApiRequestError('Sala no encontrada', 404)
    );

    await component.logIn('tester@example.com', 'secret');

    expect(authSpy.setActiveGameId).toHaveBeenCalledWith('A1B2', 'Stella');
    expect(authSpy.setActiveGameId).toHaveBeenCalledWith(null);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/menu');
  });

  it('shows the API error when authentication fails', async () => {
    authSpy.logIn.and.rejectWith(new Error('Credenciales invalidas'));

    await component.logIn('tester@example.com', 'wrong');

    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    expect(component.error).toBe('Credenciales invalidas');
    expect(component.submitting).toBeFalse();
  });
});
