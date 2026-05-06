import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject, input, output } from '@angular/core';

type FallingItemType = 'apple' | 'bomb';

interface FallingItem {
  id: number;
  type: FallingItemType;
  lane: number;
  xPercent: number;
  yPercent: number;
  speed: number;
}

@Component({
  selector: 'app-dixit-minijuego-3',
  standalone: true,
  template: `
    <div class="harvest-backdrop" (click)="closable() ? close.emit() : null">
      <article
        class="harvest-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="minigame-3-title"
        (click)="$event.stopPropagation()"
      >
        <header class="harvest-header">
          <div class="harvest-copy">
            <p class="eyebrow">Minijuego 3</p>
            <h2 id="minigame-3-title">Recoge las manzanas</h2>
            <p>Tienes {{ initialTimeLeft }} segundos. Cada manzana suma 1 y las bombas restan 3.</p>
          </div>

          @if (closable()) {
            <button type="button" class="close-button" aria-label="Cerrar minijuego" (click)="close.emit()">
              Cerrar
            </button>
          }
        </header>

        <section class="harvest-stats" aria-label="Marcador del minijuego">
          <article class="stat-card">
            <span>Tiempo</span>
            <strong>{{ timeLeft }}s</strong>
          </article>

          <article class="stat-card">
            <span>Puntos</span>
            <strong>{{ score }}</strong>
          </article>

          <article class="stat-card">
            <span>Objetos</span>
            <strong>{{ collectedItems }}</strong>
          </article>
        </section>

        <section class="harvest-board-wrap">
          <div
            class="harvest-board"
            tabindex="0"
            aria-label="Zona de juego para mover la cesta"
            (mousemove)="onPointerMove($event)"
            (touchstart)="onTouchMove($event)"
            (touchmove)="onTouchMove($event)"
          >
            <div class="sky-glow" aria-hidden="true"></div>
            <div class="tree-canopy left" aria-hidden="true"></div>
            <div class="tree-canopy right" aria-hidden="true"></div>

            @for (item of fallingItems; track item.id) {
              <div
                class="falling-item"
                [class.apple]="item.type === 'apple'"
                [class.bomb]="item.type === 'bomb'"
                [style.left.%]="item.xPercent"
                [style.top.%]="item.yPercent"
                [attr.aria-label]="item.type === 'bomb' ? 'Bomba cayendo' : 'Manzana cayendo'"
              >
                @if (item.type === 'bomb') {
                  💣
                } @else {
                  🍎
                }
              </div>
            }

            <div class="basket" [style.left.%]="basketXPercent" aria-hidden="true">
              <div class="basket-score-badge">{{ lastScoreDeltaLabel }}</div>
              <div class="basket-body"></div>
            </div>
          </div>
        </section>

        <footer class="harvest-footer">
          @if (isGameOver) {
            <p>Tiempo terminado. Has conseguido {{ score }} punto{{ score === 1 ? '' : 's' }}.</p>
            @if (allowRestart()) {
              <button type="button" class="restart-button" (click)="restartGame()">Jugar otra vez</button>
            }
          } @else {
            <p>Mueve la cesta para recoger manzanas. Evita las bombas.</p>
          }
        </footer>
      </article>
    </div>
  `,
  styleUrl: './minijuego-3.css',
})
export class DixitMinijuego3 implements OnInit, OnDestroy {
  readonly durationMs = input(18_000);
  readonly allowRestart = input(true);
  readonly closable = input(true);
  readonly close = output<void>();
  readonly finished = output<{ score: number }>();

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly basketWidthPercent = 18;
  private readonly lanePositions = [10, 24, 38, 52, 66, 80] as const;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private physicsIntervalId: ReturnType<typeof setInterval> | null = null;
  private spawnIntervalId: ReturnType<typeof setInterval> | null = null;
  private scoreBadgeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private nextItemId = 0;
  private hasEmittedResult = false;

  timeLeft = 18;
  score = 0;
  collectedItems = 0;
  basketXPercent = 41;
  isGameOver = false;
  lastScoreDeltaLabel = '';
  fallingItems: FallingItem[] = [];

  get initialTimeLeft(): number {
    return this.resolveInitialTimeLeft();
  }

  ngOnInit(): void {
    this.startGame();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  onPointerMove(event: MouseEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    this.updateBasketPosition(target.getBoundingClientRect(), event.clientX);
  }

  onTouchMove(event: TouchEvent): void {
    const target = event.currentTarget;
    const touch = event.touches[0];
    if (!(target instanceof HTMLElement) || !touch) {
      return;
    }

    this.updateBasketPosition(target.getBoundingClientRect(), touch.clientX);
  }

  restartGame(): void {
    this.startGame();
  }

  private startGame(): void {
    this.clearTimers();
    this.timeLeft = this.resolveInitialTimeLeft();
    this.score = 0;
    this.collectedItems = 0;
    this.basketXPercent = 41;
    this.isGameOver = false;
    this.lastScoreDeltaLabel = '';
    this.fallingItems = [];
    this.nextItemId = 0;
    this.hasEmittedResult = false;

    this.timerIntervalId = setInterval(() => {
      if (this.timeLeft <= 1) {
        this.finishGame();
        this.cdr.detectChanges();
        return;
      }

      this.timeLeft -= 1;
      this.cdr.detectChanges();
    }, 1000);

    this.spawnFallingItem();
    this.spawnIntervalId = setInterval(() => {
      this.spawnFallingItem();
      this.cdr.detectChanges();
    }, 420);

    this.physicsIntervalId = setInterval(() => {
      this.advanceItems();
      this.cdr.detectChanges();
    }, 40);
  }

  private finishGame(): void {
    this.clearTimers();
    this.timeLeft = 0;
    this.isGameOver = true;
    this.fallingItems = [];
    this.emitResultOnce();
  }

  private spawnFallingItem(): void {
    if (this.isGameOver) {
      return;
    }

    const lane = Math.floor(Math.random() * this.lanePositions.length);
    const roll = Math.random();
    const type: FallingItemType = roll < 0.34 ? 'bomb' : 'apple';
    this.fallingItems = [
      ...this.fallingItems,
      {
        id: this.nextItemId++,
        type,
        lane,
        xPercent: this.lanePositions[lane],
        yPercent: -10,
        speed: type === 'bomb' ? 2.55 : 2.05,
      },
    ];
  }

  private advanceItems(): void {
    if (this.isGameOver || this.fallingItems.length === 0) {
      return;
    }

    const basketCenter = this.basketXPercent + this.basketWidthPercent / 2;
    const nextItems: FallingItem[] = [];

    for (const item of this.fallingItems) {
      const nextY = item.yPercent + item.speed;
      const isCatchZone = nextY >= 78 && nextY <= 92;
      const overlapsBasket = Math.abs(item.xPercent - basketCenter) <= this.basketWidthPercent / 2;

      if (isCatchZone && overlapsBasket) {
        this.resolveCaughtItem(item.type);
        continue;
      }

      if (nextY <= 108) {
        nextItems.push({ ...item, yPercent: nextY });
      }
    }

    this.fallingItems = nextItems;
  }

  private resolveCaughtItem(type: FallingItemType): void {
    this.collectedItems += 1;

    if (type === 'bomb') {
      this.score = Math.max(0, this.score - 3);
      this.showScoreBadge('-3');
      return;
    }

    this.score += 1;
    this.showScoreBadge('+1');
  }

  private showScoreBadge(label: string): void {
    this.lastScoreDeltaLabel = label;
    if (this.scoreBadgeTimeoutId !== null) {
      clearTimeout(this.scoreBadgeTimeoutId);
    }

    this.scoreBadgeTimeoutId = setTimeout(() => {
      this.lastScoreDeltaLabel = '';
      this.scoreBadgeTimeoutId = null;
      this.cdr.detectChanges();
    }, 500);
  }

  private updateBasketPosition(bounds: DOMRect, clientX: number): void {
    if (this.isGameOver || bounds.width <= 0) {
      return;
    }

    const relativeX = ((clientX - bounds.left) / bounds.width) * 100;
    const halfWidth = this.basketWidthPercent / 2;
    this.basketXPercent = Math.max(0, Math.min(100 - this.basketWidthPercent, relativeX - halfWidth));
  }

  private clearTimers(): void {
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }

    if (this.physicsIntervalId !== null) {
      clearInterval(this.physicsIntervalId);
      this.physicsIntervalId = null;
    }

    if (this.spawnIntervalId !== null) {
      clearInterval(this.spawnIntervalId);
      this.spawnIntervalId = null;
    }

    if (this.scoreBadgeTimeoutId !== null) {
      clearTimeout(this.scoreBadgeTimeoutId);
      this.scoreBadgeTimeoutId = null;
    }
  }

  private resolveInitialTimeLeft(): number {
    const durationMs = this.durationMs();
    if (!Number.isFinite(durationMs)) {
      return 18;
    }

    return Math.max(5, Math.ceil(durationMs / 1000));
  }

  private emitResultOnce(): void {
    if (this.hasEmittedResult) {
      return;
    }

    this.hasEmittedResult = true;
    this.finished.emit({ score: this.score });
  }
}
