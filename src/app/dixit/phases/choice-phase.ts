import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DeckCard } from '../../services/card-pull';

@Component({
  selector: 'app-dixit-choice-phase',
  standalone: true,
  template: `
    <div class="choice-phase">
      <div class="choice-grid">
        @for (card of cards; track card.code) {
          <button
            type="button"
            class="choice-card"
            [class.selected]="card.code === getActiveSelectedCode()"
            (click)="selectCard(card)"
          >
            <img [src]="card.image" [alt]="card.value + ' de ' + card.suit" />
          </button>
        }
      </div>
      @if (getActiveSelectedCode()) {
        <button type="button" class="confirm-button" (click)="confirmChoice()">
          Confirmar
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      width: 100%;
    }

    .choice-phase {
      flex: 1;
      min-height: 0;
      width: 100%;
      flex-direction: column;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }

    .choice-grid {
      width: min(1100px, 100%);
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      align-items: flex-start;
      gap: clamp(8px, 1vw, 14px);
      padding: 0;
      overflow: visible;
    }

    .choice-card {
      appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      margin: 0;
      cursor: pointer;
      border-radius: 14px;
      width: 100%;
      min-width: 0;
      position: relative;
      z-index: 0;
      transform-origin: center center;
      transition:
        transform 160ms ease,
        box-shadow 160ms ease,
        filter 160ms ease;
      box-shadow: none;
    }

    .choice-card img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 14px;
    }

    .choice-grid:hover .choice-card {
      filter: saturate(0.94);
    }

    .choice-card:hover {
      transform: scale(1.035);
      z-index: 2;
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
      filter: none !important;
    }

    .choice-card.selected {
      outline: 5px solid #ffd54a;
      outline-offset: 3px;
    }

    .confirm-button {
      padding: 10px 18px;
      margin-top: 20px;
      background: red;
      border: 0;
      border-radius: 999px;
      font-weight: 600;
      cursor: pointer;
    }

    @media (max-width: 760px) {
      .choice-grid {
        grid-template-columns: repeat(6, minmax(72px, 1fr));
        gap: 8px;
      }
    }
  `,
})
export class DixitChoicePhase {
  @Input() cards: DeckCard[] = [];
  @Input() selectedCardCode = '';
  @Output() readonly choiceConfirmed = new EventEmitter<DeckCard>();
  private pendingSelectedCardCode = '';

  selectCard(card: DeckCard): void {
    this.pendingSelectedCardCode = card.code;
  }

  confirmChoice(): void {
    const selectedCode = this.getActiveSelectedCode();
    const selectedCard = this.cards.find((card) => card.code === selectedCode);
    if (!selectedCard) {
      return;
    }

    this.choiceConfirmed.emit(selectedCard);
  }

  getActiveSelectedCode(): string {
    return this.pendingSelectedCardCode || this.selectedCardCode;
  }
}
