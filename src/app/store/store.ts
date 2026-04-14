import { Component, computed, inject, signal } from '@angular/core';
import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';
import { DecksCard } from './components/decks-card/decks-card';
import { DecksPull } from '../services/decks-pull';
import { StoreItem, StorePackOffer } from '../interfaces/store-item';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [DecksCard],
  templateUrl: './store.html',
  styleUrl: './store.css',
})
export class Store {
  readonly auth = inject(Auth);
  readonly playerStore = inject(PlayerStore);

  private readonly decksPull = inject(DecksPull);

  readonly purchaseError = signal<string | null>(null);
  readonly purchaseMessage = signal<string | null>(null);
  readonly purchasingDeckId = signal<string | null>(null);
  readonly catalogLoading = signal(false);
  readonly catalogError = signal<string | null>(null);
  readonly singleCards = signal<StoreItem[]>([]);
  readonly cardPackOffer = signal<StorePackOffer | null>(null);
  readonly collectionOffer = signal<StoreItem | null>(null);
  readonly boardOffer = signal<StoreItem | null>(null);
  readonly expiresAt = signal<string | null>(null);
  readonly hasCatalogContent = computed(
    () =>
      this.singleCards().length > 0 ||
      this.cardPackOffer() !== null ||
      this.collectionOffer() !== null ||
      this.boardOffer() !== null
  );

  constructor() {
    this.ensurePlayerLoaded();
    this.ensureCatalogLoaded();
  }

  formatExpiry(expiresAt: string | null): string {
    if (!expiresAt) {
      return '';
    }

    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(expiresAt));
  }

  private ensurePlayerLoaded(): void {
    if (!this.auth.isLoggedIn() || this.playerStore.loading() || this.playerStore.player()) {
      return;
    }

    void this.playerStore.loadPlayer();
  }

  private ensureCatalogLoaded(): void {
    if (!this.auth.isLoggedIn() || this.catalogLoading() || this.hasCatalogContent()) {
      return;
    }

    void this.loadCatalog();
  }

  reloadPlayer(): void {
    if (!this.auth.isLoggedIn()) {
      return;
    }

    this.purchaseError.set(null);
    this.purchaseMessage.set(null);
    void this.playerStore.loadPlayer({ forceRefresh: true });
  }

  reloadCatalog(): void {
    if (!this.auth.isLoggedIn()) {
      return;
    }

    this.purchaseError.set(null);
    this.purchaseMessage.set(null);
    void this.loadCatalog({ forceRefresh: true });
  }

  canBuy(item: StoreItem | StorePackOffer): boolean {
    return this.playerStore.canAfford(item.price);
  }

  async buyItem(itemId: string): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.purchaseMessage.set(null);
      this.purchaseError.set('Debes iniciar sesion para comprar articulos');
      return;
    }

    if (this.purchasingDeckId()) {
      return;
    }

    const item = this.findItemById(itemId);
    if (!item) {
      return;
    }

    if (!this.playerStore.canAfford(item.price)) {
      this.purchaseMessage.set(null);
      this.purchaseError.set('No tienes monedas suficientes para este articulo');
      return;
    }

    this.purchaseError.set(null);
    this.purchaseMessage.set(null);
    this.purchasingDeckId.set(item.id);

    try {
      const purchaseResult = await this.decksPull.buyItem(item.id);
      this.purchaseMessage.set(purchaseResult.message);

      if (typeof purchaseResult.remainingCoins === 'number') {
        this.playerStore.updateBalance(purchaseResult.remainingCoins);
      } else {
        this.playerStore.spendCoins(item.price);
      }
    } catch (error: unknown) {
      this.purchaseMessage.set(null);
      this.purchaseError.set(
        error instanceof Error ? error.message : 'No se pudo completar la compra'
      );
    } finally {
      this.purchasingDeckId.set(null);
    }
  }

  private loadCatalog(options: { forceRefresh?: boolean } = {}): Promise<void> {
    this.catalogLoading.set(true);
    this.catalogError.set(null);

    return this.decksPull
      .getStoreCatalog(options)
      .then((catalog) => {
        this.singleCards.set(catalog.singleCards);
        this.cardPackOffer.set(catalog.cardPackOffer);
        this.collectionOffer.set(catalog.collectionOffer);
        this.boardOffer.set(catalog.boardOffer);
        this.expiresAt.set(catalog.expiresAt);
      })
      .catch((error: unknown) => {
        this.singleCards.set([]);
        this.cardPackOffer.set(null);
        this.collectionOffer.set(null);
        this.boardOffer.set(null);
        this.expiresAt.set(null);
        this.catalogError.set(error instanceof Error ? error.message : 'No se pudo cargar la tienda');
      })
      .finally(() => {
        this.catalogLoading.set(false);
      });
  }

  private findItemById(itemId: string): StoreItem | StorePackOffer | null {
    const singleCard = this.singleCards().find((entry) => entry.id === itemId);
    if (singleCard) {
      return singleCard;
    }

    const packOffer = this.cardPackOffer();
    if (packOffer?.id === itemId) {
      return packOffer;
    }

    const collectionOffer = this.collectionOffer();
    if (collectionOffer?.id === itemId) {
      return collectionOffer;
    }

    const boardOffer = this.boardOffer();
    if (boardOffer?.id === itemId) {
      return boardOffer;
    }

    return null;
  }
}
