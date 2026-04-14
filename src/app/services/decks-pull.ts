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
        subtitle: this.formatRarity(card.rarity),
      })),
      cardPackOffer: packOffer
        ? {
            id: packOffer.id_pack,
            type: 'cardPack',
            name: packOffer.name,
            price: packOffer.price,
            image: this.resolveImage(packOffer.cards[0]?.url_image),
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
