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
            <section class="collection-section">
              <button
                type="button"
                class="collection-header"
                [attr.aria-expanded]="collection.expanded"
                [attr.aria-controls]="'collection-panel-' + collection.id"
                (click)="toggleCollection.emit(collection.id)"
              >
                <h3 class="collection-title">{{ collection.name }}</h3>
                <span class="badge small">{{ collection.collected }}/{{ collection.total }}</span>
                <span class="collection-chevron" aria-hidden="true">
                  {{ collection.expanded ? 'v' : '>' }}
                </span>
              </button>

              @if (collection.expanded) {
                <div class="collection-panel" [id]="'collection-panel-' + collection.id">
                  @if (collection.cardsLoading) {
                    <p class="cards-status">Cargando cartas...</p>
                  } @else if (collection.cardsError) {
                    <p class="cards-status">{{ collection.cardsError }}</p>
                  } @else if (collection.cards.length === 0) {
                    <p class="cards-status">No hay cartas en esta coleccion.</p>
                  } @else {
                    <div class="cards-grid">
                      @for (card of collection.cards; track card.id) {
                        <article class="card-tile" [attr.title]="card.title">
                          <img
                            [src]="card.imageUrl"
                            [alt]="card.title"
                            loading="lazy"
                            draggable="false"
                          />
                          @if (card.locked) {
                            <div class="locked-overlay" aria-label="Carta bloqueada">
                              &#128274;
                            </div>
                          }
                          <span class="card-id">{{ card.title }}</span>
                        </article>
                      }
                    </div>
                  }
                </div>
              }
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
          &uarr;
        </button>
        <button
          type="button"
          class="round-btn"
          (click)="nextCommunity.emit()"
          aria-label="Carta siguiente"
        >
          &darr;
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
              &#9733;
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
  @Output() toggleCollection = new EventEmitter<string>();
}
