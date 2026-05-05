import { Component, computed, inject, signal } from '@angular/core';

import { DecksPull, type OwnedDeckCard, type UserDeckSummary } from '../services/decks-pull';
import {
  CollectionsPull,
  type CardCollection,
  type CollectionCard,
} from '../services/collections-pull';

const MIN_DECK_CARDS = 16;
const MAX_DECK_CARDS = 84;
const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';
const UNCATEGORIZED_COLLECTION_ID = '__uncategorized__';

interface BuilderCollectionCard {
  id: string;
  rarity: string;
  image: string;
  owned: boolean;
}

interface BuilderCardCollection {
  id: string;
  name: string;
  total: number;
  owned: number;
  expanded: boolean;
  cardsError: string;
  cards: BuilderCollectionCard[];
}

@Component({
  selector: 'app-deck-builder',
  standalone: true,
  template: `
    <section class="builder-shell">
      <header class="builder-hero">
        <div class="builder-copy">
          <p class="eyebrow">Tus mazos</p>
          <h1>Crea un mazo de {{ minDeckCards }} a {{ maxDeckCards }} cartas</h1>
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
                  <span>{{ deck.cardIds.length }} cartas</span>
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
                <strong>{{ selectedCards().length }} / {{ maxDeckCards }}</strong>
              </article>

              <article class="stat-box">
                <span>Estado</span>
                <strong>{{ deckStatusLabel() }}</strong>
              </article>
            </div>
          </div>

          <section class="selected-grid">
            @for (cardId of selectedCards(); track $index) {
              <button type="button" class="selected-card filled" (click)="removeCard(cardId)">
                <img [src]="findOwnedCard(cardId)?.image || fallbackCardImage" alt="" />
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
              <h2>Colecciones disponibles</h2>
              <span>{{ ownedCards().length }} tipos</span>
            </div>

            @if (loading()) {
              <p class="panel-copy">Cargando cartas...</p>
            } @else if (ownedCards().length === 0) {
              <p class="panel-copy">No hay cartas disponibles para crear mazos.</p>
            } @else {
              <div class="collection-list">
                @for (collection of cardCollections(); track collection.id) {
                  <section class="deck-collection">
                    <button
                      type="button"
                      class="deck-collection-header"
                      [attr.aria-expanded]="collection.expanded"
                      [attr.aria-controls]="'deck-collection-panel-' + collection.id"
                      (click)="toggleCollection(collection.id)"
                    >
                      <h3>{{ collection.name }}</h3>
                      <span class="collection-counter">{{ collection.owned }}/{{ collection.total }}</span>
                      <span class="collection-chevron" aria-hidden="true">
                        {{ collection.expanded ? 'v' : '>' }}
                      </span>
                    </button>

                    @if (collection.expanded) {
                      <div class="collection-cards" [id]="'deck-collection-panel-' + collection.id">
                        @if (collection.cardsError) {
                          <p class="panel-copy error">{{ collection.cardsError }}</p>
                        } @else if (collection.cards.length === 0) {
                          <p class="panel-copy">No hay cartas en esta coleccion.</p>
                        } @else {
                          <div class="owned-grid">
                            @for (card of collection.cards; track card.id) {
                              <button
                                type="button"
                                class="owned-card"
                                [class.disabled]="!canAddCard(card.id)"
                                [class.locked]="!card.owned"
                                [class.selected]="isSelected(card.id)"
                                [disabled]="!canAddCard(card.id)"
                                (click)="addCard(card.id)"
                              >
                                <span class="card-image-wrap">
                                  <img [src]="card.image" alt="Carta disponible" loading="lazy" />
                                  @if (!card.owned) {
                                    <span class="locked-overlay" aria-label="Carta bloqueada">Bloqueada</span>
                                  }
                                </span>
                                <div class="owned-copy">
                                  <span>{{ card.rarity }}</span>
                                </div>
                                <span class="owned-count">{{ cardStateLabel(card.id, card.owned) }}</span>
                              </button>
                            }
                          </div>
                        }
                      </div>
                    }
                  </section>
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
  private readonly collectionsPull = inject(CollectionsPull);

  readonly minDeckCards = MIN_DECK_CARDS;
  readonly maxDeckCards = MAX_DECK_CARDS;
  readonly fallbackCardImage = DEFAULT_CARD_IMAGE;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly ownedCards = signal<OwnedDeckCard[]>([]);
  readonly cardCollections = signal<BuilderCardCollection[]>([]);
  readonly decks = signal<UserDeckSummary[]>([]);
  readonly selectedDeckId = signal<string | null>(null);
  readonly deckName = signal('');
  readonly selectedCards = signal<string[]>([]);

  readonly emptySlots = computed(() =>
    Array.from(
      { length: Math.max(MIN_DECK_CARDS - this.selectedCards().length, 0) },
      (_, index) => this.selectedCards().length + index + 1
    )
  );

  readonly canSaveDeck = computed(() => {
    const selectedCount = this.selectedCards().length;
    return (
      this.deckName().trim().length > 0 &&
      selectedCount >= MIN_DECK_CARDS &&
      selectedCount <= MAX_DECK_CARDS
    );
  });

  readonly deckStatusLabel = computed(() => {
    const selectedCount = this.selectedCards().length;
    if (selectedCount < MIN_DECK_CARDS) {
      return `Faltan ${MIN_DECK_CARDS - selectedCount}`;
    }

    if (selectedCount > MAX_DECK_CARDS) {
      return 'Exceso';
    }

    if (this.deckName().trim().length === 0) {
      return 'Sin nombre';
    }

    return 'Listo';
  });

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
    if (this.selectedCards().length >= MAX_DECK_CARDS) {
      return false;
    }

    return !!this.findOwnedCard(cardId) && !this.isSelected(cardId);
  }

  toggleCollection(collectionId: string): void {
    this.cardCollections.update((collections) =>
      collections.map((collection) =>
        collection.id === collectionId
          ? { ...collection, expanded: !collection.expanded }
          : collection
      )
    );
  }

  cardStateLabel(cardId: string, owned: boolean): string {
    if (!owned) {
      return 'Bloqueada';
    }

    if (this.isSelected(cardId)) {
      return 'Elegida';
    }

    if (this.selectedCards().length >= MAX_DECK_CARDS) {
      return 'Maximo';
    }

    return 'Libre';
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
      const wasEditingDeck = !!this.selectedDeckId();
      const payload = {
        name: this.deckName().trim(),
        cardIds: [...this.selectedCards()],
      };

      const deck = this.selectedDeckId()
        ? await this.decksPull.updateUserDeck(this.selectedDeckId()!, payload)
        : await this.decksPull.createUserDeck(payload);

      await this.refreshDecks();
      this.loadDeck(deck.id);
      this.successMessage.set(wasEditingDeck ? 'Mazo actualizado.' : 'Mazo creado.');
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
      const [ownedCards, decks, collections] = await Promise.all([
        this.decksPull.getOwnedCards(),
        this.decksPull.getUserDecks(),
        this.collectionsPull.getCollections(),
      ]);
      const collectionCardsResults = await Promise.allSettled(
        collections.map(async (collection) => ({
          collectionId: collection.id,
          cards: await this.collectionsPull.getCollectionCards(collection.id),
        }))
      );

      this.ownedCards.set(ownedCards);
      this.cardCollections.set(
        this.toBuilderCollections(collections, collectionCardsResults, ownedCards)
      );
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

  private toBuilderCollections(
    collections: CardCollection[],
    collectionCardsResults: PromiseSettledResult<{ collectionId: string; cards: CollectionCard[] }>[],
    ownedCards: OwnedDeckCard[]
  ): BuilderCardCollection[] {
    const ownedCardsById = new Map(ownedCards.map((card) => [card.id, card]));
    const categorizedOwnedCardIds = new Set<string>();
    const cardsByCollection = new Map<string, CollectionCard[]>();
    const failedCollectionIds = new Set<string>();

    collectionCardsResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        cardsByCollection.set(result.value.collectionId, result.value.cards);
        return;
      }

      const failedCollectionId = collections[index]?.id;
      if (failedCollectionId) {
        failedCollectionIds.add(failedCollectionId);
      }
    });

    const builderCollections = collections.map((collection) => {
      const cards = (cardsByCollection.get(collection.id) ?? []).map((card) => {
        const ownedCard = ownedCardsById.get(card.idCard);
        if (ownedCard) {
          categorizedOwnedCardIds.add(card.idCard);
        }

        return {
          id: card.idCard,
          rarity: ownedCard?.rarity ?? card.rarity,
          image: ownedCard?.image ?? card.imageUrl ?? DEFAULT_CARD_IMAGE,
          owned: !!ownedCard,
        } satisfies BuilderCollectionCard;
      });

      const owned = cards.filter((card) => card.owned).length;

      return {
        id: collection.id,
        name: collection.name,
        total: Math.max(collection.totalCards, cards.length),
        owned,
        expanded: false,
        cardsError: failedCollectionIds.has(collection.id)
          ? 'No se pudieron cargar las cartas de esta coleccion.'
          : '',
        cards,
      } satisfies BuilderCardCollection;
    });

    const uncategorizedCards = ownedCards.filter(
      (card) => !categorizedOwnedCardIds.has(card.id)
    );
    if (uncategorizedCards.length > 0) {
      builderCollections.push({
        id: UNCATEGORIZED_COLLECTION_ID,
        name: 'Sin coleccion',
        total: uncategorizedCards.length,
        owned: uncategorizedCards.length,
        expanded: false,
        cardsError: '',
        cards: uncategorizedCards.map((card) => ({
          id: card.id,
          rarity: card.rarity,
          image: card.image || DEFAULT_CARD_IMAGE,
          owned: true,
        })),
      });
    }

    return builderCollections;
  }
}
