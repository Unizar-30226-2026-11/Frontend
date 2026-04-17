import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject, output } from '@angular/core';

interface MoleHole {
  id: number;
  label: string;
}

type MoleVariant = 'normal' | 'gold';

@Component({
  selector: 'app-dixit-minijuego-1',
  standalone: true,
  template: `
    <div class="minigame-backdrop" (click)="close.emit()">
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
            <p>Tienes 15 segundos. Cada topo acertado suma 1 punto.</p>
          </div>

          <button type="button" class="close-button" aria-label="Cerrar minijuego" (click)="close.emit()">
            Cerrar
          </button>
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
            <strong>{{ opponentNickname }}</strong>
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
            <button type="button" class="restart-button" (click)="restartGame()">Jugar otra vez</button>
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
  readonly close = output<void>();
  readonly holes: readonly MoleHole[] = Array.from({ length: 9 }, (_, index) => ({
    id: index,
    label: `Hueco ${index + 1}`,
  }));
  readonly opponentNickname = 'Azzal-e';

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly moleFadeOutGraceMs = 180;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private moleIntervalId: ReturnType<typeof setInterval> | null = null;

  timeLeft = 15;
  score = 0;
  activeMoleIndex = -1;
  activeMoleVariant: MoleVariant = 'normal';
  previousMoleIndex = -1;
  previousMoleVariant: MoleVariant = 'normal';
  previousMoleExpiresAt = 0;
  isGameOver = false;

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
    this.timeLeft = 15;
    this.score = 0;
    this.isGameOver = false;
    this.showRandomMole();

    this.timerIntervalId = setInterval(() => {
      if (this.timeLeft <= 1) {
        this.finishGame();
        this.cdr.detectChanges();
        return;
      }

      this.timeLeft -= 1;
      this.cdr.detectChanges();
    }, 1000);

    this.moleIntervalId = setInterval(() => {
      this.showRandomMole();
      this.cdr.detectChanges();
    }, 875);
  }

  private finishGame(): void {
    this.clearGameIntervals();
    this.timeLeft = 0;
    this.activeMoleIndex = -1;
    this.activeMoleVariant = 'normal';
    this.previousMoleIndex = -1;
    this.previousMoleVariant = 'normal';
    this.previousMoleExpiresAt = 0;
    this.isGameOver = true;
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
  }
}
