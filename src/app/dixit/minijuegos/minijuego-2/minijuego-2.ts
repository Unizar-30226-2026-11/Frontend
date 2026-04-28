import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject, input, output } from '@angular/core';

interface MemoryCard {
  id: number;
  pairKey: string;
  image: string;
  label: string;
  state: 'hidden' | 'revealed' | 'matched';
}

interface MemoryPairTemplate {
  code: string;
  label: string;
  color: string;
}

const MEMORY_PAIR_LIBRARY: readonly MemoryPairTemplate[] = [
  { code: 'memory-1', label: 'Aurora', color: '#6ec5ff' },
  { code: 'memory-2', label: 'Farol', color: '#ffb347' },
  { code: 'memory-3', label: 'Mascara', color: '#ff7aa2' },
  { code: 'memory-4', label: 'Llave', color: '#d8c26a' },
  { code: 'memory-5', label: 'Reloj', color: '#8eb8ff' },
  { code: 'memory-6', label: 'Cometa', color: '#ff8f70' },
  { code: 'memory-7', label: 'Bruma', color: '#9fd3c7' },
  { code: 'memory-8', label: 'Corona', color: '#f5d76e' },
  { code: 'memory-9', label: 'Portal', color: '#9b87f5' },
  { code: 'memory-10', label: 'Nube', color: '#9ad0f5' },
  { code: 'memory-11', label: 'Bosque', color: '#74c69d' },
  { code: 'memory-12', label: 'Luna', color: '#c3bef0' },
] as const;

@Component({
  selector: 'app-dixit-minijuego-2',
  standalone: true,
  template: `
    <div class="memory-backdrop" (click)="closable() ? close.emit() : null">
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
            <p>Tienes {{ initialTimeLeft }} segundos para descubrir todas las parejas.</p>
          </div>

          @if (closable()) {
            <button type="button" class="close-button" aria-label="Cerrar minijuego" (click)="close.emit()">
              Cerrar
            </button>
          }
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

        <footer class="memory-footer">
          @if (isGameWon) {
            <p>Has encontrado todas las parejas antes de que se acabe el tiempo.</p>
            @if (allowRestart()) {
              <button type="button" class="restart-button" (click)="restartGame()">Jugar otra vez</button>
            }
          } @else if (isGameOver) {
            <p>Tiempo terminado. Has encontrado {{ matchedPairs }} de {{ totalPairs }} parejas.</p>
            @if (allowRestart()) {
              <button type="button" class="restart-button" (click)="restartGame()">Reintentar</button>
            }
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
  readonly durationMs = input(20_000);
  readonly allowRestart = input(true);
  readonly closable = input(true);
  readonly seedKey = input('');
  readonly close = output<void>();
  readonly finished = output<{ score: number }>();
  private readonly cdr = inject(ChangeDetectorRef);
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private mismatchTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hasEmittedResult = false;

  cards: MemoryCard[] = [];
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

  get initialTimeLeft(): number {
    return this.resolveInitialTimeLeft();
  }

  ngOnInit(): void {
    this.startGame();
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
        this.emitResultOnce();
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
    this.startGame();
  }

  private startGame(): void {
    this.clearTimers();
    this.timeLeft = this.resolveInitialTimeLeft();
    this.matchedPairs = 0;
    this.attempts = 0;
    this.isResolvingPair = false;
    this.isGameOver = false;
    this.isGameWon = false;
    this.hasEmittedResult = false;
    this.revealedCardIds = [];
    this.cards = this.buildShuffledCards();

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
    this.emitResultOnce();
  }

  private buildShuffledCards(): MemoryCard[] {
    const deck = MEMORY_PAIR_LIBRARY.flatMap((card, index) => [
      {
        id: index * 2,
        pairKey: card.code,
        image: this.buildCardImage(card),
        label: card.label,
        state: 'hidden' as const,
      },
      {
        id: index * 2 + 1,
        pairKey: card.code,
        image: this.buildCardImage(card),
        label: card.label,
        state: 'hidden' as const,
      },
    ]);

    const shuffledDeck = [...deck];
    const nextRandom = this.createSeededRandom(this.seedKey() || 'memory-default');
    for (let index = shuffledDeck.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(nextRandom() * (index + 1));
      [shuffledDeck[index], shuffledDeck[randomIndex]] = [shuffledDeck[randomIndex], shuffledDeck[index]];
    }

    return shuffledDeck;
  }

  private buildCardImage(card: MemoryPairTemplate): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 420">
        <defs>
          <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="${card.color}" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#1f2430" stop-opacity="1" />
          </linearGradient>
        </defs>
        <rect width="320" height="420" rx="28" fill="url(#bg)" />
        <circle cx="160" cy="150" r="72" fill="rgba(255,255,255,0.18)" />
        <circle cx="160" cy="150" r="46" fill="rgba(255,255,255,0.28)" />
        <text x="160" y="285" text-anchor="middle" fill="#ffffff" font-size="28" font-family="Arial, sans-serif">
          ${card.label}
        </text>
      </svg>
    `.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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

  private resolveInitialTimeLeft(): number {
    const durationMs = this.durationMs();
    if (!Number.isFinite(durationMs)) {
      return 20;
    }

    return Math.max(5, Math.ceil(durationMs / 1000));
  }

  private calculateResultScore(): number {
    const winBonus = this.isGameWon ? this.timeLeft : 0;
    return Math.max(0, this.matchedPairs + winBonus);
  }

  private createSeededRandom(seedSource: string): () => number {
    let seed = 2166136261;
    for (let index = 0; index < seedSource.length; index += 1) {
      seed ^= seedSource.charCodeAt(index);
      seed = Math.imul(seed, 16777619);
    }

    return () => {
      seed += 0x6d2b79f5;
      let nextValue = seed;
      nextValue = Math.imul(nextValue ^ (nextValue >>> 15), nextValue | 1);
      nextValue ^= nextValue + Math.imul(nextValue ^ (nextValue >>> 7), nextValue | 61);
      return ((nextValue ^ (nextValue >>> 14)) >>> 0) / 4294967296;
    };
  }

  private emitResultOnce(): void {
    if (this.hasEmittedResult) {
      return;
    }

    this.hasEmittedResult = true;
    this.finished.emit({ score: this.calculateResultScore() });
  }
}
