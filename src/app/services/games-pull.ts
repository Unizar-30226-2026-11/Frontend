import { Injectable } from '@angular/core';
import { Game } from '../interfaces/game';

interface PlaceholderPost {
  id: number;
  title: string;
  body: string;
}

@Injectable({
  providedIn: 'root',
})
export class GamesPull {
  private readonly gamesEndpoint = 'https://jsonplaceholder.typicode.com/posts';
  private readonly cache = new Map<string, Game[]>();

  getGames(
    page: number,
    pageSize: number,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Game[]> {
    const cacheKey = `games:list:${page}:${pageSize}`;
    const cachedGames = this.cache.get(cacheKey);
    if (cachedGames && !options.forceRefresh) {
      return Promise.resolve(cachedGames);
    }

    return this.fetchGames(page, pageSize).then((games) => {
      this.cache.set(cacheKey, games);
      return games;
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async fetchGames(page: number, pageSize: number): Promise<Game[]> {
    const response = await fetch(this.gamesEndpoint);
    if (!response.ok) {
      throw new Error('No se pudo cargar la lista de juegos');
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new Error('Formato de respuesta invalido para la lista de juegos');
    }

    const validPosts = body.filter((value): value is PlaceholderPost => this.isPlaceholderPost(value));
    return validPosts.slice((page - 1) * pageSize, page * pageSize).map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      image: `https://picsum.photos/200/300?random=${item.id}`,
    }));
  }

  private isPlaceholderPost(value: unknown): value is PlaceholderPost {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<PlaceholderPost>;
    return (
      typeof candidate.id === 'number' &&
      typeof candidate.title === 'string' &&
      typeof candidate.body === 'string'
    );
  }
}
