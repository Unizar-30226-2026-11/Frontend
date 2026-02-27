import { Injectable } from '@angular/core';

export interface DeckCard {
  code: string;
  image: string;
  value: string;
  suit: string;
  [key: string]: unknown;
}

interface DeckCardApi {
  code: string;
  image?: string;
  value: string;
  suit: string;
  images?: {
    png?: string;
    svg?: string;
  };
  [key: string]: unknown;
}

interface NewDeckResponse {
  success: boolean;
  deck_id: string;
}

interface DrawCardsResponse {
  success: boolean;
  cards: DeckCardApi[];
}

@Injectable({
  providedIn: 'root',
})
export class CardPull {
  private readonly newDeckEndpoint = '/api/deck/new/shuffle/?deck_count=1';
  private readonly requestTimeoutMs = 10000;

  async getCards(count = 6): Promise<DeckCard[]> {
    console.log('[CardPull] Creando mazo...');
    const deckResponse = await this.fetchWithTimeout(this.newDeckEndpoint);
    if (!deckResponse.ok) {
      throw new Error(`No se pudo crear el mazo (${deckResponse.status})`);
    }

    const deckBody: unknown = await deckResponse.json();
    if (!this.isNewDeckResponse(deckBody)) {
      throw new Error('Formato de respuesta invalido al crear el mazo');
    }

    console.log('[CardPull] Mazo creado:', deckBody.deck_id);
    console.log('[CardPull] Robando cartas...');
    const drawResponse = await this.fetchWithTimeout(`/api/deck/${deckBody.deck_id}/draw/?count=${count}`);
    if (!drawResponse.ok) {
      throw new Error(`No se pudieron obtener las cartas (${drawResponse.status})`);
    }

    const body: unknown = await drawResponse.json();
    if (!this.isDrawCardsResponse(body)) {
      throw new Error('Formato de respuesta invalido para las cartas');
    }

    const cards = body.cards.map((card) => this.normalizeDeckCard(card));
    if (cards.length === 0) {
      throw new Error('La API devolvio un mazo vacio');
    }

    console.log('[CardPull] Cartas obtenidas:', cards.length);
    return cards;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await fetch(url, { signal: controller.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Timeout al pedir ${url} (${this.requestTimeoutMs / 1000}s)`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isNewDeckResponse(value: unknown): value is NewDeckResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<NewDeckResponse>;
    return candidate.success === true && typeof candidate.deck_id === 'string';
  }

  private isDrawCardsResponse(value: unknown): value is DrawCardsResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<DrawCardsResponse>;
    if (candidate.success !== true || !Array.isArray(candidate.cards)) {
      return false;
    }

    return candidate.cards.every((item) => this.isDeckCard(item));
  }

  private isDeckCard(value: unknown): value is DeckCardApi {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<DeckCardApi>;
    const hasDirectImage = typeof candidate.image === 'string';
    const hasNestedImage =
      typeof candidate.images === 'object' &&
      candidate.images !== null &&
      typeof (candidate.images as { png?: unknown }).png === 'string';

    return (
      typeof candidate.code === 'string' &&
      typeof candidate.value === 'string' &&
      typeof candidate.suit === 'string' &&
      (hasDirectImage || hasNestedImage)
    );
  }

  private normalizeDeckCard(card: DeckCardApi): DeckCard {
    const image =
      typeof card.image === 'string'
        ? card.image
        : typeof card.images?.png === 'string'
          ? card.images.png
          : '';

    return {
      ...card,
      image,
    };
  }
}
