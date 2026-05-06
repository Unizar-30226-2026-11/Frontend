import { Injectable } from '@angular/core';
import { WordCard } from '../interfaces/word-card';

const DEMO_WORD_CARDS: WordCard[] = [
  { id: 1, terms: ['Aurora', 'Espejo'] },
  { id: 2, terms: ['Silencio', 'Bosque'] },
  { id: 3, terms: ['Mascara', 'Eco'] },
  { id: 4, terms: ['Vertigo', 'Constelacion'] },
  { id: 5, terms: ['Umbral', 'Marea'] },
  { id: 6, terms: ['Labios', 'Ceniza'] },
  { id: 7, terms: ['Danza', 'Neblina'] },
  { id: 8, terms: ['Relicario', 'Tormenta'] },
];

@Injectable({
  providedIn: 'root',
})
export class WordCardPull {
  getCardsSync(count = DEMO_WORD_CARDS.length): WordCard[] {
    const resolvedCount = Math.max(0, Math.min(count, DEMO_WORD_CARDS.length));
    return DEMO_WORD_CARDS.slice(0, resolvedCount);
  }

  async getCards(count = DEMO_WORD_CARDS.length): Promise<WordCard[]> {
    return Promise.resolve(this.getCardsSync(count));
  }
}
