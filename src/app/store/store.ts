import { Component, inject, signal } from '@angular/core';
import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';
import { DecksCard } from './components/decks-card/decks-card';
import { DecksPull } from '../services/decks-pull';
import { StoreItem } from '../interfaces/store-item';

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
  readonly decks = signal<StoreItem[]>([]);

  constructor() {
    this.ensurePlayerLoaded();
    this.ensureCatalogLoaded();
  }

  formatPlayerStatus(status: string): string {
    switch (status.trim().toUpperCase()) {
      case 'AWAY':
        return 'Ausente';
      case 'BUSY':
        return 'Ocupado';
      case 'INVISIBLE':
        return 'Invisible';
      case 'ONLINE':
      default:
        return 'Online';
    }
  }

  private ensurePlayerLoaded(): void {
    if (!this.auth.isLoggedIn() || this.playerStore.loading() || this.playerStore.player()) {
      return;
    }

    void this.playerStore.loadPlayer();
  }

  private ensureCatalogLoaded(): void {
    if (!this.auth.isLoggedIn() || this.catalogLoading() || this.decks().length > 0) {
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

  canBuy(deck: StoreItem): boolean {
    if (deck.owned) {
      return true;
    }

    return this.playerStore.canAfford(deck.price);
  }

  async buyDeck(deckId: string): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.purchaseMessage.set(null);
      this.purchaseError.set('Debes iniciar sesion para comprar articulos');
      return;
    }

    if (this.purchasingDeckId()) {
      return;
    }

    const deck = this.decks().find((entry) => entry.id === deckId);
    if (!deck || deck.owned) {
      return;
    }

    if (!this.playerStore.canAfford(deck.price)) {
      this.purchaseMessage.set(null);
      this.purchaseError.set('No tienes monedas suficientes para este articulo');
      return;
    }

    this.purchaseError.set(null);
    this.purchaseMessage.set(null);
    this.purchasingDeckId.set(deck.id);

    try {
      const purchaseResult = await this.decksPull.buyDeck(deck.id);
      this.markDeckAsOwned(deck.id);
      this.purchaseMessage.set(purchaseResult.message);

      if (typeof purchaseResult.remainingCoins === 'number') {
        this.playerStore.updateBalance(purchaseResult.remainingCoins);
      } else {
        this.playerStore.spendCoins(deck.price);
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
        this.decks.set(catalog.items);
      })
      .catch((error: unknown) => {
        this.catalogError.set(error instanceof Error ? error.message : 'No se pudo cargar la tienda');
      })
      .finally(() => {
        this.catalogLoading.set(false);
      });
  }

  private markDeckAsOwned(deckId: string): void {
    this.decks.update((currentDecks) =>
      currentDecks.map((deck) => (deck.id === deckId ? { ...deck, owned: true } : deck))
    );
  }
}
