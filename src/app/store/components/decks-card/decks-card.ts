import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-decks-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './decks-card.html',
  styleUrl: './decks-card.css',
})
export class DecksCard {
  @Input({ required: true }) deckImageSrc = '';
  @Input({ required: true }) deckPrice = 0;
  @Input() deckName = '';
  @Input() deckType = '';
  @Input() deckDescription = '';
  @Input() actionLabel = 'Comprar';
  @Input() canBuy = true;
  @Input() buying = false;
  @Input() secondaryActionLabel = '';
  @Input() secondaryActionLink: string | null = null;

  @Output() buy = new EventEmitter<void>();

  onBuyClick(): void {
    if (this.buying || !this.canBuy) {
      return;
    }

    this.buy.emit();
  }
}
