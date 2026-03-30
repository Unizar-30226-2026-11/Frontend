import { Injectable, inject } from '@angular/core';
import { UserInventoryResponse } from '../interfaces/player-info';
import {
  BuyItemResponse,
  ShopItemApi,
  ShopItemsResponse,
  StoreCatalogResponse,
  StoreItem,
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
  private readonly blockedStoreKeywords = ['comodin', 'wildcard', 'joker'];

  getStoreCatalog(options: { forceRefresh?: boolean } = {}): Promise<StoreCatalogResponse> {
    const token = this.requireToken();

    return Promise.all([
      this.apiClient.request<ShopItemsResponse>('/shop/items', {
        token,
        ttlMs: 60_000,
        forceRefresh: options.forceRefresh,
      }),
      this.apiClient.request<UserInventoryResponse>('/users/inventory', {
        token,
        ttlMs: 20_000,
        forceRefresh: options.forceRefresh,
      }).catch(() => this.buildEmptyInventory()),
    ]).then(([shopResponse, inventoryResponse]) => ({
      items: this.toStoreItems(shopResponse.items, inventoryResponse),
      inventory: inventoryResponse,
    }));
  }

  async buyDeck(itemId: string): Promise<BuyDeckResponse> {
    const token = this.requireToken();
    const response = await this.apiClient.request<BuyItemResponse>('/shop/buy', {
      method: 'POST',
      token,
      body: { itemId },
      useCache: false,
    });

    this.apiClient.invalidateCache('/users/inventory');
    this.apiClient.invalidateCache('/users/balance');
    this.apiClient.invalidateCache('/collections');

    return {
      itemId,
      message: response.message,
      remainingCoins: response.updatedBalance.coins,
    };
  }

  private toStoreItems(items: ShopItemApi[], inventory: UserInventoryResponse): StoreItem[] {
    const ownedIds = this.extractOwnedIds(inventory);

    return items
      .filter((item) => !this.isBlockedStoreItem(item))
      .map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        price: item.price,
        image: this.resolveItemImage(item),
        owned: ownedIds.has(item.id),
      }));
  }

  private extractOwnedIds(inventory: UserInventoryResponse): Set<string> {
    const rawInventory = inventory.inventory.inventory;
    const ownedIds = new Set<string>();

    for (const entry of rawInventory) {
      if (typeof entry === 'string') {
        ownedIds.add(entry);
        continue;
      }

      if (typeof entry.itemId === 'string') {
        ownedIds.add(entry.itemId);
        continue;
      }

      if (typeof entry.id === 'string') {
        ownedIds.add(entry.id);
      }
    }

    return ownedIds;
  }

  private resolveItemImage(item: ShopItemApi): string {
    if (item.type === 'cosmetic') {
      return '/assets/Tablero.png';
    }

    return this.defaultImage;
  }

  private buildEmptyInventory(): UserInventoryResponse {
    return {
      inventory: {
        inventory: [],
      },
    };
  }

  private isBlockedStoreItem(item: ShopItemApi): boolean {
    const searchableValue = this.normalizeStoreValue(`${item.id} ${item.type} ${item.name}`);
    return this.blockedStoreKeywords.some((keyword) => searchableValue.includes(keyword));
  }

  private normalizeStoreValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private requireToken(): string {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Debes iniciar sesion para consultar la tienda');
    }
    return token;
  }
}
