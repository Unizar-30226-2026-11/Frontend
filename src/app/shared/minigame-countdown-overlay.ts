import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';

export const MINIGAME_COUNTDOWN_SECONDS = 3;
export const MINIGAME_COUNTDOWN_MS = MINIGAME_COUNTDOWN_SECONDS * 1000;

@Component({
  selector: 'app-minigame-countdown-overlay',
  standalone: true,
  template: `
    <div class="countdown-backdrop">
      <article
        class="countdown-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="minigame-countdown-title"
        aria-live="polite"
      >
        <p class="overlay-label">{{ eyebrow }}</p>
        <h2 id="minigame-countdown-title">{{ displayTitle }}</h2>
        <p class="duel-copy">{{ copy }}</p>
        <strong class="countdown-number">{{ secondsLeft }}</strong>
      </article>
    </div>
  `,
  styles: `
    .countdown-backdrop {
      position: fixed;
      inset: 0;
      z-index: 44;
      display: grid;
      place-items: center;
      padding: clamp(18px, 4vw, 42px);
      box-sizing: border-box;
      background: rgba(4, 8, 14, 0.48);
      backdrop-filter: blur(8px);
    }

    .countdown-popup {
      width: min(32rem, 100%);
      display: grid;
      justify-items: center;
      gap: 18px;
      border-radius: 24px;
      padding: clamp(22px, 4vw, 34px);
      box-sizing: border-box;
      text-align: center;
      color: #f4efe4;
      background:
        radial-gradient(circle at 20% 12%, rgba(255, 234, 158, 0.22), transparent 36%),
        linear-gradient(145deg, rgba(120, 69, 190, 0.34), rgba(9, 19, 30, 0.9));
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 24px 54px rgba(4, 8, 14, 0.36);
    }

    .overlay-label {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
      color: rgba(250, 233, 191, 0.84);
    }

    .countdown-popup h2 {
      margin: 0;
      font-family: "FuenteDilana", sans-serif;
      font-size: clamp(1.65rem, 4vw, 2.45rem);
      line-height: 1.08;
      color: #fff6d7;
    }

    .duel-copy {
      margin: 0;
      color: rgba(244, 239, 228, 0.86);
      line-height: 1.45;
    }

    .countdown-number {
      width: 96px;
      height: 96px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: linear-gradient(145deg, #fff5ca, #f5c955);
      color: #201320;
      font-family: "FuenteDilana", sans-serif;
      font-size: 3.8rem;
      line-height: 1;
      box-shadow: 0 18px 34px rgba(12, 7, 24, 0.28);
    }
  `,
})
export class MinigameCountdownOverlay implements OnChanges, OnDestroy {
  @Input() eyebrow = 'Desempate';
  @Input() title = 'Minijuego';
  @Input() copy = 'El minijuego empezara en';
  @Input() seconds = MINIGAME_COUNTDOWN_SECONDS;
  @Input() resetKey = '';

  @Output() readonly finished = new EventEmitter<void>();

  secondsLeft = MINIGAME_COUNTDOWN_SECONDS;
  private timer: ReturnType<typeof setInterval> | null = null;

  get displayTitle(): string {
    return this.title.replace(/^(?:Â)?¡Vaya! has empatado con /, 'Vaya, has empatado con ');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['seconds'] || changes['resetKey']) {
      this.startCountdown();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private startCountdown(): void {
    this.clearTimer();
    this.secondsLeft = Math.max(1, Math.ceil(this.seconds));
    this.timer = setInterval(() => {
      this.secondsLeft = Math.max(0, this.secondsLeft - 1);
      if (this.secondsLeft === 0) {
        this.clearTimer();
        this.finished.emit();
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timer === null) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }
}
