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
  template: `
    <section class="store-view">
      <h1>Tienda</h1>

      @if (!auth.isLoggedIn()) {
        <p class="store-info">Inicia sesion para ver tu perfil de jugador.</p>
      } @else if (playerStore.loading()) {
        <p class="store-info">Cargando informacion del jugador...</p>
      } @else if (playerStore.error()) {
        <p class="store-error">{{ playerStore.error() }}</p>
        <button type="button" (click)="reloadPlayer()">Reintentar</button>
      } @else if (playerStore.player(); as player) {
        <article class="player-panel">
          <h2>{{ player.username }}</h2>
          <p>ID: {{ player.id }}</p>
          <div class="balance-chip" aria-label="Balance actual">
            <span class="coin-icon" aria-hidden="true"></span>
            <span>{{ player.balance }}</span>
          </div>
          <p>Nivel: {{ player.experienceLevel }}</p>
          <p>Estado: {{ player.state }}</p>
          <button type="button" (click)="reloadPlayer()">Actualizar datos</button>
        </article>
      }

      @if (auth.isLoggedIn()) {
        @if (purchaseMessage(); as purchaseMessageText) {
          <p class="store-success" aria-live="polite">{{ purchaseMessageText }}</p>
        }

        @if (purchaseError(); as purchaseErrorMessage) {
          <p class="store-error">{{ purchaseErrorMessage }}</p>
        }

        @if (catalogLoading()) {
          <p class="store-info">Cargando articulos de la tienda...</p>
        } @else if (catalogError()) {
          <p class="store-error">{{ catalogError() }}</p>
          <button type="button" (click)="reloadCatalog()">Reintentar tienda</button>
        } @else {
          <section class="decks-grid">
            @for (deck of decks(); track deck.id) {
              <app-decks-card
                [deckImageSrc]="deck.image"
                [deckPrice]="deck.price"
                [deckName]="deck.name"
                [deckType]="deck.type"
                [deckOwned]="deck.owned"
                [canBuy]="canBuy(deck)"
                [buying]="purchasingDeckId() === deck.id"
                (buy)="buyDeck(deck.id)"
              />
            }
          </section>
        }
      }
    </section>
  `,
  styles: `
    .store-view {
      padding: 24px;
      color: #0f1116;
    }

    .store-view h1 {
      margin-top: 0;
      margin-bottom: 16px;
    }

    .store-info {
      color: black;
    }

    .store-error {
      color: #7d1111;
      margin-bottom: 12px;
    }

    .store-success {
      color: #0f5c2c;
      margin-bottom: 12px;
      font-weight: 600;
    }

    .player-panel {
      max-width: 380px;
      border: 1px solid rgba(230, 231, 235, 0.2);
      border-radius: 12px;
      padding: 16px;
      background: rgba(19, 22, 31, 0.65);
      color: #f4f6fb;
    }

    .player-panel h2 {
      margin-top: 0;
      margin-bottom: 12px;
    }

    .balance-chip {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin: 4px 0 14px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(240, 196, 78, 0.18);
      border: 1px solid rgba(240, 196, 78, 0.36);
      font-size: 1.1rem;
      font-weight: 700;
    }

    .coin-icon {
      position: relative;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      flex: 0 0 auto;
      background: radial-gradient(circle at 32% 32%, #fff1a6 0%, #f4c95d 42%, #c98b19 100%);
      box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.45), 0 2px 6px rgba(0, 0, 0, 0.24);
    }

    .coin-icon::after {
      content: '';
      position: absolute;
      inset: 4px;
      border-radius: 50%;
      border: 1px solid rgba(132, 83, 9, 0.4);
    }

    .store-view > button,
    .player-panel button {
      margin-top: 12px;
      border: none;
      border-radius: 8px;
      padding: 10px 14px;
      font-weight: 600;
      cursor: pointer;
    }

    .decks-grid {
      margin-top: 24px;
      padding-left: 30px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(268px, 268px));
      gap: 48px;
      justify-content: start;
      align-items: start;
    }

    @media (max-width: 700px) {
      .store-view {
        padding: 16px;
      }

      .decks-grid {
        gap: 24px;
        grid-template-columns: 1fr;
        justify-items: center;
        padding-left: 0;
      }
    }
  `,
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
