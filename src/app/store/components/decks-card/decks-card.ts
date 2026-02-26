import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-decks-card',
  standalone: true,
  imports: [],
  template: `
    <article class="decks-card">
      <div class="deck-img">
        <img [src]="deckImageSrc" alt="Mazo de cartas">
      </div>
      <div class="deck-footer" [class.deck-footer-owned]="deckOwned">
        <button
          type="button"
          class="deck-button"
          [disabled]="deckOwned || buying || !canBuy"
          (click)="onBuyClick()"
        >
          @if (buying) {
            Comprando...
          } @else if (deckOwned) {
            Ya adquirido
          } @else if (!canBuy) {
            Sin saldo
          } @else {
            Comprar
          }
        </button>
        <!-- En el prototipo no enseñamos el 'Price tag' si ya lo tenemos comprado. -->
        @if (!deckOwned) {
          <div class="deck-price">
            {{ deckPrice }}<span>$</span>
          </div>
        }
      </div>
    </article>
  `,
  styles: [`
    :host {
      --deck-button-width: 168px;
      --deck-price-width: 86px;
      --deck-controls-gap: 14px;
      display: block;
      width: min(calc(var(--deck-button-width) + var(--deck-price-width) + var(--deck-controls-gap)), 100%);
    }

    .decks-card {
      display: flex;
      flex-direction: column;
      gap: 18px;
      width: 100%;
    }

    .deck-img {
      background: linear-gradient(145deg, rgba(5, 52, 104, 0.95), rgba(8, 28, 67, 0.9));
      border-radius: 3px;
      overflow: hidden;
      box-shadow: 0 10px 22px rgba(5, 12, 28, 0.28);
      aspect-ratio: 16 / 9;
    }

    .deck-img img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: saturate(1.06) contrast(1.03);
    }

    .deck-footer {
      display: flex;
      align-items: center;
      gap: var(--deck-controls-gap);
      width: 100%;
    }

    .deck-footer-owned {
      justify-content: center;
    }

    .deck-button {
      border: 3px solid #95a1a6;
      background: linear-gradient(180deg, #bdd5ca 0%, #acc8ba 100%);
      color: #1e2223;
      border-radius: 16px;
      padding: 8px 24px;
      width: var(--deck-button-width);
      min-width: 0;
      box-sizing: border-box;
      font-size: clamp(1.05rem, 1.5vw, 1.35rem);
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      transition: transform 140ms ease, filter 140ms ease;
    }

    .deck-button:not(:disabled):hover {
      transform: translateY(-1px);
      filter: brightness(1.04);
    }

    .deck-button:disabled {
      background: linear-gradient(180deg, #c7c7c7 0%, #b8b8b8 100%);
      color: #5a5a5a;
      cursor: not-allowed;
    }

    .deck-price {
      background: rgba(35, 35, 40, 0.92);
      color: #f4f6fb;
      border-radius: 12px;
      width: var(--deck-price-width);
      min-width: 0;
      box-sizing: border-box;
      padding: 6px 14px;
      font-size: clamp(1.6rem, 2.6vw, 2.3rem);
      line-height: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
    }

    .deck-price span {
      font-size: 0.82em;
      margin-left: 2px;
      opacity: 0.95;
    }

    @media (max-width: 640px) {
      :host {
        --deck-button-width: 146px;
        --deck-price-width: 74px;
        --deck-controls-gap: 10px;
      }

      .decks-card {
        gap: 12px;
      }

      .deck-button {
        font-size: 1rem;
        padding: 7px 18px;
      }

      .deck-price {
        font-size: 1.8rem;
        padding: 5px 12px;
      }
    }
  `],
})
export class DecksCard {
  @Input({ required: true }) deckImageSrc = '';
  @Input({ required: true }) deckPrice = 0;
  @Input() deckOwned = false;
  @Input() canBuy = true;
  @Input() buying = false;

  @Output() buy = new EventEmitter<void>();

  onBuyClick(): void {
    if (this.deckOwned || this.buying || !this.canBuy) {
      return;
    }
    this.buy.emit();
  }
}
