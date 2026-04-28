import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommunityCard, MenuCardCollection } from './menu-showcase-base';

@Component({
  selector: 'app-menu-showcase',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="panel my-cards">
      <header class="panel-header">
        <h2>Mis Cartas:</h2>
        <span class="badge">{{ collectedCards }}/{{ totalCards }}</span>
      </header>

      <div class="cards-scroll">
        @if (cardsLoading) {
          <p class="cards-status">Cargando colecciones...</p>
        } @else if (cardsError) {
          <p class="cards-status">{{ cardsError }}</p>
        } @else if (collections.length === 0) {
          <p class="cards-status">No hay cartas disponibles.</p>
        } @else {
          @for (collection of collections; track collection.id) {
            <section>
              <header class="collection-header">
                <h3 class="collection-title">{{ collection.name }}</h3>
                <span class="badge small">{{ collection.collected }}/{{ collection.total }}</span>
              </header>

              <div class="cards-grid">
                @for (card of collection.cards; track card.id) {
                  <article class="card-tile" [attr.title]="card.title">
                    <img [src]="card.imageUrl" [alt]="card.title" loading="lazy" />
                    @if (card.locked) {
                      <div class="locked-overlay" aria-label="Carta bloqueada">🔒</div>
                    }
                    <span class="card-id">{{ card.title }}</span>
                  </article>
                }
              </div>
            </section>
          }
        }
      </div>
    </article>

    <article class="panel community-card">
      <h2>{{ communityTitle }}</h2>
      <figure class="community-figure">
        <img [src]="currentCommunityCard.imageUrl" [alt]="currentCommunityCard.title" />
      </figure>
      <h3 class="community-title">{{ currentCommunityCard.title }}</h3>
      <div class="community-actions">
        <button
          type="button"
          class="round-btn"
          (click)="previousCommunity.emit()"
          aria-label="Carta anterior"
        >
          ↑
        </button>
        <button
          type="button"
          class="round-btn"
          (click)="nextCommunity.emit()"
          aria-label="Carta siguiente"
        >
          ↓
        </button>
        <span class="badge dark">{{ currentCommunityCard.id }}</span>
        <div class="stars" aria-label="Valorar carta">
          @for (star of [1, 2, 3, 4, 5]; track star) {
            <button
              type="button"
              class="star"
              [class.active]="star <= currentRating"
              (click)="ratingChange.emit(star)"
              [attr.aria-label]="'Puntuar con ' + star + ' estrellas'"
            >
              ★
            </button>
          }
        </div>
      </div>
    </article>
  `,
  styleUrl: './menu-showcase.css',
})
export class MenuShowcase {
  @Input() collections: MenuCardCollection[] = [];
  @Input() totalCards = 0;
  @Input() collectedCards = 0;
  @Input() cardsLoading = true;
  @Input() cardsError = '';
  @Input() currentRating = 0;
  @Input() currentCommunityCard!: CommunityCard;
  @Input() communityTitle = 'Cartas de la Comunidad:';

  @Output() previousCommunity = new EventEmitter<void>();
  @Output() nextCommunity = new EventEmitter<void>();
  @Output() ratingChange = new EventEmitter<number>();
}
