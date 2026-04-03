import { Injectable } from '@angular/core';

export interface DeckCard {
  code: string;
  image: string;
  value: string;
  suit: string;
}

const DEMO_CARD_VALUES = [
  { code: 'A', value: 'ACE' },
  { code: 'K', value: 'KING' },
  { code: 'Q', value: 'QUEEN' },
  { code: 'J', value: 'JACK' },
  { code: '0', value: '10' },
  { code: '9', value: '9' },
  { code: '8', value: '8' },
  { code: '7', value: '7' },
  { code: '6', value: '6' },
] as const;

const DEMO_CARD_SUITS = [
  { code: 'S', suit: 'SPADES' },
  { code: 'H', suit: 'HEARTS' },
  { code: 'D', suit: 'DIAMONDS' },
  { code: 'C', suit: 'CLUBS' },
] as const;

const DEMO_DIXIT_CARDS: DeckCard[] = DEMO_CARD_VALUES.flatMap((cardValue) =>
  DEMO_CARD_SUITS.map((cardSuit) => ({
    code: `${cardValue.code}${cardSuit.code}`,
    image: `https://deckofcardsapi.com/static/img/${cardValue.code}${cardSuit.code}.png`,
    value: cardValue.value,
    suit: cardSuit.suit,
  }))
);

@Injectable({
  providedIn: 'root',
})
export class CardPull {
  getCardsSync(count = 6): DeckCard[] {
    const resolvedCount = Math.max(0, Math.min(count, DEMO_DIXIT_CARDS.length));
    return DEMO_DIXIT_CARDS.slice(0, resolvedCount);
  }

  async getCards(count = 6): Promise<DeckCard[]> {
    const cards = this.getCardsSync(count);

    console.log('[CardPull] Cartas demo para Dixit:', cards.length);
    return Promise.resolve(cards);
  }
}
