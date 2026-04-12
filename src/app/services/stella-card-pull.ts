import { Injectable, inject } from '@angular/core';
import { CardPull, DeckCard } from './card-pull';

@Injectable({
  providedIn: 'root',
})
export class StellaCardPull {
  private readonly cardPull = inject(CardPull);
  private cachedCards: DeckCard[] | null = null;

  getCardsSync(count = 30): DeckCard[] {
    // Stella dejó de tener una fuente síncrona real cuando CardPull pasó a leer
    // del backend. Si alguien necesita acceso síncrono, solo puede hacerse
    // sobre una caché ya cargada previamente.
    const resolvedCount = Math.max(0, count);
    if (this.cachedCards === null) {
      throw new Error('Las cartas Stella aún no se han cargado. Usa getCards() antes de getCardsSync().');
    }

    return this.cachedCards.slice(0, resolvedCount);
  }

  async getCards(count = 30): Promise<DeckCard[]> {
    const resolvedCount = Math.max(0, count);
    const cards = await this.cardPull.getCards(resolvedCount);
    this.cachedCards = cards;
    return cards;
  }
}
