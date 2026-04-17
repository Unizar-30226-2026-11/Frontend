import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject, output } from '@angular/core';
import { CardPull } from '../../../services/card-pull';
import type { DeckCard } from '../../../services/card-pull';

interface MemoryCard {
  id: number;
  pairKey: string;
  image: string;
  label: string;
  state: 'hidden' | 'revealed' | 'matched';
}

@Component({
  selector: 'app-dixit-minijuego-2',
  standalone: true,
  template: `
    <div class="memory-backdrop" (click)="close.emit()">
      <article
        class="memory-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="minigame-2-title"
        (click)="$event.stopPropagation()"
      >
        <header class="memory-header">
          <div class="memory-copy">
            <p class="eyebrow">Minijuego 2</p>
            <h2 id="minigame-2-title">Buscar parejas</h2>
            <p>Tienes 15 segundos para descubrir todas las parejas con las cartas de Dixit.</p>
          </div>

          <button type="button" class="close-button" aria-label="Cerrar minijuego" (click)="close.emit()">
            Cerrar
          </button>
        </header>

        <section class="memory-stats" aria-label="Marcador del minijuego">
          <article class="stat-card">
            <span>Tiempo</span>
            <strong>{{ timeLeft }}s</strong>
          </article>

          <article class="stat-card">
            <span>Parejas</span>
            <strong>{{ matchedPairs }} / {{ totalPairs }}</strong>
          </article>

          <article class="stat-card">
            <span>Intentos</span>
            <strong>{{ attempts }}</strong>
          </article>
        </section>

        @if (loading) {
          <section class="status-panel">
            <p>Cargando cartas...</p>
          </section>
        } @else if (errorMessage) {
          <section class="status-panel error">
            <p>{{ errorMessage }}</p>
          </section>
        } @else {
          <section class="cards-grid" aria-label="Tablero de memoria">
            @for (card of cards; track card.id) {
              <button
                type="button"
                class="memory-card"
                [class.revealed]="card.state !== 'hidden'"
                [class.matched]="card.state === 'matched'"
                [disabled]="card.state === 'matched' || isResolvingPair || isGameOver"
                [attr.aria-label]="card.state === 'hidden' ? 'Carta boca abajo' : 'Carta ' + card.label"
                (click)="onCardSelected(card.id)"
              >
                <span class="card-back">?</span>
                <span class="card-front">
                  <img [src]="card.image" [alt]="card.label" draggable="false" />
                </span>
              </button>
            }
          </section>
        }

        <footer class="memory-footer">
          @if (isGameWon) {
            <p>Has encontrado todas las parejas antes de que se acabe el tiempo.</p>
            <button type="button" class="restart-button" (click)="restartGame()">Jugar otra vez</button>
          } @else if (isGameOver) {
            <p>Tiempo terminado. Has encontrado {{ matchedPairs }} de {{ totalPairs }} parejas.</p>
            <button type="button" class="restart-button" (click)="restartGame()">Reintentar</button>
          } @else {
            <p>Revela dos cartas. Si coinciden, la pareja se queda descubierta.</p>
          }
        </footer>
      </article>
    </div>
  `,
  styleUrl: './minijuego-2.css',
})
export class DixitMinijuego2 implements OnInit, OnDestroy {
  readonly close = output<void>();
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly cardPull = inject(CardPull);
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private mismatchTimeoutId: ReturnType<typeof setTimeout> | null = null;

  cards: MemoryCard[] = [];
  loading = true;
  errorMessage = '';
  timeLeft = 15;
  matchedPairs = 0;
  attempts = 0;
  isResolvingPair = false;
  isGameOver = false;
  isGameWon = false;
  private revealedCardIds: number[] = [];

  get totalPairs(): number {
    return this.cards.length / 2;
  }

  async ngOnInit(): Promise<void> {
    await this.startGame();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  onCardSelected(cardId: number): void {
    if (this.isGameOver || this.isResolvingPair) {
      return;
    }

    const card = this.cards.find((entry) => entry.id === cardId);
    if (!card || card.state !== 'hidden') {
      return;
    }

    card.state = 'revealed';
    this.revealedCardIds = [...this.revealedCardIds, card.id];

    if (this.revealedCardIds.length < 2) {
      return;
    }

    this.attempts += 1;
    const selectedCards = this.cards.filter((entry) => this.revealedCardIds.includes(entry.id));
    if (selectedCards.length !== 2) {
      this.revealedCardIds = [];
      return;
    }

    if (selectedCards[0].pairKey === selectedCards[1].pairKey) {
      for (const selectedCard of selectedCards) {
        selectedCard.state = 'matched';
      }

      this.revealedCardIds = [];
      this.matchedPairs += 1;

      if (this.matchedPairs >= this.totalPairs) {
        this.isGameWon = true;
        this.isGameOver = true;
        this.clearIntervalTimer();
      }

      return;
    }

    this.isResolvingPair = true;
    this.mismatchTimeoutId = setTimeout(() => {
      for (const selectedCard of selectedCards) {
        if (selectedCard.state === 'revealed') {
          selectedCard.state = 'hidden';
        }
      }

      this.revealedCardIds = [];
      this.isResolvingPair = false;
      this.mismatchTimeoutId = null;
      this.cdr.detectChanges();
    }, 650);
  }

  restartGame(): void {
    void this.startGame();
  }

  private async startGame(): Promise<void> {
    this.clearTimers();
    this.loading = true;
    this.errorMessage = '';
    this.timeLeft = 15;
    this.matchedPairs = 0;
    this.attempts = 0;
    this.isResolvingPair = false;
    this.isGameOver = false;
    this.isGameWon = false;
    this.revealedCardIds = [];

    try {
      const sourceCards = await this.cardPull.getCards();
      if (sourceCards.length === 0) {
        this.cards = [];
        this.errorMessage = 'No se pudieron cargar cartas para el minijuego.';
        this.isGameOver = true;
        return;
      }

      this.cards = this.buildShuffledCards(sourceCards);
    } catch (error: unknown) {
      this.cards = [];
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudieron cargar cartas para el minijuego.';
      this.isGameOver = true;
      return;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }

    this.timerIntervalId = setInterval(() => {
      if (this.timeLeft <= 1) {
        this.finishGame();
        this.cdr.detectChanges();
        return;
      }

      this.timeLeft -= 1;
      this.cdr.detectChanges();
    }, 1000);
  }

  private finishGame(): void {
    this.clearTimers();
    this.timeLeft = 0;
    this.isResolvingPair = false;
    this.revealedCardIds = [];
    this.isGameOver = true;
  }

  private buildShuffledCards(sourceCards: DeckCard[]): MemoryCard[] {
    const deck = sourceCards.flatMap((card, index) => [
      {
        id: index * 2,
        pairKey: card.code,
        image: card.image,
        label: `${card.value} de ${card.suit}`,
        state: 'hidden' as const,
      },
      {
        id: index * 2 + 1,
        pairKey: card.code,
        image: card.image,
        label: `${card.value} de ${card.suit}`,
        state: 'hidden' as const,
      },
    ]);

    const shuffledDeck = [...deck];
    for (let index = shuffledDeck.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledDeck[index], shuffledDeck[randomIndex]] = [shuffledDeck[randomIndex], shuffledDeck[index]];
    }

    return shuffledDeck;
  }

  private clearTimers(): void {
    this.clearIntervalTimer();

    if (this.mismatchTimeoutId !== null) {
      clearTimeout(this.mismatchTimeoutId);
      this.mismatchTimeoutId = null;
    }
  }

  private clearIntervalTimer(): void {
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }
}
