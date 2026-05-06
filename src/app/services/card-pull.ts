import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client';
import { Auth } from './auth';

export interface DeckCard {
  code: string;
  image: string;
  value: string;
  suit: string;
}

interface UserCardsResponse {
  cards?: unknown;
}

interface CardRecordApi {
  card_id?: unknown;
  cardId?: unknown;
  code?: unknown;
  id?: unknown;
  idCard?: unknown;
  id_card?: unknown;
  image?: unknown;
  url_image?: unknown;
  image_url?: unknown;
  imageUrl?: unknown;
  name?: unknown;
  title?: unknown;
  url?: unknown;
  value?: unknown;
  suit?: unknown;
  collection?: unknown;
}

const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';

@Injectable({
  providedIn: 'root',
})
export class CardPull {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);

  async getCards(
    count?: number,
    options: { forceRefresh?: boolean } = {}
  ): Promise<DeckCard[]> {
    const token = this.requireToken();
    const response = await this.apiClient.request<UserCardsResponse>('/users/cards', {
      token,
      ttlMs: 20_000,
      forceRefresh: options.forceRefresh,
    });
    const cards = this.extractCards(response)
      .map((card, index) => this.normalizeCard(card, index))
      .filter((card): card is DeckCard => card !== null);
    const resolvedCount =
      typeof count === 'number' && Number.isFinite(count)
        ? Math.max(0, Math.floor(count))
        : cards.length;

    return cards.slice(0, resolvedCount);
  }

  private extractCards(response: UserCardsResponse): CardRecordApi[] {
    const candidate = response.cards;

    if (Array.isArray(candidate)) {
      return candidate as CardRecordApi[];
    }

    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      Array.isArray((candidate as { cards?: unknown }).cards)
    ) {
      return (candidate as { cards: CardRecordApi[] }).cards;
    }

    throw new Error('Formato de respuesta invalido para las cartas');
  }

  private normalizeCard(card: CardRecordApi, index: number): DeckCard | null {
    const code =
      this.readCardCode(card, ['code', 'cardId', 'card_id', 'id', 'idCard', 'id_card']) ??
      `card-${index + 1}`;
    if (!code.trim()) {
      return null;
    }

    return {
      code,
      image:
        this.readString(card, ['image', 'imageUrl', 'image_url', 'url_image', 'url']) ??
        DEFAULT_CARD_IMAGE,
      value: this.readString(card, ['name', 'title', 'value']) ?? code,
      suit: this.readString(card, ['suit', 'collection']) ?? 'DIXIT',
    };
  }

  private readCardCode(
    source: CardRecordApi,
    keys: readonly (keyof CardRecordApi)[]
  ): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }

    return null;
  }

  private readString(source: CardRecordApi, keys: readonly (keyof CardRecordApi)[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para consultar tus cartas');
    }

    return token;
  }
}
