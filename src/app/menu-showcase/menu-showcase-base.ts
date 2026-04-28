import { ChangeDetectorRef, inject } from '@angular/core';

import {
  CardCollectionWithCards,
  CollectionsPull,
} from '../services/collections-pull';

const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';

export interface MenuCollectionCard {
  id: string;
  title: string;
  imageUrl: string;
  locked: boolean;
}

export interface MenuCardCollection {
  id: string;
  name: string;
  total: number;
  collected: number;
  cards: MenuCollectionCard[];
}

export interface CommunityCard {
  id: number;
  title: string;
  imageUrl: string;
}

export abstract class MenuShowcaseState {
  protected readonly collectionsPull = inject(CollectionsPull);
  protected readonly cdr = inject(ChangeDetectorRef);

  totalCards = 0;
  collectedCards = 0;
  currentRating = 3;
  currentCardIndex = 0;
  cardsLoading = true;
  cardsError = '';
  collections: MenuCardCollection[] = [];

  readonly communityCards: CommunityCard[] = [
    {
      id: 458,
      title: 'Donde nacen las sombras',
      imageUrl: 'https://picsum.photos/seed/atr-community-458/520/700',
    },
    {
      id: 459,
      title: 'Sueno fractal en rojo',
      imageUrl: 'https://picsum.photos/seed/atr-community-459/520/700',
    },
    {
      id: 460,
      title: 'La puerta que respira',
      imageUrl: 'https://picsum.photos/seed/atr-community-460/520/700',
    },
    {
      id: 461,
      title: 'Jardin de cristal roto',
      imageUrl: 'https://picsum.photos/seed/atr-community-461/520/700',
    },
  ];

  get currentCommunityCard(): CommunityCard {
    return this.communityCards[this.currentCardIndex];
  }

  previousCommunityCard(): void {
    this.currentCardIndex =
      (this.currentCardIndex - 1 + this.communityCards.length) % this.communityCards.length;
  }

  nextCommunityCard(): void {
    this.currentCardIndex = (this.currentCardIndex + 1) % this.communityCards.length;
  }

  setRating(rating: number): void {
    this.currentRating = rating;
  }

  protected async loadCollections(): Promise<void> {
    this.cardsLoading = true;
    this.cardsError = '';

    try {
      const collections = await this.collectionsPull.getCollectionsWithCards();
      this.collections = this.toMenuCollections(collections);
      this.collectedCards = this.collections.reduce(
        (total, collection) => total + collection.collected,
        0
      );
      this.totalCards = this.collections.reduce(
        (total, collection) => total + collection.total,
        0
      );
    } catch (error) {
      this.cardsError =
        error instanceof Error ? error.message : 'No se pudieron cargar las colecciones';
      this.collections = [];
      this.collectedCards = 0;
      this.totalCards = 0;
    } finally {
      this.cardsLoading = false;
      this.cdr.detectChanges();
    }
  }

  private toMenuCollections(collections: CardCollectionWithCards[]): MenuCardCollection[] {
    return collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      total: collection.totalCards > 0 ? collection.totalCards : collection.cards.length,
      collected: collection.cards.length,
      cards: collection.cards.map((card) => ({
        id: card.idCard,
        title: card.title,
        imageUrl: DEFAULT_CARD_IMAGE,
        locked: false,
      })),
    }));
  }
}
