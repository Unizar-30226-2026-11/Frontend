import { ChangeDetectorRef, inject } from '@angular/core';

import {
  CardCollection,
  CollectionCard,
  CollectionsPull,
} from '../services/collections-pull';
import { BoardsPull, UserBoardSummary } from '../services/boards-pull';
import { CardPull } from '../services/card-pull';

const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';
const ACTIVE_BOARD_STORAGE_KEY = 'ator:selected-board';

export interface MenuCollectionCard {
  id: string;
  title: string;
  imageUrl: string;
  locked: boolean;
}

export interface MenuCardCollection {
  id: string;
  name: string;
  total: number;
  collected: number;
  expanded: boolean;
  cardsLoading: boolean;
  cardsLoaded: boolean;
  cardsError: string;
  cards: MenuCollectionCard[];
}

export abstract class MenuShowcaseState {
  protected readonly collectionsPull = inject(CollectionsPull);
  protected readonly cardPull = inject(CardPull);
  protected readonly boardsPull = inject(BoardsPull);
  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly ownedCardIds = new Set<string>();
  private readonly collectionCardsCache = new Map<string, CollectionCard[]>();

  totalCards = 0;
  collectedCards = 0;
  cardsLoading = true;
  cardsError = '';
  collections: MenuCardCollection[] = [];
  boardsLoading = true;
  boardsError = '';
  boardActionMessage = '';
  boardActionError = '';
  activatingBoard = false;
  boards: UserBoardSummary[] = [];
  selectedBoardId = '';

  get selectedBoard(): UserBoardSummary | null {
    return this.boards.find((board) => board.id === this.selectedBoardId) ?? null;
  }

  protected async loadShowcaseData(): Promise<void> {
    await Promise.all([this.loadCollections(), this.loadBoards()]);
  }

  protected async loadCollections(): Promise<void> {
    this.cardsLoading = true;
    this.cardsError = '';

    try {
      const collections = await this.collectionsPull.getCollections();
      const [userCards, collectionCardsResults] = await Promise.all([
        this.cardPull.getCards(),
        Promise.allSettled(
          collections.map(async (collection) => ({
            collectionId: collection.id,
            cards: await this.collectionsPull.getCollectionCards(collection.id),
          }))
        ),
      ]);

      this.ownedCardIds.clear();
      this.collectionCardsCache.clear();
      userCards.forEach((card) => {
        const normalizedCode = card.code.trim();
        if (normalizedCode) {
          this.ownedCardIds.add(normalizedCode);
        }
      });

      collectionCardsResults.forEach((result) => {
        if (result.status !== 'fulfilled') {
          return;
        }

        this.collectionCardsCache.set(result.value.collectionId, result.value.cards);
      });

      this.collections = this.toMenuCollections(collections);
      this.collectedCards = this.ownedCardIds.size;
      this.totalCards = this.collections.reduce(
        (total, collection) => total + collection.total,
        0
      );
    } catch (error) {
      this.cardsError =
        error instanceof Error ? error.message : 'No se pudieron cargar las colecciones';
      this.collections = [];
      this.collectedCards = 0;
      this.totalCards = 0;
    } finally {
      this.cardsLoading = false;
      this.cdr.detectChanges();
    }
  }

  async toggleCollection(collectionId: string): Promise<void> {
    const collection = this.collections.find((item) => item.id === collectionId);
    if (!collection) {
      return;
    }

    if (collection.expanded) {
      collection.expanded = false;
      this.cdr.detectChanges();
      return;
    }

    collection.expanded = true;

    if (collection.cardsLoaded || collection.cardsLoading) {
      this.cdr.detectChanges();
      return;
    }

    const cachedCards = this.collectionCardsCache.get(collection.id);
    if (cachedCards) {
      this.applyCollectionCards(collection, cachedCards);
      this.cdr.detectChanges();
      return;
    }

    collection.cardsLoading = true;
    collection.cardsError = '';
    this.cdr.detectChanges();

    try {
      const cards = await this.collectionsPull.getCollectionCards(collection.id);
      this.collectionCardsCache.set(collection.id, cards);
      this.applyCollectionCards(collection, cards);
    } catch (error) {
      collection.cardsError =
        error instanceof Error ? error.message : 'No se pudieron cargar las cartas';
    } finally {
      collection.cardsLoading = false;
      this.cdr.detectChanges();
    }
  }

  async loadBoards(options: { forceRefresh?: boolean } = {}): Promise<void> {
    this.boardsLoading = true;
    this.boardsError = '';

    try {
      const boards = await this.boardsPull.getUserBoards(options);
      this.boards = boards;

      const preferredBoardId =
        this.selectedBoardId || localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY) || boards[0]?.id || '';
      const hasPreferredBoard = boards.some((board) => board.id === preferredBoardId);
      this.selectedBoardId = hasPreferredBoard ? preferredBoardId : boards[0]?.id ?? '';
    } catch (error) {
      this.boardsError =
        error instanceof Error ? error.message : 'No se pudieron cargar los tableros';
      this.boards = [];
      this.selectedBoardId = '';
    } finally {
      this.boardsLoading = false;
      this.cdr.detectChanges();
    }
  }

  onBoardSelected(boardId: string): void {
    this.selectedBoardId = boardId;
    this.boardActionMessage = '';
    this.boardActionError = '';
    this.cdr.detectChanges();
  }

  async activateSelectedBoard(): Promise<void> {
    if (!this.selectedBoardId || this.activatingBoard) {
      return;
    }

    this.activatingBoard = true;
    this.boardActionMessage = '';
    this.boardActionError = '';

    try {
      this.boardActionMessage = await this.boardsPull.activateBoard(this.selectedBoardId);
      localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, this.selectedBoardId);
    } catch (error) {
      this.boardActionError =
        error instanceof Error ? error.message : 'No se pudo activar el tablero';
    } finally {
      this.activatingBoard = false;
      this.cdr.detectChanges();
    }
  }

  private toMenuCollections(collections: CardCollection[]): MenuCardCollection[] {
    return collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      total: collection.totalCards,
      collected: this.resolveOwnedCardsForCollection(collection.id),
      expanded: false,
      cardsLoading: false,
      cardsLoaded: false,
      cardsError: '',
      cards: [],
    }));
  }

  private applyCollectionCards(collection: MenuCardCollection, cards: CollectionCard[]): void {
    collection.cards = cards.map((card) => ({
      id: card.idCard,
      title: card.title,
      imageUrl: card.imageUrl || DEFAULT_CARD_IMAGE,
      locked: !this.ownedCardIds.has(card.idCard),
    }));
    collection.collected = collection.cards.filter((card) => !card.locked).length;
    collection.cardsLoaded = true;
    collection.cardsError = '';
    collection.cardsLoading = false;
  }

  private resolveOwnedCardsForCollection(collectionId: string): number {
    const cachedCards = this.collectionCardsCache.get(collectionId);
    if (cachedCards) {
      return cachedCards.filter((card) => this.ownedCardIds.has(card.idCard)).length;
    }

    return this.estimateOwnedCardsForCollection(collectionId);
  }

  private estimateOwnedCardsForCollection(collectionId: string): number {
    let ownedCount = 0;

    for (const cardId of this.ownedCardIds) {
      if (this.resolveCollectionIdFromCardId(cardId) === collectionId) {
        ownedCount += 1;
      }
    }

    return ownedCount;
  }

  private resolveCollectionIdFromCardId(cardId: string): string | null {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return null;
    }

    const collectionMatch = normalizedCardId.match(/^(.*)_card_/i);
    return collectionMatch?.[1]?.trim() || null;
  }
}
