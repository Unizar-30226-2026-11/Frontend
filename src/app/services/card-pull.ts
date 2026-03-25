import { Injectable } from '@angular/core';

export interface DeckCard {
  code: string;
  image: string;
  value: string;
  suit: string;
}

const DEMO_DIXIT_CARDS: DeckCard[] = [
  { code: 'AS', image: 'https://deckofcardsapi.com/static/img/AS.png', value: 'ACE', suit: 'SPADES' },
  { code: 'KH', image: 'https://deckofcardsapi.com/static/img/KH.png', value: 'KING', suit: 'HEARTS' },
  { code: 'QD', image: 'https://deckofcardsapi.com/static/img/QD.png', value: 'QUEEN', suit: 'DIAMONDS' },
  { code: 'JC', image: 'https://deckofcardsapi.com/static/img/JC.png', value: 'JACK', suit: 'CLUBS' },
  { code: '0S', image: 'https://deckofcardsapi.com/static/img/0S.png', value: '10', suit: 'SPADES' },
  { code: '7H', image: 'https://deckofcardsapi.com/static/img/7H.png', value: '7', suit: 'HEARTS' },
];

@Injectable({
  providedIn: 'root',
})
export class CardPull {
  async getCards(count = DEMO_DIXIT_CARDS.length): Promise<DeckCard[]> {
    const resolvedCount = Math.max(0, Math.min(count, DEMO_DIXIT_CARDS.length));
    const cards = DEMO_DIXIT_CARDS.slice(0, resolvedCount);

    console.log('[CardPull] Cartas demo para Dixit:', cards.length);
    return Promise.resolve(cards);
  }
}
