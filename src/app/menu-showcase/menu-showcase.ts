import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { UserBoardSummary } from '../services/boards-pull';
import { MenuCardCollection } from './menu-showcase-base';

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
      <h2>{{ boardTitle }}</h2>
      <figure class="community-figure">
        <img
          [src]="selectedBoard?.image || fallbackBoardImage"
          [alt]="selectedBoardId ? 'Vista previa del tablero seleccionado' : 'Vista previa del tablero'"
        />
      </figure>
      <h3 class="community-title">Tablero seleccionado</h3>
      <div class="board-actions">
        @if (boardsLoading) {
          <p class="board-status">Cargando tableros...</p>
        } @else if (boardsError) {
          <p class="board-status error">{{ boardsError }}</p>
        } @else if (boards.length === 0) {
          <p class="board-status">No tienes tableros disponibles.</p>
        } @else {
          <div class="board-grid" aria-label="Tableros disponibles">
            @for (board of boards; track board.id) {
              <button
                type="button"
                class="board-option"
                [class.selected]="board.id === selectedBoardId"
                [attr.aria-pressed]="board.id === selectedBoardId"
                [attr.aria-label]="'Seleccionar tablero ' + board.id"
                (click)="boardSelectionChange.emit(board.id)"
              >
                <img [src]="board.image" [alt]="'Tablero ' + board.id" loading="lazy" draggable="false" />
              </button>
            }
          </div>

          @if (boardActionMessage) {
            <p class="board-status success">{{ boardActionMessage }}</p>
          }

          @if (boardActionError) {
            <p class="board-status error">{{ boardActionError }}</p>
          }

          <button
            type="button"
            class="board-activate-btn"
            [disabled]="activatingBoard || !selectedBoardId"
            (click)="activateBoard.emit()"
          >
            {{ activatingBoard ? 'Confirmando...' : 'Confirmar tablero' }}
          </button>
        }
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
  @Input() boards: UserBoardSummary[] = [];
  @Input() selectedBoard: UserBoardSummary | null = null;
  @Input() selectedBoardId = '';
  @Input() boardsLoading = true;
  @Input() boardsError = '';
  @Input() boardActionMessage = '';
  @Input() boardActionError = '';
  @Input() activatingBoard = false;
  @Input() boardTitle = 'Seleccion de tableros:';
  @Input() fallbackBoardImage = '/assets/Tablero.png';

  @Output() boardSelectionChange = new EventEmitter<string>();
  @Output() activateBoard = new EventEmitter<void>();
  @Output() toggleCollection = new EventEmitter<string>();
}
