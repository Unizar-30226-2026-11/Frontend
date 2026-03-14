import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-decks-card',
  standalone: true,
  imports: [],
  template: `
    <article class="decks-card">
      <div class="deck-img">
        <img [src]="deckImageSrc" [alt]="deckName || 'Item de tienda'" />
        <div class="deck-copy">
          <h3>{{ deckName }}</h3>
          <p>{{ deckType }}</p>
        </div>
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
        @if (!deckOwned) {
          <div class="deck-price">
            <span class="coin-icon" aria-hidden="true"></span>
            <span>{{ deckPrice }}</span>
          </div>
        }
      </div>
    </article>
  `,
  styles: [`
    :host {
      --deck-button-width: 168px;
      --deck-price-width: 112px;
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
      position: relative;
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

    .deck-copy {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      padding: 18px 16px 14px;
      background: linear-gradient(180deg, rgba(7, 15, 33, 0) 0%, rgba(7, 15, 33, 0.94) 100%);
      color: #f4f6fb;
    }

    .deck-copy h3,
    .deck-copy p {
      margin: 0;
    }

    .deck-copy h3 {
      font-size: 1rem;
      line-height: 1.2;
    }

    .deck-copy p {
      margin-top: 4px;
      font-size: 0.85rem;
      opacity: 0.82;
      text-transform: capitalize;
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
      gap: 8px;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
    }

    .coin-icon {
      position: relative;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      flex: 0 0 auto;
      background: radial-gradient(circle at 32% 32%, #fff1a6 0%, #f4c95d 42%, #c98b19 100%);
      box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.45), 0 2px 6px rgba(0, 0, 0, 0.24);
    }

    .coin-icon::after {
      content: '';
      position: absolute;
      inset: 4px;
      border-radius: 50%;
      border: 1px solid rgba(132, 83, 9, 0.4);
    }

    @media (max-width: 640px) {
      :host {
        --deck-button-width: 146px;
        --deck-price-width: 96px;
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
  @Input() deckName = '';
  @Input() deckType = '';
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
