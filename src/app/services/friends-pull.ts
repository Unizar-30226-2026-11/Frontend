import { Injectable, inject } from '@angular/core';
import { Auth } from './auth';
import { ApiClient } from './api-client';

interface FriendsResponse {
  friends?: unknown;
}

interface FriendRequestsResponse {
  pendingRequests?: unknown;
}

interface FriendApi {
  id?: unknown;
  username?: unknown;
  status?: unknown;
}

interface PendingFriendRequestApi {
  id?: unknown;
  fromUserId?: unknown;
  fromUsername?: unknown;
  toUserId?: unknown;
  createdAt?: unknown;
}

interface FriendRequestMutationResponse {
  message?: unknown;
}

export interface Friend {
  id: string;
  username: string;
  status: string;
}

export interface PendingFriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  createdAt: string;
}

export interface FriendsPanelData {
  friends: Friend[];
  pendingRequests: PendingFriendRequest[];
}

@Injectable({
  providedIn: 'root',
})
export class FriendsPull {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);

  getFriendsPanelData(options: { forceRefresh?: boolean } = {}): Promise<FriendsPanelData> {
    return Promise.all([
      this.getFriends(options),
      this.getPendingRequests(options),
    ]).then(([friends, pendingRequests]) => ({
      friends,
      pendingRequests,
    }));
  }

  async getFriends(options: { forceRefresh?: boolean } = {}): Promise<Friend[]> {
    const token = this.requireToken();
    const response = await this.apiClient.request<FriendsResponse>('/friends', {
      token,
      ttlMs: 20_000,
      forceRefresh: options.forceRefresh,
    });

    if (!Array.isArray(response.friends)) {
      throw new Error('Formato de respuesta invalido para los amigos');
    }

    return response.friends.map((friend) => this.normalizeFriend(friend));
  }

  async getPendingRequests(
    options: { forceRefresh?: boolean } = {}
  ): Promise<PendingFriendRequest[]> {
    const token = this.requireToken();
    const response = await this.apiClient.request<FriendRequestsResponse>('/friends/requests', {
      token,
      ttlMs: 10_000,
      forceRefresh: options.forceRefresh,
    });

    if (!Array.isArray(response.pendingRequests)) {
      throw new Error('Formato de respuesta invalido para las solicitudes de amistad');
    }

    return response.pendingRequests.map((request) => this.normalizePendingRequest(request));
  }

  async sendFriendRequest(targetUserId: string): Promise<string> {
    const token = this.requireToken();
    const response = await this.apiClient.request<FriendRequestMutationResponse>(
      '/friends/requests',
      {
        method: 'POST',
        token,
        body: { targetUserId },
        useCache: false,
      }
    );

    this.invalidateFriendsCache();
    return this.extractMessage(response, 'Solicitud de amistad enviada');
  }

  async respondToFriendRequest(
    requestId: string,
    action: 'accept' | 'reject'
  ): Promise<string> {
    const token = this.requireToken();
    const response = await this.apiClient.request<FriendRequestMutationResponse>(
      `/friends/requests/${requestId}`,
      {
        method: 'PUT',
        token,
        body: { action },
        useCache: false,
      }
    );

    this.invalidateFriendsCache();
    return this.extractMessage(response, 'Solicitud procesada');
  }

  async removeFriend(friendId: string): Promise<string> {
    const token = this.requireToken();
    const response = await this.apiClient.request<FriendRequestMutationResponse>(
      `/friends/${friendId}`,
      {
        method: 'DELETE',
        token,
        useCache: false,
      }
    );

    this.invalidateFriendsCache();
    return this.extractMessage(response, 'Amigo eliminado');
  }

  private normalizeFriend(value: unknown): Friend {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Formato de amigo invalido');
    }

    const friend = value as FriendApi;
    if (
      typeof friend.id !== 'string' ||
      typeof friend.username !== 'string' ||
      typeof friend.status !== 'string'
    ) {
      throw new Error('Formato de amigo invalido');
    }

    return {
      id: friend.id,
      username: friend.username,
      status: friend.status,
    };
  }

  private normalizePendingRequest(value: unknown): PendingFriendRequest {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Formato de solicitud de amistad invalido');
    }

    const request = value as PendingFriendRequestApi;
    if (
      typeof request.id !== 'string' ||
      typeof request.fromUserId !== 'string' ||
      typeof request.createdAt !== 'string'
    ) {
      throw new Error('Formato de solicitud de amistad invalido');
    }

    const fromUsername =
      typeof request.fromUsername === 'string' && request.fromUsername.trim().length > 0
        ? request.fromUsername.trim()
        : request.fromUserId;

    return {
      id: request.id,
      fromUserId: request.fromUserId,
      fromUsername,
      createdAt: request.createdAt,
    };
  }

  private extractMessage(response: FriendRequestMutationResponse, fallback: string): string {
    return typeof response.message === 'string' && response.message.trim().length > 0
      ? response.message
      : fallback;
  }

  private invalidateFriendsCache(): void {
    this.apiClient.invalidateCache('/friends');
  }

  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para consultar tus amigos');
    }

    return token;
  }
}
