import { Injectable } from '@angular/core';

export interface BuyDeckPayload {
  username: string;
  deckId: string;
  price: number;
}

export interface BuyDeckResponse {
  deckId: string;
  remainingCoins?: number;
}

@Injectable({
  providedIn: 'root',
})
export class DecksPull {
  private readonly purchaseEndpoint = '/api/store/decks/purchase';

  async buyDeck(payload: BuyDeckPayload): Promise<BuyDeckResponse> {
    const response = await fetch(this.purchaseEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const backendMessage =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof (body as { message?: unknown }).message === 'string'
          ? (body as { message: string }).message
          : null;

      throw new Error(backendMessage ?? 'No se pudo completar la compra del mazo');
    }

    const remainingCoins =
      typeof body === 'object' &&
      body !== null &&
      'remainingCoins' in body &&
      typeof (body as { remainingCoins?: unknown }).remainingCoins === 'number'
        ? (body as { remainingCoins: number }).remainingCoins
        : undefined;

    return {
      deckId: payload.deckId,
      remainingCoins,
    };
  }
}
