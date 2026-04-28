import { Injectable, inject } from '@angular/core';
import { Auth } from './auth';
import { ApiClient } from './api-client';

interface CollectionsResponseDirect {
  collections?: unknown;
}

interface CollectionCardsResponseDirect {
  collection?: unknown;
  cards?: unknown;
}

interface CollectionRecordApi {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  releaseDate?: unknown;
  release_date?: unknown;
  totalCards?: unknown;
  total_cards?: unknown;
}

interface CardRecordApi {
  id?: unknown;
  id_card?: unknown;
  cardId?: unknown;
  id_collection?: unknown;
  collection?: unknown;
  rarity?: unknown;
  name?: unknown;
  title?: unknown;
  url_image?: unknown;
}

export interface CardCollection {
  id: string;
  name: string;
  description: string;
  releaseDate: string;
  totalCards: number;
}

export interface CollectionCard {
  idCard: string;
  idCollection: string;
  rarity: string;
  title: string;
  imageUrl: string;
}

export interface CardCollectionWithCards extends CardCollection {
  cards: CollectionCard[];
}

@Injectable({
  providedIn: 'root',
})
export class CollectionsPull {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly defaultImage = '/assets/Tablero.png';

  async getCollectionsWithCards(
    options: { forceRefresh?: boolean } = {}
  ): Promise<CardCollectionWithCards[]> {
    const collections = await this.getCollections(options);

    return Promise.all(
      collections.map(async (collection) => ({
        ...collection,
        cards: await this.getCollectionCards(collection.id, options),
      }))
    );
  }

  async getCollections(
    options: { forceRefresh?: boolean } = {}
  ): Promise<CardCollection[]> {
    const token = this.requireToken();
    const response = await this.apiClient.request<CollectionsResponseDirect>('/collections', {
      token,
      ttlMs: 60_000,
      forceRefresh: options.forceRefresh,
    });

    const rawCollections = this.extractCollections(response);
    return rawCollections.map((collection) => this.normalizeCollection(collection));
  }

  async getCollectionCards(
    collectionId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<CollectionCard[]> {
    const token = this.requireToken();
    const response = await this.apiClient.request<CollectionCardsResponseDirect>(
      `/collections/${collectionId}/cards`,
      {
        token,
        ttlMs: 60_000,
        forceRefresh: options.forceRefresh,
      }
    );

    const rawCards = this.extractCards(response);
    return rawCards
      .map((card) => this.normalizeCard(card))
      .filter((card): card is CollectionCard => card !== null);
  }

  private extractCollections(response: CollectionsResponseDirect): CollectionRecordApi[] {
    const candidate = response.collections;

    if (Array.isArray(candidate)) {
      return candidate as CollectionRecordApi[];
    }

    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      Array.isArray((candidate as { collections?: unknown }).collections)
    ) {
      return (candidate as { collections: CollectionRecordApi[] }).collections;
    }

    throw new Error('Formato de respuesta invalido para las colecciones');
  }

  private extractCards(response: CollectionCardsResponseDirect): CardRecordApi[] {
    const inheritedCollection = this.asCollectionRef(response.collection);
    const candidate = response.cards;

    if (Array.isArray(candidate)) {
      return this.flattenCardCandidates(candidate, inheritedCollection);
    }

    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      Array.isArray((candidate as { cards?: unknown }).cards)
    ) {
      const nestedCandidate = candidate as { collection?: unknown; cards: unknown[] };
      return this.flattenCardCandidates(
        nestedCandidate.cards,
        this.asCollectionRef(nestedCandidate.collection) ?? inheritedCollection
      );
    }

    throw new Error('Formato de respuesta invalido para las cartas de la coleccion');
  }

  private flattenCardCandidates(
    cards: unknown[],
    inheritedCollection: { id: string } | null = null
  ): CardRecordApi[] {
    const flattenedCards: CardRecordApi[] = [];

    for (const entry of cards) {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        Array.isArray((entry as { cards?: unknown }).cards)
      ) {
        const nestedEntry = entry as { collection?: unknown; cards: unknown[] };
        flattenedCards.push(
          ...this.flattenCardCandidates(
            nestedEntry.cards,
            this.asCollectionRef(nestedEntry.collection) ?? inheritedCollection
          )
        );
        continue;
      }

      if (this.isCardRecord(entry)) {
        if (this.looksLikeCardRecord(entry)) {
          flattenedCards.push({
            ...entry,
            collection: entry.collection ?? inheritedCollection ?? undefined,
          });
        }
      }
    }

    return flattenedCards;
  }

  private normalizeCollection(collection: CollectionRecordApi): CardCollection {
    if (typeof collection.id !== 'string' || typeof collection.name !== 'string') {
      throw new Error('Formato de coleccion invalido');
    }

    const releaseDate =
      typeof collection.releaseDate === 'string'
        ? collection.releaseDate
        : typeof collection.release_date === 'string'
          ? collection.release_date
          : '';
    const totalCards =
      typeof collection.totalCards === 'number'
        ? collection.totalCards
        : typeof collection.total_cards === 'number'
          ? collection.total_cards
          : 0;

    return {
      id: collection.id,
      name: collection.name,
      description:
        typeof collection.description === 'string' ? collection.description : '',
      releaseDate,
      totalCards,
    };
  }

  private normalizeCard(card: CardRecordApi): CollectionCard | null {
    const idCard =
      typeof card.id_card === 'string'
        ? card.id_card
        : typeof card.cardId === 'string'
          ? card.cardId
          : typeof card.id === 'string'
            ? card.id
            : null;
    const title =
      typeof card.title === 'string'
        ? card.title
        : typeof card.name === 'string'
          ? card.name
          : null;
    const idCollection =
      typeof card.id_collection === 'string'
        ? card.id_collection
        : this.readCollectionId(card.collection);

    if (
      idCard === null ||
      idCollection === null ||
      typeof card.rarity !== 'string' ||
      title === null
    ) {
      return null;
    }

    return {
      idCard,
      idCollection,
      rarity: card.rarity,
      title,
      imageUrl:
        typeof card.url_image === 'string' && card.url_image.trim().length > 0
          ? card.url_image
          : this.defaultImage,
    };
  }

  private isCardRecord(value: unknown): value is CardRecordApi {
    return typeof value === 'object' && value !== null;
  }

  private looksLikeCardRecord(card: CardRecordApi): boolean {
    return (
      typeof card.id_card === 'string' ||
      typeof card.cardId === 'string' ||
      typeof card.id === 'string' ||
      typeof card.title === 'string' ||
      typeof card.name === 'string' ||
      typeof card.rarity === 'string'
    );
  }

  private readCollectionId(value: unknown): string | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const collection = value as { id?: unknown };
    return typeof collection.id === 'string' && collection.id.trim().length > 0
      ? collection.id
      : null;
  }

  private asCollectionRef(value: unknown): { id: string } | null {
    const id = this.readCollectionId(value);
    return id ? { id } : null;
  }

  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para consultar las colecciones');
    }

    return token;
  }
}
