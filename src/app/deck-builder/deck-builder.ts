import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { DecksPull, type OwnedDeckCard, type UserDeckSummary } from '../services/decks-pull';

@Component({
  selector: 'app-deck-builder',
  standalone: true,
  template: `
    <section class="builder-shell">
      <header class="builder-hero">
        <div class="builder-copy">
          <p class="eyebrow">Tus mazos</p>
          <h1>Crea un mazo de 12 cartas</h1>
          <p>
            Usa cartas que ya posees, guarda varios mazos y deja uno preparado para entrar al lobby.
          </p>
        </div>
      </header>

      <section class="builder-layout">
        <aside class="sidebar-panel">
          <div class="panel-heading">
            <h2>Mazos guardados</h2>
            <span>{{ decks().length }}</span>
          </div>

          @if (loading()) {
            <p class="panel-copy">Cargando mazos...</p>
          } @else if (errorMessage()) {
            <p class="panel-copy error">{{ errorMessage() }}</p>
          } @else if (decks().length === 0) {
            <p class="panel-copy">Todavía no tienes mazos creados.</p>
          } @else {
            <div class="saved-decks">
              @for (deck of decks(); track deck.id) {
                <button
                  type="button"
                  class="saved-deck"
                  [class.active]="selectedDeckId() === deck.id"
                  (click)="loadDeck(deck.id)"
                >
                  <strong>{{ deck.name }}</strong>
                  <span>{{ deck.cardIds.length }} / 12 cartas</span>
                </button>
              }
            </div>
          }

          <button type="button" class="ghost-button new-deck-button" (click)="resetEditor()">Nuevo mazo</button>
        </aside>

        <main class="editor-panel">
          <div class="editor-header">
            <label class="field">
              <span>Nombre del mazo</span>
              <input
                type="text"
                [value]="deckName()"
                maxlength="40"
                placeholder="Ej. Pistas imposibles"
                (input)="updateDeckName($event)"
              />
            </label>

            <div class="deck-stats">
              <article class="stat-box">
                <span>Seleccionadas</span>
                <strong>{{ selectedCards().length }} / 12</strong>
              </article>

              <article class="stat-box">
                <span>Estado</span>
                <strong>{{ canSaveDeck() ? 'Listo' : 'Incompleto' }}</strong>
              </article>
            </div>
          </div>

          <section class="selected-grid">
            @for (cardId of selectedCards(); track $index) {
              <button type="button" class="selected-card filled" (click)="removeCard(cardId)">
                <img [src]="findOwnedCard(cardId)?.image" [alt]="findOwnedCard(cardId)?.name || cardId" />
                <span>{{ findOwnedCard(cardId)?.name || cardId }}</span>
              </button>
            }

            @for (slot of emptySlots(); track slot) {
              <div class="selected-card empty">
                <span>Hueco {{ slot }}</span>
              </div>
            }
          </section>

          <div class="editor-actions">
            <button type="button" class="accent-button" [disabled]="saving() || !canSaveDeck()" (click)="saveDeck()">
              {{ saving() ? 'Guardando...' : 'Guardar' }}
            </button>

            @if (selectedDeckId()) {
              <button type="button" class="danger-button" [disabled]="saving()" (click)="deleteDeck()">
                Eliminar
              </button>
            }
          </div>

          @if (successMessage()) {
            <p class="feedback success">{{ successMessage() }}</p>
          }

          @if (errorMessage() && !loading()) {
            <p class="feedback error">{{ errorMessage() }}</p>
          }

          <section class="collection-panel">
            <div class="panel-heading">
              <h2>Colección disponible</h2>
              <span>{{ ownedCards().length }} tipos</span>
            </div>

            @if (loading()) {
              <p class="panel-copy">Cargando cartas...</p>
            } @else if (ownedCards().length === 0) {
              <p class="panel-copy">No hay cartas disponibles para crear mazos.</p>
            } @else {
              <div class="owned-grid">
                @for (card of ownedCards(); track card.id) {
                  <button
                    type="button"
                    class="owned-card"
                    [class.disabled]="!canAddCard(card.id)"
                    (click)="addCard(card.id)"
                  >
                    <img [src]="card.image" [alt]="card.name" />
                    <div class="owned-copy">
                      <strong>{{ card.name }}</strong>
                      <span>{{ card.rarity }}</span>
                    </div>
                    <span class="owned-count">{{ isSelected(card.id) ? 'Elegida' : 'Libre' }}</span>
                  </button>
                }
              </div>
            }
          </section>
        </main>
      </section>
    </section>
  `,
  styleUrl: './deck-builder.css',
})
export class DeckBuilder {
  private readonly decksPull = inject(DecksPull);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly ownedCards = signal<OwnedDeckCard[]>([]);
  readonly decks = signal<UserDeckSummary[]>([]);
  readonly selectedDeckId = signal<string | null>(null);
  readonly deckName = signal('');
  readonly selectedCards = signal<string[]>([]);

  readonly emptySlots = computed(() =>
    Array.from({ length: Math.max(12 - this.selectedCards().length, 0) }, (_, index) => this.selectedCards().length + index + 1)
  );

  readonly canSaveDeck = computed(() => this.deckName().trim().length > 0 && this.selectedCards().length === 12);

  constructor() {
    void this.loadData();
  }

  updateDeckName(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.deckName.set(target.value);
  }

  loadDeck(deckId: string): void {
    const deck = this.decks().find((entry) => entry.id === deckId);
    if (!deck) {
      return;
    }

    this.selectedDeckId.set(deck.id);
    this.deckName.set(deck.name);
    this.selectedCards.set([...deck.cardIds]);
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  resetEditor(): void {
    this.selectedDeckId.set(null);
    this.deckName.set('');
    this.selectedCards.set([]);
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  addCard(cardId: string): void {
    if (!this.canAddCard(cardId)) {
      return;
    }

    this.selectedCards.update((cards) => [...cards, cardId]);
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  removeCard(cardId: string): void {
    const index = this.selectedCards().indexOf(cardId);
    if (index < 0) {
      return;
    }

    this.selectedCards.update((cards) => cards.filter((_, cardIndex) => cardIndex !== index));
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  canAddCard(cardId: string): boolean {
    if (this.selectedCards().length >= 12) {
      return false;
    }

    return !!this.findOwnedCard(cardId) && !this.isSelected(cardId);
  }

  selectedCountFor(cardId: string): number {
    return this.selectedCards().filter((entry) => entry === cardId).length;
  }

  isSelected(cardId: string): boolean {
    return this.selectedCountFor(cardId) > 0;
  }

  findOwnedCard(cardId: string): OwnedDeckCard | undefined {
    return this.ownedCards().find((card) => card.id === cardId);
  }

  async saveDeck(): Promise<void> {
    if (!this.canSaveDeck() || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const payload = {
        name: this.deckName().trim(),
        cardIds: [...this.selectedCards()],
      };

      const deck = this.selectedDeckId()
        ? await this.decksPull.updateUserDeck(this.selectedDeckId()!, payload)
        : await this.decksPull.createUserDeck(payload);

      await this.refreshDecks();
      this.loadDeck(deck.id);
      this.successMessage.set(this.selectedDeckId() ? 'Mazo actualizado.' : 'Mazo creado.');
    } catch (error: unknown) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo guardar el mazo.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteDeck(): Promise<void> {
    const deckId = this.selectedDeckId();
    if (!deckId || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      await this.decksPull.deleteUserDeck(deckId);
      await this.refreshDecks();
      this.resetEditor();
      this.successMessage.set('Mazo eliminado.');
    } catch (error: unknown) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo eliminar el mazo.');
    } finally {
      this.saving.set(false);
    }
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const [ownedCards, decks] = await Promise.all([
        this.decksPull.getOwnedCards(),
        this.decksPull.getUserDecks(),
      ]);

      this.ownedCards.set(ownedCards);
      this.decks.set(decks);
      if (decks.length > 0) {
        this.loadDeck(decks[0].id);
      }
    } catch (error: unknown) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo cargar el editor de mazos.');
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshDecks(): Promise<void> {
    const decks = await this.decksPull.getUserDecks({ forceRefresh: true });
    this.decks.set(decks);
  }
}
