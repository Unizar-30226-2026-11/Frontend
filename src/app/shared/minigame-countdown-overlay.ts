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
        <p class="duel-copy">{{ displayCopy }}</p>
        <div class="countdown-ring" aria-hidden="true">
          <strong class="countdown-number">{{ secondsLeft }}</strong>
        </div>
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
      background:
        radial-gradient(circle at center, rgba(118, 178, 255, 0.12), transparent 32%),
        rgba(4, 8, 14, 0.56);
      backdrop-filter: blur(10px);
    }

    .countdown-popup {
      width: min(34rem, 100%);
      display: grid;
      justify-items: center;
      gap: 16px;
      border-radius: 28px;
      padding: clamp(24px, 4vw, 38px);
      box-sizing: border-box;
      text-align: center;
      color: #f4efe4;
      background:
        radial-gradient(circle at top, rgba(255, 236, 171, 0.2), transparent 34%),
        radial-gradient(circle at bottom right, rgba(83, 146, 247, 0.16), transparent 32%),
        linear-gradient(160deg, rgba(17, 32, 54, 0.96), rgba(10, 22, 36, 0.96));
      border: 1px solid rgba(255, 240, 196, 0.24);
      box-shadow:
        0 28px 60px rgba(4, 8, 14, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
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
      font-size: clamp(1.75rem, 4vw, 2.7rem);
      line-height: 1.08;
      color: #fff6d7;
      max-width: 12ch;
      text-wrap: balance;
    }

    .duel-copy {
      margin: 0;
      color: rgba(244, 239, 228, 0.9);
      font-size: clamp(1rem, 1.5vw, 1.12rem);
      line-height: 1.45;
    }

    .countdown-ring {
      width: clamp(112px, 18vw, 152px);
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      border-radius: 50%;
      padding: 10px;
      background:
        radial-gradient(circle at center, rgba(17, 32, 54, 0.16) 0 56%, transparent 57%),
        conic-gradient(from -90deg, #fff1b8, #f6c958, #8cc8ff, #fff1b8);
      box-shadow:
        0 18px 40px rgba(12, 7, 24, 0.3),
        inset 0 0 0 1px rgba(255, 255, 255, 0.14);
      animation: countdownPulse 900ms ease-in-out infinite;
    }

    .countdown-number {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background:
        radial-gradient(circle at top, rgba(255, 255, 255, 0.2), transparent 38%),
        linear-gradient(145deg, #fff5ca, #f5c955);
      color: #201320;
      font-family: "FuenteDilana", sans-serif;
      font-size: clamp(3.2rem, 7vw, 4.6rem);
      line-height: 1;
      box-shadow: 0 18px 34px rgba(12, 7, 24, 0.28);
    }

    @keyframes countdownPulse {
      0%,
      100% {
        transform: scale(1);
      }

      50% {
        transform: scale(1.04);
      }
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
    return this.sanitizeCopy(this.title);
  }

  get displayCopy(): string {
    return this.sanitizeCopy(this.copy);
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

  private sanitizeCopy(value: string): string {
    return value
      .replace(/^(?:(?:Ã‚)?Â¡|¡)Vaya!\s*/i, 'Vaya, ')
      .replace(/Preparate/g, 'Prepárate')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
