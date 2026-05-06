import { Injectable, inject } from '@angular/core';

import { Auth } from './auth';
import { ApiClient } from './api-client';

export interface UserBoardSummary {
  id: string;
  image: string;
}

interface UserBoardsApiResponse {
  boards?: Array<{
    id?: string;
    name?: string;
    description?: string;
    url_image?: string;
  }>;
}

interface ActivateBoardApiResponse {
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BoardsPull {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly defaultImage = '/assets/Tablero.png';

  async getUserBoards(options: { forceRefresh?: boolean } = {}): Promise<UserBoardSummary[]> {
    const token = this.requireToken();
    const response = await this.apiClient.request<UserBoardsApiResponse>('/users/boards', {
      token,
      ttlMs: 20_000,
      forceRefresh: options.forceRefresh,
    });

    return (response.boards ?? [])
      .map((board) => this.normalizeBoard(board))
      .filter((board): board is UserBoardSummary => board !== null);
  }

  async activateBoard(boardId: string): Promise<string> {
    const normalizedBoardId = boardId.trim();
    if (!normalizedBoardId) {
      throw new Error('Debes seleccionar un tablero');
    }

    const token = this.requireToken();
    const response = await this.apiClient.request<ActivateBoardApiResponse>('/users/boards/active', {
      method: 'POST',
      token,
      body: { boardId: normalizedBoardId },
      useCache: false,
    });

    this.apiClient.invalidateCache('/users/boards');
    return response.message?.trim() || 'Tablero activado correctamente.';
  }

  private normalizeBoard(
    board:
      | {
          id?: string;
          name?: string;
          description?: string;
          url_image?: string;
        }
      | null
      | undefined
  ): UserBoardSummary | null {
    if (!board || typeof board.id !== 'string' || !board.id.trim()) {
      return null;
    }

    return {
      id: board.id.trim(),
      image:
        typeof board.url_image === 'string' && board.url_image.trim()
          ? board.url_image.trim()
          : this.defaultImage,
    };
  }

  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para consultar los tableros');
    }

    return token;
  }
}
