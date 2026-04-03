import { Injectable } from '@angular/core';
import { WordCard } from '../interfaces/word-card';

const DEMO_WORD_CARDS: WordCard[] = [
  { id: 'W01', terms: ['Aurora', 'Espejo'] },
  { id: 'W02', terms: ['Silencio', 'Bosque'] },
  { id: 'W03', terms: ['Mascara', 'Eco'] },
  { id: 'W04', terms: ['Vertigo', 'Constelacion'] },
  { id: 'W05', terms: ['Umbral', 'Marea'] },
  { id: 'W06', terms: ['Labios', 'Ceniza'] },
  { id: 'W07', terms: ['Danza', 'Neblina'] },
  { id: 'W08', terms: ['Relicario', 'Tormenta'] },
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
