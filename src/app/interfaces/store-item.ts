import { UserInventoryResponse } from './player-info';

export interface ShopItemApi {
  id: string;
  type: string;
  name: string;
  price: number;
}

export interface ShopItemsResponse {
  items: ShopItemApi[];
}

export interface BuyItemResponse {
  message: string;
  updatedBalance: {
    userId: string;
    coins: number;
    gems: number;
  };
}

export interface StoreItem {
  id: string;
  type: string;
  name: string;
  price: number;
  image: string;
  owned: boolean;
}

export interface StoreCatalogResponse {
  items: StoreItem[];
  inventory: UserInventoryResponse;
}
