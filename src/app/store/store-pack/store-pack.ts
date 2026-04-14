import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { DecksPull } from '../../services/decks-pull';
import { PlayerStore } from '../../services/player-store';
import { StorePackOffer } from '../../interfaces/store-item';

@Component({
  selector: 'app-store-pack',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './store-pack.html',
  styleUrl: './store-pack.css',
})
export class StorePack {
  readonly auth = inject(Auth);
  readonly playerStore = inject(PlayerStore);

  private readonly route = inject(ActivatedRoute);
  private readonly decksPull = inject(DecksPull);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pack = signal<StorePackOffer | null>(null);
  readonly purchaseError = signal<string | null>(null);
  readonly purchaseMessage = signal<string | null>(null);
  readonly purchasing = signal(false);

  constructor() {
    this.ensurePlayerLoaded();
    void this.loadPack();
  }

  canBuy(price: number): boolean {
    return this.playerStore.canAfford(price);
  }

  reloadPlayer(): void {
    if (!this.auth.isLoggedIn()) {
      return;
    }

    void this.playerStore.loadPlayer({ forceRefresh: true });
  }

  reloadPack(): void {
    if (!this.auth.isLoggedIn()) {
      return;
    }

    void this.loadPack({ forceRefresh: true });
  }

  async buyPack(): Promise<void> {
    const pack = this.pack();
    if (!this.auth.isLoggedIn() || !pack || this.purchasing()) {
      return;
    }

    if (!this.playerStore.canAfford(pack.price)) {
      this.purchaseMessage.set(null);
      this.purchaseError.set('No tienes monedas suficientes para este pack');
      return;
    }

    this.purchaseError.set(null);
    this.purchaseMessage.set(null);
    this.purchasing.set(true);

    try {
      const result = await this.decksPull.buyItem(pack.id);
      this.purchaseMessage.set(result.message);

      if (typeof result.remainingCoins === 'number') {
        this.playerStore.updateBalance(result.remainingCoins);
      } else {
        this.playerStore.spendCoins(pack.price);
      }
    } catch (error: unknown) {
      this.purchaseMessage.set(null);
      this.purchaseError.set(
        error instanceof Error ? error.message : 'No se pudo completar la compra'
      );
    } finally {
      this.purchasing.set(false);
    }
  }

  private ensurePlayerLoaded(): void {
    if (!this.auth.isLoggedIn() || this.playerStore.loading() || this.playerStore.player()) {
      return;
    }

    void this.playerStore.loadPlayer();
  }

  private loadPack(options: { forceRefresh?: boolean } = {}): Promise<void> {
    const packId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!packId) {
      this.error.set('No se encontro el pack solicitado');
      this.pack.set(null);
      return Promise.resolve();
    }

    this.loading.set(true);
    this.error.set(null);

    return this.decksPull
      .getPackOffer(packId, options)
      .then((pack) => {
        if (!pack) {
          throw new Error('El pack solicitado ya no esta disponible');
        }

        this.pack.set(pack);
      })
      .catch((error: unknown) => {
        this.pack.set(null);
        this.error.set(
          error instanceof Error ? error.message : 'No se pudo cargar el detalle del pack'
        );
      })
      .finally(() => {
        this.loading.set(false);
      });
  }
}
