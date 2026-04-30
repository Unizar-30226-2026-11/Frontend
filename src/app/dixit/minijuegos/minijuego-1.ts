import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject, input, output } from '@angular/core';

interface MoleHole {
  id: number;
  label: string;
}

type MoleVariant = 'normal' | 'gold';

@Component({
  selector: 'app-dixit-minijuego-1',
  standalone: true,
  template: `
    <div class="minigame-backdrop" (click)="closable() ? close.emit() : null">
      <article
        class="minigame-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="minigame-1-title"
        (click)="$event.stopPropagation()"
      >
        <header class="minigame-header">
          <div class="minigame-copy">
            <p class="eyebrow">Minijuego 1</p>
            <h2 id="minigame-1-title">Golpea al topo</h2>
            <p>Tienes {{ initialTimeLeft }} segundos. Cada topo acertado suma 1 punto.</p>
          </div>

          @if (closable()) {
            <button type="button" class="close-button" aria-label="Cerrar minijuego" (click)="close.emit()">
              Cerrar
            </button>
          }
        </header>

        <section class="minigame-stats" aria-label="Marcador del minijuego">
          <article class="stat-card">
            <span>Tiempo</span>
            <strong>{{ timeLeft }}s</strong>
          </article>

          <article class="stat-card">
            <span>Puntos</span>
            <strong>{{ score }}</strong>
          </article>

          <article class="stat-card">
            <span>Contra</span>
            <strong>{{ opponentNickname() }}</strong>
          </article>
        </section>

        <section class="holes-grid" aria-label="Tablero de topos">
          @for (hole of holes; track hole.id) {
            <button
              type="button"
              class="hole-button"
              [class.active]="hole.id === activeMoleIndex"
              [class.gold]="hole.id === activeMoleIndex && activeMoleVariant === 'gold'"
              [disabled]="isGameOver"
              [attr.aria-label]="hole.id === activeMoleIndex ? 'Topo visible' : hole.label"
              (click)="onHoleClicked(hole.id)"
            >
              <span class="hole-rim"></span>
              <span class="mole" [class.visible]="hole.id === activeMoleIndex">
                <span class="mole-face" [class.gold]="hole.id === activeMoleIndex && activeMoleVariant === 'gold'">
                  <span class="mole-nose" aria-hidden="true"></span>
                </span>
              </span>
            </button>
          }
        </section>

        <footer class="minigame-footer">
          @if (isGameOver) {
            <p>Tiempo terminado. Has conseguido {{ score }} punto{{ score === 1 ? '' : 's' }}.</p>
            @if (allowRestart()) {
              <button type="button" class="restart-button" (click)="restartGame()">Jugar otra vez</button>
            }
          } @else {
            <p>Haz clic en los topos al salir. Los dorados valen 3 puntos.</p>
          }
        </footer>
      </article>
    </div>
  `,
  styleUrl: './minijuego-1.css',
})
export class DixitMinijuego1 implements OnInit, OnDestroy {
  readonly durationMs = input(15_000);
  readonly opponentNickname = input('Azzal-e');
  readonly allowRestart = input(true);
  readonly closable = input(true);
  readonly close = output<void>();
  readonly finished = output<{ score: number }>();
  readonly holes: readonly MoleHole[] = Array.from({ length: 9 }, (_, index) => ({
    id: index,
    label: `Hueco ${index + 1}`,
  }));

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly moleFadeOutGraceMs = 180;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private moleIntervalId: ReturnType<typeof setInterval> | null = null;
  private finishTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hasEmittedResult = false;
  private gameEndsAt = 0;

  timeLeft = 15;
  score = 0;
  activeMoleIndex = -1;
  activeMoleVariant: MoleVariant = 'normal';
  previousMoleIndex = -1;
  previousMoleVariant: MoleVariant = 'normal';
  previousMoleExpiresAt = 0;
  isGameOver = false;

  get initialTimeLeft(): number {
    return this.resolveInitialTimeLeft();
  }

  ngOnInit(): void {
    this.startGame();
  }

  ngOnDestroy(): void {
    this.clearGameIntervals();
  }

  onHoleClicked(holeId: number): void {
    if (this.isGameOver) {
      return;
    }

    const now = Date.now();
    const clickedActiveMole = holeId === this.activeMoleIndex;
    const clickedFadingMole =
      holeId === this.previousMoleIndex && now <= this.previousMoleExpiresAt;

    if (!clickedActiveMole && !clickedFadingMole) {
      return;
    }

    const clickedVariant = clickedActiveMole ? this.activeMoleVariant : this.previousMoleVariant;
    this.score += clickedVariant === 'gold' ? 3 : 1;

    if (clickedActiveMole) {
      this.activeMoleIndex = -1;
      this.activeMoleVariant = 'normal';
    } else {
      this.previousMoleIndex = -1;
      this.previousMoleVariant = 'normal';
      this.previousMoleExpiresAt = 0;
    }
  }

  restartGame(): void {
    this.startGame();
  }

  private startGame(): void {
    this.clearGameIntervals();
    this.timeLeft = this.resolveInitialTimeLeft();
    this.score = 0;
    this.isGameOver = false;
    this.hasEmittedResult = false;
    this.gameEndsAt = Date.now() + this.resolveGameDurationMs();
    this.showRandomMole();

    this.finishTimeoutId = setTimeout(() => {
      this.finishGame();
      this.cdr.detectChanges();
    }, this.resolveGameDurationMs());

    this.timerIntervalId = setInterval(() => {
      const nextTimeLeft = Math.max(0, Math.ceil((this.gameEndsAt - Date.now()) / 1000));
      if (nextTimeLeft <= 0) {
        this.finishGame();
        this.cdr.detectChanges();
        return;
      }

      this.timeLeft = nextTimeLeft;
      this.cdr.detectChanges();
    }, 1000);

    this.moleIntervalId = setInterval(() => {
      this.showRandomMole();
      this.cdr.detectChanges();
    }, 620);
  }

  private finishGame(): void {
    if (this.isGameOver) {
      return;
    }

    this.clearGameIntervals();
    this.timeLeft = 0;
    this.activeMoleIndex = -1;
    this.activeMoleVariant = 'normal';
    this.previousMoleIndex = -1;
    this.previousMoleVariant = 'normal';
    this.previousMoleExpiresAt = 0;
    this.isGameOver = true;
    this.emitResultOnce();
  }

  private showRandomMole(): void {
    if (this.isGameOver || this.holes.length === 0) {
      return;
    }

    if (this.activeMoleIndex >= 0) {
      this.previousMoleIndex = this.activeMoleIndex;
      this.previousMoleVariant = this.activeMoleVariant;
      this.previousMoleExpiresAt = Date.now() + this.moleFadeOutGraceMs;
    } else if (Date.now() > this.previousMoleExpiresAt) {
      this.previousMoleIndex = -1;
      this.previousMoleVariant = 'normal';
      this.previousMoleExpiresAt = 0;
    }

    let nextIndex = Math.floor(Math.random() * this.holes.length);
    if (this.holes.length > 1) {
      while (nextIndex === this.activeMoleIndex) {
        nextIndex = Math.floor(Math.random() * this.holes.length);
      }
    }

    this.activeMoleIndex = nextIndex;
    this.activeMoleVariant = Math.random() < 0.22 ? 'gold' : 'normal';
  }

  private clearGameIntervals(): void {
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }

    if (this.moleIntervalId !== null) {
      clearInterval(this.moleIntervalId);
      this.moleIntervalId = null;
    }

    if (this.finishTimeoutId !== null) {
      clearTimeout(this.finishTimeoutId);
      this.finishTimeoutId = null;
    }
  }

  private resolveInitialTimeLeft(): number {
    const durationMs = this.durationMs();
    if (!Number.isFinite(durationMs)) {
      return 15;
    }

    return Math.max(5, Math.ceil(durationMs / 1000));
  }

  private resolveGameDurationMs(): number {
    const durationMs = this.durationMs();
    if (!Number.isFinite(durationMs)) {
      return 15_000;
    }

    return Math.max(5_000, durationMs);
  }

  private emitResultOnce(): void {
    if (this.hasEmittedResult) {
      return;
    }

    this.hasEmittedResult = true;
    this.finished.emit({ score: this.score });
  }
}
