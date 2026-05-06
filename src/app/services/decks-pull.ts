import { Injectable, inject } from '@angular/core';
import {
  BuyItemResponse,
  ShopItemsResponse,
  StoreCatalogResponse,
  StoreItem,
  StorePackCard,
  StorePackOffer,
} from '../interfaces/store-item';
import { Auth } from './auth';
import { ApiClient } from './api-client';

export interface BuyDeckResponse {
  itemId: string;
  message: string;
  remainingCoins?: number;
}

export interface OwnedDeckCard {
  id: string;
  name: string;
  quantity: number;
  rarity: string;
  image: string;
}

export interface UserDeckSummary {
  id: string;
  name: string;
  cardIds: string[];
}

interface UserCardsApiResponse {
  cards?: Array<{
    cardId?: string;
    name?: string;
    quantity?: number;
    rarity?: string;
    url_image?: string;
  }>;
}

interface UserDecksApiResponse {
  decks?: Array<{
    id?: string;
    name?: string;
    cardIds?: string[];
  }>;
}

interface UserDeckMutationResponse {
  message?: string;
  deck?: {
    id?: string;
    name?: string;
    cardIds?: string[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class DecksPull {
  private readonly apiClient = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly defaultImage = '/assets/Tablero.png';

  getStoreCatalog(options: { forceRefresh?: boolean } = {}): Promise<StoreCatalogResponse> {
    const token = this.requireToken();

    return this.apiClient
      .request<ShopItemsResponse>('/shop/items', {
        token,
        ttlMs: 60_000,
        forceRefresh: options.forceRefresh,
      })
      .then((shopResponse) => this.toStoreCatalog(shopResponse));
  }

  getPackOffer(
    packId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<StorePackOffer | null> {
    return this.getStoreCatalog(options).then((catalog) =>
      catalog.cardPackOffer?.id === packId ? catalog.cardPackOffer : null
    );
  }

  async buyItem(itemId: string): Promise<BuyDeckResponse> {
    const token = this.requireToken();
    const response = await this.apiClient.request<BuyItemResponse>('/shop/buy', {
      method: 'POST',
      token,
      body: { itemId },
      useCache: false,
    });

    this.apiClient.invalidateCache('/shop/items');
    this.apiClient.invalidateCache('/users/balance');
    this.apiClient.invalidateCache('/collections');

    return {
      itemId,
      message: response.message,
      remainingCoins: response.updatedBalance.coins,
    };
  }

  async buyDeck(itemId: string): Promise<BuyDeckResponse> {
    return this.buyItem(itemId);
  }

  async getOwnedCards(options: { forceRefresh?: boolean } = {}): Promise<OwnedDeckCard[]> {
    const token = this.requireToken();
    const response = await this.apiClient.request<UserCardsApiResponse>('/users/cards', {
      token,
      ttlMs: 20_000,
      forceRefresh: options.forceRefresh,
    });

    return (response.cards ?? [])
      .map((card) => {
        const id = typeof card.cardId === 'string' ? card.cardId.trim() : '';
        if (!id) {
          return null;
        }

        return {
          id,
          name: typeof card.name === 'string' && card.name.trim() ? card.name.trim() : id,
          quantity:
            typeof card.quantity === 'number' && Number.isFinite(card.quantity)
              ? Math.max(0, Math.floor(card.quantity))
              : 0,
          rarity: typeof card.rarity === 'string' && card.rarity.trim() ? card.rarity.trim() : 'COMMON',
          image: this.resolveImage(card.url_image),
        } satisfies OwnedDeckCard;
      })
      .filter((card): card is OwnedDeckCard => card !== null);
  }

  async getUserDecks(options: { forceRefresh?: boolean } = {}): Promise<UserDeckSummary[]> {
    const token = this.requireToken();
    const response = await this.apiClient.request<UserDecksApiResponse>('/users/decks', {
      token,
      ttlMs: 20_000,
      forceRefresh: options.forceRefresh,
    });

    return (response.decks ?? [])
      .map((deck) => this.normalizeUserDeck(deck))
      .filter((deck): deck is UserDeckSummary => deck !== null);
  }

  async createUserDeck(payload: { name: string; cardIds: string[] }): Promise<UserDeckSummary> {
    const token = this.requireToken();
    const response = await this.apiClient.request<UserDeckMutationResponse>('/users/decks', {
      method: 'POST',
      token,
      body: payload,
      useCache: false,
    });

    this.invalidateDeckCaches();
    const deck = this.normalizeUserDeck(response.deck);
    if (!deck) {
      throw new Error('La API no devolvio un mazo valido');
    }

    return deck;
  }

  async updateUserDeck(deckId: string, payload: { name: string; cardIds: string[] }): Promise<UserDeckSummary> {
    const token = this.requireToken();
    const response = await this.apiClient.request<UserDeckMutationResponse>(
      `/users/decks/${encodeURIComponent(deckId)}`,
      {
        method: 'PUT',
        token,
        body: payload,
        useCache: false,
      }
    );

    this.invalidateDeckCaches();
    const deck = this.normalizeUserDeck(response.deck);
    if (!deck) {
      throw new Error('La API no devolvio el mazo actualizado');
    }

    return deck;
  }

  async deleteUserDeck(deckId: string): Promise<void> {
    const token = this.requireToken();
    await this.apiClient.request<{ message?: string }>(`/users/decks/${encodeURIComponent(deckId)}`, {
      method: 'DELETE',
      token,
      useCache: false,
    });

    this.invalidateDeckCaches();
  }

  private toStoreCatalog(response: ShopItemsResponse): StoreCatalogResponse {
    const singleCards = response.items.singleCards ?? [];
    const packOffer = response.items.cardPackOffer;
    const collectionOffer = response.items.collectionOffer;
    const boardOffer = response.items.boardOffer;

    return {
      singleCards: singleCards.map((card) => ({
        id: card.id_card,
        type: 'singleCard',
        name: card.title,
        price: card.price,
        image: this.resolveImage(card.url_image),
        isPurchased: card.isPurchased ?? false,
        subtitle: this.formatRarity(card.rarity),
      })),
      cardPackOffer: packOffer
        ? {
            id: packOffer.id_pack,
            type: 'cardPack',
            name: packOffer.name,
            price: packOffer.price,
            image: this.resolveImage(packOffer.cards[0]?.url_image),
            isPurchased: packOffer.isPurchased ?? false,
            description: packOffer.description,
            subtitle: `${packOffer.cards.length} cartas`,
            cards: packOffer.cards.map((card) => this.toPackCard(card)),
          }
        : null,
      collectionOffer: collectionOffer
        ? {
            id: collectionOffer.id_collection,
            type: 'collection',
            name: collectionOffer.name,
            price: collectionOffer.price,
            image: this.defaultImage,
            isPurchased: collectionOffer.isPurchased ?? false,
            subtitle: 'Coleccion destacada',
          }
        : null,
      boardOffer: boardOffer
        ? {
            id: boardOffer.id_board,
            type: 'board',
            name: boardOffer.name,
            price: boardOffer.price,
            image: this.resolveImage(boardOffer.url_image),
            isPurchased: boardOffer.isPurchased ?? false,
            subtitle: 'Tablero exclusivo',
            description: boardOffer.description,
          }
        : null,
      expiresAt: response.items.expiresAt ?? null,
    };
  }

  private toPackCard(card: { id_card: string; title: string; url_image: string }): StorePackCard {
    return {
      id: card.id_card,
      title: card.title,
      image: this.resolveImage(card.url_image),
    };
  }

  private resolveImage(imageUrl?: string | null): string {
    if (typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
      return imageUrl;
    }

    return this.defaultImage;
  }

  private normalizeUserDeck(
    deck:
      | {
          id?: string;
          name?: string;
          cardIds?: string[];
        }
      | null
      | undefined
  ): UserDeckSummary | null {
    if (!deck || typeof deck.id !== 'string' || !deck.id.trim()) {
      return null;
    }

    return {
      id: deck.id.trim(),
      name: typeof deck.name === 'string' && deck.name.trim() ? deck.name.trim() : 'Mazo sin nombre',
      cardIds: Array.isArray(deck.cardIds)
        ? deck.cardIds.filter((cardId): cardId is string => typeof cardId === 'string' && cardId.trim().length > 0)
        : [],
    };
  }

  private invalidateDeckCaches(): void {
    this.apiClient.invalidateCache('/users/decks');
    this.apiClient.invalidateCache('/users/cards');
  }

  private formatRarity(rarity: string): string {
    return rarity.trim().toLowerCase();
  }

  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para consultar la tienda');
    }
    return token;
  }
}
