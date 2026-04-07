import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-decks-card',
  standalone: true,
  imports: [],
  templateUrl: './decks-card.html',
  styleUrl: './decks-card.css',
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
