import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { RealtimeStarSpawn } from '../../interfaces/dixit-realtime';

interface RenderedStarState {
  starId: string;
  duration: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isAnimating: boolean;
}

@Component({
  selector: 'app-falling-star-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="star-layer" aria-live="polite">
      @if (renderedStar) {
        <button
          type="button"
          class="star-button"
          [class.animating]="renderedStar.isAnimating"
          [class.claimable]="claimEnabled"
          [style.left.%]="renderedStar.isAnimating ? renderedStar.endX : renderedStar.startX"
          [style.top.%]="renderedStar.isAnimating ? renderedStar.endY : renderedStar.startY"
          [style.--star-flight-ms.ms]="renderedStar.duration"
          [attr.aria-label]="claimEnabled ? 'Capturar estrella fugaz' : 'Estrella fugaz en pantalla'"
          (click)="requestClaim()"
        >
          <span class="star-core" aria-hidden="true">✦</span>
          <span class="star-tail" aria-hidden="true"></span>
        </button>
      }

      @if (winnerLabel && winnerVisible) {
        <div class="star-banner">
          <span>+3</span>
          <strong>{{ winnerLabel }}</strong>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 34;
      }

      .star-layer {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }

      .star-button {
        position: absolute;
        width: 96px;
        height: 96px;
        border: 0;
        padding: 0;
        background: transparent;
        transform: translate(-50%, -50%) scale(0.88) rotate(-10deg);
        transition:
          left var(--star-flight-ms, 2400ms) linear,
          top var(--star-flight-ms, 2400ms) linear,
          transform 180ms ease,
          opacity 180ms ease;
        cursor: default;
        pointer-events: none;
        opacity: 0.98;
      }

      .star-button.animating {
        transform: translate(-50%, -50%) scale(1) rotate(12deg);
      }

      .star-button.claimable {
        cursor: pointer;
        pointer-events: auto;
      }

      .star-button.claimable:hover {
        transform: translate(-50%, -50%) scale(1.08) rotate(16deg);
      }

      .star-core {
        position: relative;
        z-index: 2;
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        font-size: 3.6rem;
        color: #fff5b7;
        text-shadow:
          0 0 10px rgba(255, 240, 166, 0.88),
          0 0 24px rgba(255, 202, 88, 0.72),
          0 0 48px rgba(115, 212, 255, 0.42);
      }

      .star-tail {
        position: absolute;
        left: -118px;
        top: 50%;
        width: 132px;
        height: 18px;
        border-radius: 999px;
        transform: translateY(-50%) rotate(-10deg);
        background: linear-gradient(
          90deg,
          rgba(125, 219, 255, 0),
          rgba(125, 219, 255, 0.24) 22%,
          rgba(255, 244, 194, 0.82) 75%,
          rgba(255, 244, 194, 0.96)
        );
        filter: blur(1px);
        opacity: 0.92;
      }

      .star-banner {
        position: absolute;
        top: 16px;
        left: 50%;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border-radius: 999px;
        transform: translateX(-50%);
        background: rgba(7, 17, 30, 0.82);
        border: 1px solid rgba(255, 244, 194, 0.32);
        color: #fff4ce;
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22);
        pointer-events: none;
      }

      .star-banner span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.5rem;
        padding: 4px 10px;
        border-radius: 999px;
        background: linear-gradient(135deg, #f8d261, #fff0b8);
        color: #162031;
        font-weight: 900;
      }

      .star-banner strong {
        font-weight: 800;
      }

      @media (max-width: 700px) {
        .star-button {
          width: 78px;
          height: 78px;
        }

        .star-core {
          font-size: 2.9rem;
        }

        .star-tail {
          left: -92px;
          width: 104px;
        }
      }
    `,
  ],
})
export class FallingStarOverlay implements OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() star: RealtimeStarSpawn | null = null;
  @Input() claimEnabled = false;
  @Input() winnerLabel = '';
  @Input() winnerSequence = 0;
  @Output() readonly claimRequested = new EventEmitter<void>();

  renderedStar: RenderedStarState | null = null;
  winnerVisible = false;

  private animationFrameId: number | null = null;
  private starLifeTimer: ReturnType<typeof setTimeout> | null = null;
  private winnerTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    // Cada estrella entrante reinicia la animación desde su posición start.
    // winnerLabel/winnerSequence permiten relanzar el banner aunque gane dos veces
    // seguidas el mismo jugador.
    if (changes['star']) {
      this.syncStar();
    }

    if (changes['winnerLabel'] || changes['winnerSequence']) {
      this.syncWinnerBanner();
    }
  }

  ngOnDestroy(): void {
    // El overlay usa timers y RAF porque su vida útil es independiente del
    // componente padre. Al destruirse, se limpia todo para evitar fugas.
    this.clearAnimationFrame();
    this.clearStarLifeTimer();
    this.clearWinnerTimer();
  }

  requestClaim(): void {
    // Solo emitimos la captura si la estrella sigue visible y la UI la ha marcado
    // como reclamable. Así evitamos clicks tardíos sobre un nodo ya expirado.
    if (!this.renderedStar || !this.claimEnabled) {
      return;
    }

    this.claimRequested.emit();
  }

  private syncStar(): void {
    this.clearAnimationFrame();
    this.clearStarLifeTimer();

    if (!this.star) {
      this.renderedStar = null;
      this.cdr.markForCheck();
      return;
    }

    this.renderedStar = {
      starId: this.star.starId,
      duration: this.star.duration,
      startX: this.star.path.start.x,
      startY: this.star.path.start.y,
      endX: this.star.path.end.x,
      endY: this.star.path.end.y,
      isAnimating: false,
    };

    // Primer render: la estrella se pinta en start.
    // Siguiente frame: activamos el estado animating para que el navegador
    // transicione start -> end usando left/top en porcentaje de pantalla.
    this.animationFrameId = window.requestAnimationFrame(() => {
      if (!this.renderedStar || this.renderedStar.starId !== this.star?.starId) {
        return;
      }

      this.renderedStar = {
        ...this.renderedStar,
        isAnimating: true,
      };
      this.animationFrameId = null;
      this.cdr.markForCheck();
    });

    // Si nadie la captura, la estrella desaparece al agotar su vida útil.
    // Esto fuerza refresco aunque el último payload siga presente en el padre.
    this.starLifeTimer = window.setTimeout(() => {
      if (this.renderedStar?.starId === this.star?.starId) {
        this.renderedStar = null;
        this.cdr.markForCheck();
      }
      this.starLifeTimer = null;
    }, this.star.duration + 120);
  }

  private syncWinnerBanner(): void {
    this.clearWinnerTimer();
    // El banner es deliberadamente corto: solo confirma la captura y el +3.
    this.winnerVisible = !!this.winnerLabel.trim();

    if (!this.winnerVisible) {
      return;
    }

    this.winnerTimer = window.setTimeout(() => {
      this.winnerVisible = false;
      this.winnerTimer = null;
      this.cdr.markForCheck();
    }, 1800);
  }

  private clearAnimationFrame(): void {
    if (this.animationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  private clearStarLifeTimer(): void {
    if (this.starLifeTimer === null) {
      return;
    }

    window.clearTimeout(this.starLifeTimer);
    this.starLifeTimer = null;
  }

  private clearWinnerTimer(): void {
    if (this.winnerTimer === null) {
      return;
    }

    window.clearTimeout(this.winnerTimer);
    this.winnerTimer = null;
  }
}
