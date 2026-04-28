export interface ShopSingleCardApi {
  id_card: string;
  title: string;
  rarity: string;
  price: number;
  url_image: string;
  isPurchased?: boolean;
}

export interface ShopPackCardApi {
  id_card: string;
  title: string;
  url_image: string;
}

export interface ShopCardPackOfferApi {
  id_pack: string;
  name: string;
  cards: ShopPackCardApi[];
  card_ids: number[];
  description: string;
  price: number;
  isPurchased?: boolean;
}

export interface ShopCollectionOfferApi {
  id_collection: string;
  name: string;
  price: number;
  isPurchased?: boolean;
}

export interface ShopBoardOfferApi {
  id_board: string;
  name: string;
  price: number;
  description: string;
  url_image?: string;
  isPurchased?: boolean;
}

export interface ShopItemsApi {
  singleCards?: ShopSingleCardApi[];
  cardPackOffer?: ShopCardPackOfferApi | null;
  collectionOffer?: ShopCollectionOfferApi | null;
  boardOffer?: ShopBoardOfferApi | null;
  expiresAt?: string | null;
}

export interface ShopItemsResponse {
  items: ShopItemsApi;
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
  type: 'singleCard' | 'cardPack' | 'collection' | 'board';
  name: string;
  price: number;
  image: string;
  isPurchased: boolean;
  subtitle?: string;
  description?: string;
}

export interface StorePackCard {
  id: string;
  title: string;
  image: string;
}

export interface StorePackOffer extends StoreItem {
  type: 'cardPack';
  cards: StorePackCard[];
}

export interface StoreCatalogResponse {
  singleCards: StoreItem[];
  cardPackOffer: StorePackOffer | null;
  collectionOffer: StoreItem | null;
  boardOffer: StoreItem | null;
  expiresAt: string | null;
}
