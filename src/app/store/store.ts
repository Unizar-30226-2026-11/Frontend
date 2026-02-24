import { Component, inject, signal } from '@angular/core';
import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';
import { DecksCard } from './component/decks-card/decks-card';
import { DecksPull } from '../services/decks-pull';

interface StoreDeck {
  id: string;
  image: string;
  price: number;
  owned: boolean;
}

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [DecksCard],
  template: `
    <section class="store-view">
      <h1>Tienda</h1>

      @if (!auth.isLoggedIn()) {
        <p class="store-info">Inicia sesión para ver tu perfil de jugador.</p>
      } @else if (playerStore.loading()) {
        <p class="store-info">Cargando información del jugador...</p>
      } @else if (playerStore.error()) {
        <p class="store-error">{{ playerStore.error() }}</p>
        <button type="button" (click)="reloadPlayer()">Reintentar</button>
      } @else if (playerStore.player(); as player) {
        <article class="player-panel">
          <h2>{{ player.username }}</h2>
          <p>ID: {{ player.id }}</p>
          <p>Monedas: {{ player.coins }}</p>
          <p>Nivel: {{ player.level }}</p>
          <button type="button" (click)="reloadPlayer()">Actualizar datos</button>
        </article>
      }

      @if (purchaseError(); as purchaseErrorMessage) {
        <p class="store-error">{{ purchaseErrorMessage }}</p>
      }

      <section class="decks-grid">
        @for (deck of decks(); track deck.id) {
          <app-decks-card
            [deckImageSrc]="deck.image"
            [deckPrice]="deck.price"
            [deckOwned]="deck.owned"
            [canBuy]="canBuy(deck)"
            [buying]="purchasingDeckId() === deck.id"
            (buy)="buyDeck(deck.id)"
          />
        }
      </section>
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
      color: #ff9b9b;
      margin-bottom: 12px;
    }

    .player-panel {
      max-width: 380px;
      border: 1px solid rgba(230, 231, 235, 0.2);
      border-radius: 12px;
      padding: 16px;
      background: rgba(19, 22, 31, 0.65);
    }

    .player-panel h2 {
      margin-top: 0;
      margin-bottom: 12px;
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
      gap: 150px;
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
      }
    }
  `,
})
export class Store {
  auth = inject(Auth);
  playerStore = inject(PlayerStore);
  private readonly decksPull = inject(DecksPull);

  purchaseError = signal<string | null>(null);
  purchasingDeckId = signal<string | null>(null);
  decks = signal<StoreDeck[]>([
    // Imágenes de test random a la espera de tener una API para integrar / probar.
    {
      id: 'mystic-forest',
      image:
        'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=800&q=80',
      price: 5,
      owned: true,
    },
    {
      id: 'retro-space',
      image:
        'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=800&q=80',
      price: 6,
      owned: false,
    },
    {
      id: 'clockwork',
      image:
        'https://images.unsplash.com/photo-1501139083538-0139583c060f?auto=format&fit=crop&w=800&q=80',
      price: 9,
      owned: false,
    },
    {
      id: 'mystic-forest',
      image:
        'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=800&q=80',
      price: 5,
      owned: true,
    },
    {
      id: 'retro-space',
      image:
        'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=800&q=80',
      price: 6,
      owned: false,
    },
    {
      id: 'clockwork',
      image:
        'https://images.unsplash.com/photo-1501139083538-0139583c060f?auto=format&fit=crop&w=800&q=80',
      price: 9,
      owned: false,
    },
    {
      id: 'mystic-forest',
      image:
        'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=800&q=80',
      price: 5,
      owned: true,
    },
    {
      id: 'retro-space',
      image:
        'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=800&q=80',
      price: 6,
      owned: false,
    },
    {
      id: 'clockwork',
      image:
        'https://images.unsplash.com/photo-1501139083538-0139583c060f?auto=format&fit=crop&w=800&q=80',
      price: 9,
      owned: false,
    },
    {
      id: 'mystic-forest',
      image:
        'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=800&q=80',
      price: 5,
      owned: true,
    },
    {
      id: 'retro-space',
      image:
        'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=800&q=80',
      price: 6,
      owned: false,
    },
    {
      id: 'clockwork',
      image:
        'https://images.unsplash.com/photo-1501139083538-0139583c060f?auto=format&fit=crop&w=800&q=80',
      price: 9,
      owned: false,
    },
  ]);

  constructor() {
    this.ensurePlayerLoaded();
  }

  private ensurePlayerLoaded(): void {
    if (!this.auth.isLoggedIn() || this.playerStore.loading() || this.playerStore.player()) {
      return;
    }
    void this.playerStore.loadPlayer(this.auth.username);
  }

  reloadPlayer(): void {
    if (!this.auth.isLoggedIn() || !this.auth.username) {
      return;
    }
    this.purchaseError.set(null);
    void this.playerStore.loadPlayer(this.auth.username, { forceRefresh: true });
  }

  canBuy(deck: StoreDeck): boolean {
    if (deck.owned) {
      return true;
    }
    return this.playerStore.canAfford(deck.price);
  }

  async buyDeck(deckId: string): Promise<void> {
    if (!this.auth.isLoggedIn() || !this.auth.username) {
      this.purchaseError.set('Debes iniciar sesion para comprar mazos');
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
      this.purchaseError.set('No tienes monedas suficientes para este mazo');
      return;
    }

    this.purchaseError.set(null);
    this.purchasingDeckId.set(deck.id);

    try {
      const purchaseResult = await this.decksPull.buyDeck({
        username: this.auth.username,
        deckId: deck.id,
        price: deck.price,
      });

      this.markDeckAsOwned(deck.id);
      if (typeof purchaseResult.remainingCoins === 'number') {
        this.playerStore.updateCoins(purchaseResult.remainingCoins);
      } else {
        this.playerStore.spendCoins(deck.price);
      }
    } catch (error: unknown) {
      this.purchaseError.set(
        error instanceof Error ? error.message : 'No se pudo completar la compra del mazo'
      );
    } finally {
      this.purchasingDeckId.set(null);
    }
  }

  private markDeckAsOwned(deckId: string): void {
    this.decks.update((currentDecks) =>
      currentDecks.map((deck) => (deck.id === deckId ? { ...deck, owned: true } : deck))
    );
  }
}
