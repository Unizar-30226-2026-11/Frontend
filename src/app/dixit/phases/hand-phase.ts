import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DeckCard } from '../../services/card-pull';

@Component({
  selector: 'app-dixit-hand-phase',
  standalone: true,
  template: `
    <div class="fan-shell">
      <div class="cards-fan">
        @for (card of cards; track card.code; let i = $index) {
          <div
            class="card-group"
            [class.selected]="card.code === selectedCardCode"
            [style.transform]="getFanTransform(i)"
            [style.z-index]="getFanZIndex(i)"
            (click)="selectCard(card)"
          >
            <article class="card">
              <img [src]="card.image" [alt]="card.value + ' de ' + card.suit" />
            </article>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      margin-top: auto;
      width: 100%;
    }

    .fan-shell {
      width: 100%;
      overflow-x: auto;
      overflow-y: visible;
      padding: 8px 0 max(18px, env(safe-area-inset-bottom));
    }

    .cards-fan {
      width: max-content;
      min-height: 260px;
      margin: 0 auto;
      padding: 20px 32px 10px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      position: relative;
    }

    .card-group {
      width: clamp(110px, 14vw, 150px);
      margin-left: -56px;
      position: relative;
      transform-origin: center 115%;
      flex: 0 0 auto;
      cursor: pointer;
    }

    .card-group:first-child {
      margin-left: 0;
    }

    .card {
      border-radius: 14px;
      transition:
        transform 180ms ease,
        box-shadow 180ms ease,
        filter 180ms ease;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
      will-change: transform;
      background: transparent;
    }

    .cards-fan:hover .card {
      filter: saturate(0.92) brightness(0.97);
    }

    .card-group.selected .card {
      box-shadow: 0 16px 32px rgba(12, 122, 255, 0.35);
      outline: 2px solid rgba(12, 122, 255, 0.45);
      outline-offset: 2px;
    }

    .card img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 14px;
      border: 0;
      background: transparent;
    }

    @media (hover: hover) {
      .card-group:hover {
        z-index: 999 !important;
      }

      .card-group:hover .card {
        transform: translateY(-26px) rotate(0deg) scale(1.05);
        box-shadow: 0 18px 34px rgba(0, 0, 0, 0.2);
        filter: none !important;
      }
    }

    @media (max-width: 700px) {
      .cards-fan {
        min-height: 200px;
        padding: 12px 16px 8px;
      }

      .card-group {
        width: 105px;
        margin-left: -38px;
      }
    }
  `,
})
export class DixitHandPhase {
  @Input() cards: DeckCard[] = [];
  @Input() selectedCardCode = '';
  @Output() readonly cardSelected = new EventEmitter<DeckCard>();

  selectCard(card: DeckCard): void {
    this.cardSelected.emit(card);
  }

  getFanTransform(index: number): string {
    const total = this.cards.length;
    const rotation = this.getFanRotation(index, total);
    const drop = this.getFanDrop(index, total);
    return `translateY(${drop}) rotate(${rotation})`;
  }

  private getFanRotation(index: number, total: number): string {
    if (total <= 1) {
      return '0deg';
    }

    const maxSpread = Math.min(42, total * 7);
    const step = maxSpread / (total - 1);
    const angle = index * step - maxSpread / 2;
    return `${angle.toFixed(1)}deg`;
  }

  private getFanDrop(index: number, total: number): string {
    if (total <= 1) {
      return '0px';
    }

    const center = (total - 1) / 2;
    const distanceFromCenter = Math.abs(index - center);
    return `${Math.round(distanceFromCenter * 9)}px`;
  }

  getFanZIndex(index: number): number {
    return this.cards.length - index;
  }
}
