import { Injectable, inject } from '@angular/core';
import { CardPull, DeckCard } from './card-pull';

@Injectable({
  providedIn: 'root',
})
export class StellaCardPull {
  private readonly cardPull = inject(CardPull);

  getCardsSync(count = 30): DeckCard[] {
    const resolvedCount = Math.max(0, count);
    return this.cardPull.getCardsSync(resolvedCount);
  }

  async getCards(count = 30): Promise<DeckCard[]> {
    return Promise.resolve(this.getCardsSync(count));
  }
}
