import { ChangeDetectorRef, inject } from '@angular/core';

import {
  CardCollection,
  CollectionCard,
  CollectionsPull,
} from '../services/collections-pull';
import { CardPull } from '../services/card-pull';

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
  expanded: boolean;
  cardsLoading: boolean;
  cardsLoaded: boolean;
  cardsError: string;
  cards: MenuCollectionCard[];
}

export interface CommunityCard {
  id: number;
  title: string;
  imageUrl: string;
}

export abstract class MenuShowcaseState {
  protected readonly collectionsPull = inject(CollectionsPull);
  protected readonly cardPull = inject(CardPull);
  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly ownedCardIds = new Set<string>();
  private readonly collectionCardsCache = new Map<string, CollectionCard[]>();

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
      const collections = await this.collectionsPull.getCollections();
      const [userCards, collectionCardsResults] = await Promise.all([
        this.cardPull.getCards(),
        Promise.allSettled(
          collections.map(async (collection) => ({
            collectionId: collection.id,
            cards: await this.collectionsPull.getCollectionCards(collection.id),
          }))
        ),
      ]);

      this.ownedCardIds.clear();
      this.collectionCardsCache.clear();
      userCards.forEach((card) => {
        const normalizedCode = card.code.trim();
        if (normalizedCode) {
          this.ownedCardIds.add(normalizedCode);
        }
      });

      collectionCardsResults.forEach((result) => {
        if (result.status !== 'fulfilled') {
          return;
        }

        this.collectionCardsCache.set(result.value.collectionId, result.value.cards);
      });

      this.collections = this.toMenuCollections(collections);
      this.collectedCards = this.ownedCardIds.size;
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

  async toggleCollection(collectionId: string): Promise<void> {
    const collection = this.collections.find((item) => item.id === collectionId);
    if (!collection) {
      return;
    }

    if (collection.expanded) {
      collection.expanded = false;
      this.cdr.detectChanges();
      return;
    }

    collection.expanded = true;

    if (collection.cardsLoaded || collection.cardsLoading) {
      this.cdr.detectChanges();
      return;
    }

    const cachedCards = this.collectionCardsCache.get(collection.id);
    if (cachedCards) {
      this.applyCollectionCards(collection, cachedCards);
      this.cdr.detectChanges();
      return;
    }

    collection.cardsLoading = true;
    collection.cardsError = '';
    this.cdr.detectChanges();

    try {
      const cards = await this.collectionsPull.getCollectionCards(collection.id);
      this.collectionCardsCache.set(collection.id, cards);
      this.applyCollectionCards(collection, cards);
    } catch (error) {
      collection.cardsError =
        error instanceof Error ? error.message : 'No se pudieron cargar las cartas';
    } finally {
      collection.cardsLoading = false;
      this.cdr.detectChanges();
    }
  }

  private toMenuCollections(collections: CardCollection[]): MenuCardCollection[] {
    return collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      total: collection.totalCards,
      collected: this.resolveOwnedCardsForCollection(collection.id),
      expanded: false,
      cardsLoading: false,
      cardsLoaded: false,
      cardsError: '',
      cards: [],
    }));
  }

  private applyCollectionCards(collection: MenuCardCollection, cards: CollectionCard[]): void {
    collection.cards = cards.map((card) => ({
      id: card.idCard,
      title: card.title,
      imageUrl: card.imageUrl || DEFAULT_CARD_IMAGE,
      locked: !this.ownedCardIds.has(card.idCard),
    }));
    collection.collected = collection.cards.filter((card) => !card.locked).length;
    collection.cardsLoaded = true;
    collection.cardsError = '';
    collection.cardsLoading = false;
  }

  private resolveOwnedCardsForCollection(collectionId: string): number {
    const cachedCards = this.collectionCardsCache.get(collectionId);
    if (cachedCards) {
      return cachedCards.filter((card) => this.ownedCardIds.has(card.idCard)).length;
    }

    return this.estimateOwnedCardsForCollection(collectionId);
  }

  private estimateOwnedCardsForCollection(collectionId: string): number {
    let ownedCount = 0;

    for (const cardId of this.ownedCardIds) {
      if (this.resolveCollectionIdFromCardId(cardId) === collectionId) {
        ownedCount += 1;
      }
    }

    return ownedCount;
  }

  private resolveCollectionIdFromCardId(cardId: string): string | null {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return null;
    }

    const collectionMatch = normalizedCardId.match(/^(.*)_card_/i);
    return collectionMatch?.[1]?.trim() || null;
  }
}
