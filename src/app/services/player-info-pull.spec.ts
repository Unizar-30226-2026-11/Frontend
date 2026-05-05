import { TestBed } from '@angular/core/testing';
import { ApiClient } from './api-client';
import { Auth } from './auth';
import { PlayerInfoPull } from './player-info-pull';

describe('PlayerInfoPull', () => {
  let service: PlayerInfoPull;
  let apiClientSpy: jasmine.SpyObj<ApiClient>;

  beforeEach(() => {
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', [
      'request',
      'setCache',
      'buildCacheKey',
      'invalidateCache',
    ]);
    apiClientSpy.buildCacheKey.and.returnValue('cache-key');

    TestBed.configureTestingModule({
      providers: [
        PlayerInfoPull,
        { provide: ApiClient, useValue: apiClientSpy },
        {
          provide: Auth,
          useValue: {
            token: () => 'token-123',
          },
        },
      ],
    });

    service = TestBed.inject(PlayerInfoPull);
  });

  it('normalizes CONNECTED-like states from the profile response', async () => {
    apiClientSpy.request.and.returnValues(
      Promise.resolve({
        profile: {
          id_user: 12,
          username: 'tester',
          email: 'tester@example.com',
          exp_level: 7,
          progress_level: 45,
          state: 'online',
          personal_state: 'ready',
          id: 'u_12',
        },
      }),
      Promise.resolve({
        balance: 250,
      })
    );

    await expectAsync(service.getPlayerInfo()).toBeResolvedTo({
      id: 'u_12',
      legacyUserId: 12,
      username: 'tester',
      email: 'tester@example.com',
      experienceLevel: 7,
      progressLevel: 45,
      state: 'CONNECTED',
      personalState: 'ready',
      balance: 250,
    });
  });

  it('keeps UNKNOWN when the backend returns it', async () => {
    apiClientSpy.request.and.returnValues(
      Promise.resolve({
        profile: {
          id_user: 12,
          username: 'tester',
          email: 'tester@example.com',
          exp_level: 7,
          progress_level: 45,
          state: 'UNKNOWN',
          personal_state: 'ready',
          id: 'u_12',
        },
      }),
      Promise.resolve({
        balance: {
          coins: 125,
        },
      })
    );

    await expectAsync(service.getPlayerInfo()).toBeResolvedTo({
      id: 'u_12',
      legacyUserId: 12,
      username: 'tester',
      email: 'tester@example.com',
      experienceLevel: 7,
      progressLevel: 45,
      state: 'UNKNOWN',
      personalState: 'ready',
      balance: 125,
    });
  });

  it('accepts the older nested balance field while migrating cached responses', async () => {
    apiClientSpy.request.and.returnValues(
      Promise.resolve({
        profile: {
          id_user: 12,
          username: 'tester',
          email: 'tester@example.com',
          exp_level: 7,
          progress_level: 45,
          state: 'online',
          personal_state: 'ready',
          id: 'u_12',
        },
      }),
      Promise.resolve({
        balance: {
          balance: 80,
        },
      })
    );

    await expectAsync(service.getPlayerInfo()).toBeResolvedTo({
      id: 'u_12',
      legacyUserId: 12,
      username: 'tester',
      email: 'tester@example.com',
      experienceLevel: 7,
      progressLevel: 45,
      state: 'CONNECTED',
      personalState: 'ready',
      balance: 80,
    });
  });

  it('updates the username through the profile endpoint', async () => {
    apiClientSpy.request.and.resolveTo({ message: 'Nombre de usuario actualizado' });

    await expectAsync(service.updateUsername('new_tester')).toBeResolvedTo(
      'Nombre de usuario actualizado'
    );

    expect(apiClientSpy.request).toHaveBeenCalledWith('/users/profile', {
      method: 'PUT',
      token: 'token-123',
      body: { username: 'new_tester' },
      useCache: false,
    });
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/users/profile');
  });

  it('updates the player status through the status endpoint', async () => {
    apiClientSpy.request.and.resolveTo({ message: 'Estado actualizado' });

    await expectAsync(service.updateStatus('DISCONNECTED')).toBeResolvedTo(
      'Estado actualizado'
    );

    expect(apiClientSpy.request).toHaveBeenCalledWith('/users/status', {
      method: 'PATCH',
      token: 'token-123',
      body: { status: 'DISCONNECTED' },
      useCache: false,
    });
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/users/profile');
  });

  it('deletes the account through the profile endpoint', async () => {
    apiClientSpy.request.and.resolveTo({ message: 'Cuenta eliminada correctamente' });

    await expectAsync(service.deleteAccount()).toBeResolvedTo(
      'Cuenta eliminada correctamente'
    );

    expect(apiClientSpy.request).toHaveBeenCalledWith('/users/profile', {
      method: 'DELETE',
      token: 'token-123',
      useCache: false,
    });
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/users/');
  });
});
