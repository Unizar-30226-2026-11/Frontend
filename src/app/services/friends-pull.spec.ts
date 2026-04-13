import { TestBed } from '@angular/core/testing';

import { ApiClient } from './api-client';
import { Auth } from './auth';
import { FriendsPull } from './friends-pull';

describe('FriendsPull', () => {
  let service: FriendsPull;
  let apiClientSpy: jasmine.SpyObj<ApiClient>;

  beforeEach(() => {
    apiClientSpy = jasmine.createSpyObj<ApiClient>('ApiClient', [
      'request',
      'invalidateCache',
    ]);

    TestBed.configureTestingModule({
      providers: [
        FriendsPull,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: Auth, useValue: { token: () => 'demo-token' } },
      ],
    });

    service = TestBed.inject(FriendsPull);
  });

  it('loads friends and pending requests together', async () => {
    apiClientSpy.request.and.returnValues(
      Promise.resolve({
        friends: [
          {
            id: 'u_456',
            username: 'PlayerDos',
            status: 'online',
          },
        ],
      }),
      Promise.resolve({
        pendingRequests: [
          {
            id: 'req_001',
            fromUserId: 'u_999',
            fromUsername: 'Ninja',
            createdAt: '2026-03-01T10:00:00Z',
          },
        ],
      })
    );

    const result = await service.getFriendsPanelData();

    expect(apiClientSpy.request.calls.count()).toBe(2);
    expect(result).toEqual({
      friends: [
        {
          id: 'u_456',
          username: 'PlayerDos',
          status: 'online',
        },
      ],
      pendingRequests: [
        {
          id: 'req_001',
          fromUserId: 'u_999',
          fromUsername: 'Ninja',
          createdAt: '2026-03-01T10:00:00Z',
        },
      ],
    });
  });

  it('falls back to fromUserId when a pending request has no fromUsername', async () => {
    apiClientSpy.request.and.returnValues(
      Promise.resolve({
        friends: [],
      }),
      Promise.resolve({
        pendingRequests: [
          {
            id: 'req_16_1',
            fromUserId: 'u_16',
            toUserId: 'u_1',
            createdAt: '2026-04-13T14:22:59.215Z',
          },
        ],
      })
    );

    const result = await service.getFriendsPanelData();

    expect(result.pendingRequests).toEqual([
      {
        id: 'req_16_1',
        fromUserId: 'u_16',
        fromUsername: 'u_16',
        createdAt: '2026-04-13T14:22:59.215Z',
      },
    ]);
  });

  it('sends a friend request', async () => {
    apiClientSpy.request.and.resolveTo({
      message: 'Solicitud de amistad enviada con exito.',
    });

    const message = await service.sendFriendRequest('u_789');

    expect(message).toBe('Solicitud de amistad enviada con exito.');
    expect(apiClientSpy.invalidateCache).toHaveBeenCalledWith('/friends');
  });
});
