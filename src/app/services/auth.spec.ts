import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';
import { ApiClient } from './api-client';

describe('Auth', () => {
  let service: Auth;
  let apiClientSpy: jasmine.SpyObj<ApiClient>;

  beforeEach(() => {
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', ['request', 'invalidateCache']);
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        Auth,
        { provide: ApiClient, useValue: apiClientSpy },
      ],
    });

    service = TestBed.inject(Auth);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns a duplicated-user error when the backend says the user already exists', async () => {
    apiClientSpy.request.and.rejectWith(new Error('email/username already used'));

    try {
      await service.register('tester@example.com', 'tester', 'abc123');
      fail('Expected register to reject for a duplicated user');
    } catch (error: unknown) {
      expect(error).toEqual(new Error('El usuario ya existe'));
    }
  });

  it('keeps other backend registration errors unchanged', async () => {
    apiClientSpy.request.and.rejectWith(new Error('No se pudo conectar con el servidor'));

    try {
      await service.register('tester@example.com', 'tester', 'abc123');
      fail('Expected register to reject for a backend error');
    } catch (error: unknown) {
      expect(error).toEqual(new Error('No se pudo conectar con el servidor'));
    }
  });
});
