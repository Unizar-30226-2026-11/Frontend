import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DeckCard } from '../../services/card-pull';
import { DixitTrackBoard, TrackBoardToken } from '../components/track-board';
import {
  DixitChatComposer,
  DixitPlayerRow,
  DixitWildcardReward,
} from '../dixit-phase.models';

@Component({
  selector: 'app-dixit-hand-phase',
  standalone: true,
  imports: [DixitTrackBoard],
  template: `
    <section class="hand-phase-layout">
      <app-dixit-track-board
        [title]="''"
        [subtitle]="''"
        [tokens]="boardTokens"
        [wildcardCells]="wildcardCells"
        [eventBackCells]="eventBackCells"
        [eventForwardCells]="eventForwardCells"
        [showControls]="false"
        [interactive]="false"
      >
        <div board-overlay class="board-overlay-content">
          <section class="board-overlay-shell">
            <div class="story-card hand-overlay">
              <div class="clue-copy">
                <span class="overlay-label">Pista actual</span>
                <h2>{{ currentClue || 'Esperando pista' }}</h2>
                <p class="storyteller-copy">
                  Cuenta-cuentos:
                  <strong>{{ storytellerName || 'Pendiente' }}</strong>
                </p>
                <p>
                  @if (!currentClue && isCurrentPlayerStoryteller) {
                    Escribe la pista y confirmala para abrir la ronda.
                  } @else if (!currentClue) {
                    Espera a que el cuenta-cuentos confirme la pista para poder jugar carta.
                  } @else if (isCurrentPlayerStoryteller) {
                    La pista ya esta publicada. Ahora elige tu carta y enviala al servidor.
                  } @else {
                    La pista ya esta publicada. Elige una carta y enviala al servidor.
                  }
                </p>

                @if (!currentClue && isCurrentPlayerStoryteller) {
                  <label class="clue-field">
                    <span>Tu pista</span>
                    <input
                      type="text"
                      maxlength="255"
                      [value]="clueDraft"
                      (input)="onClueDraftChanged($event)"
                      placeholder="Escribe una pista para esta ronda"
                    />
                  </label>
                }

                <div class="hand-submit-row">
                  @if (!currentClue && isCurrentPlayerStoryteller) {
                    <button
                      type="button"
                      class="secondary-action"
                      [disabled]="isStorySubmitDisabled"
                      (click)="storySubmitRequested.emit()"
                    >
                      Confirmar pista
                    </button>
                  }

                  @if (handSubmitted) {
                    <span class="status-pill">Jugada enviada</span>
                  }

                  <button
                    type="button"
                    class="sidebar-action"
                    [disabled]="isHandSubmitDisabled"
                    (click)="handSubmitRequested.emit()"
                  >
                    {{ handSubmitButtonText }}
                  </button>
                </div>
              </div>

              <div
                class="drop-zone"
                [class.has-card]="!!selectedCard"
                [class.is-dragover]="isDropZoneActive"
                (dragover)="onDropZoneDragOver($event)"
                (dragleave)="onDropZoneDragLeave()"
                (drop)="onDropZoneDrop($event)"
              >
                @if (selectedCard; as card) {
                  <img
                    draggable="false"
                    [src]="card.image"
                    [alt]="card.value + ' de ' + card.suit"
                  />
                  <p>Seleccionada: {{ card.code }}</p>
                } @else {
                  <p>Suelta aqui tu carta</p>
                }
              </div>
            </div>
          </section>
        </div>
      </app-dixit-track-board>

      <section class="table-support">
        <aside class="chat-panel">
          <p class="overlay-label">Chat</p>
          <h3>Sala</h3>

          <div class="chat-list">
            @if (chat.messages.length === 0) {
              <p class="chat-empty">Todavia no hay mensajes.</p>
            } @else {
              @for (message of chat.messages; track message.timestamp + message.username) {
                <article class="chat-message">
                  <strong>{{ message.username }}</strong>
                  <p>{{ message.text }}</p>
                </article>
              }
            }
          </div>

          <div class="chat-composer">
            <input
              type="text"
              maxlength="255"
              [value]="chat.draft"
              (input)="onChatDraftChanged($event)"
              placeholder="Escribe al lobby"
            />
            <button
              type="button"
              class="secondary-action"
              [disabled]="!chat.canSend"
              (click)="chatSubmitRequested.emit()"
            >
              Enviar
            </button>
          </div>
        </aside>

        <div class="cards-column">
          <section class="cards-panel hand-cards-panel">
            <div class="section-header">
              <div class="section-header-copy">
                <p class="overlay-label">Tu mano</p>
                <h3>Cartas disponibles</h3>
              </div>

              <div class="section-header-side">
                <div class="section-header-copy aligned-right">
                  <p class="overlay-label">Comodines</p>
                  <p class="strip-text section-header-note">
                    @if (wildcards.length === 0) {
                      Sin comodines todavia.
                    } @else {
                      Usa uno antes de enviar tu accion al servidor.
                    }
                  </p>
                </div>

                @if (selectedCard) {
                  <button type="button" class="secondary-action" (click)="clearSelectionRequested.emit()">
                    Quitar
                  </button>
                }
              </div>
            </div>

            <div class="hand-layout">
              <div class="hand-main">
                <div class="hand-cards">
                  @for (card of cards; track card.code) {
                    <button
                      type="button"
                      class="hand-card"
                      [class.selected]="card.code === selectedCardCode"
                      draggable="true"
                      (dragstart)="onHandCardDragStart(card, $event)"
                      (dragend)="onHandCardDragEnd()"
                      (click)="cardSelected.emit(card)"
                    >
                      <img
                        draggable="false"
                        [src]="card.image"
                        [alt]="card.value + ' de ' + card.suit"
                      />
                    </button>
                  }
                </div>
              </div>

              <aside class="wildcards-strip">
                @if (wildcards.length > 0) {
                  <div class="wildcards-list">
                    @for (wildcard of wildcards; track wildcard.id) {
                      <button
                        type="button"
                        class="wildcard-card"
                        (click)="wildcardUsed.emit(wildcard.id)"
                      >
                        <span class="wildcard-icon" aria-hidden="true">{{ wildcard.icon }}</span>
                        <div class="wildcard-copy">
                          <strong>{{ wildcard.name }}</strong>
                          <p>{{ wildcard.description }}</p>
                        </div>
                      </button>
                    }
                  </div>
                }
              </aside>
            </div>
          </section>
        </div>

        <aside class="players-panel">
          <p class="overlay-label">Jugadores</p>
          <h3>Mesa actual</h3>

          <div class="players-list">
            @for (player of players; track player.id) {
              <div class="player-row" [class.self]="player.isCurrentPlayer">
                <span class="player-dot" [style.background]="player.color"></span>
                <span class="player-name">{{ player.name }}</span>
                <span class="player-points">{{ player.points }}</span>
                @if (player.isCurrentPlayer) {
                  <span class="player-tag">Tu</span>
                }
              </div>
            }
          </div>
        </aside>
      </section>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: 12px;
    }

    .hand-phase-layout {
      display: grid;
      gap: 12px;
    }

    .board-overlay-content {
      pointer-events: auto;
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .board-overlay-shell {
      width: min(920px, 100%);
      display: flex;
      justify-content: center;
    }

    .story-card {
      width: min(100%, 46rem);
      border-radius: 22px;
      box-sizing: border-box;
      display: grid;
      gap: 14px;
    }

    .hand-overlay {
      grid-template-columns: minmax(0, 1.35fr) minmax(220px, 280px);
      align-items: stretch;
      padding: 18px 20px;
      background: rgba(247, 245, 239, 0.9);
      color: #1e2631;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.18);
      transform: translateX(4.5%);
    }

    .overlay-label {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
      color: rgba(72, 82, 94, 0.78);
    }

    h2,
    h3 {
      margin: 0;
    }

    h2,
    h3,
    .wildcard-icon {
      font-family: "FuenteDilana", sans-serif;
    }

    h2 {
      font-size: clamp(1.35rem, 2.1vw, 2rem);
      line-height: 1.05;
      color: #1d2430;
    }

    .clue-copy {
      display: grid;
      gap: 12px;
    }

    .clue-copy p,
    .wildcard-copy p,
    .strip-text,
    .chat-message p {
      margin: 0;
      line-height: 1.52;
    }

    .clue-field {
      display: grid;
      gap: 8px;
    }

    .clue-field span {
      font-size: 0.88rem;
      font-weight: 700;
      color: rgba(29, 36, 48, 0.8);
    }

    .clue-field input,
    .chat-composer input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(29, 36, 48, 0.18);
      border-radius: 14px;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.84);
      color: #1d2430;
      font: inherit;
    }

    .hand-submit-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .drop-zone {
      min-height: 210px;
      border-radius: 20px;
      border: 2px dashed rgba(73, 83, 97, 0.3);
      background: rgba(32, 39, 48, 0.14);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 16px;
      text-align: center;
      transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
    }

    .drop-zone.is-dragover {
      border-color: rgba(23, 112, 238, 0.7);
      background: rgba(23, 112, 238, 0.14);
      transform: scale(1.02);
    }

    .drop-zone.has-card {
      background: rgba(20, 118, 86, 0.12);
      border-style: solid;
      border-color: rgba(20, 118, 86, 0.45);
    }

    .drop-zone img {
      width: min(140px, 100%);
      border-radius: 16px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(18, 121, 82, 0.14);
      color: #126f4d;
      font-weight: 700;
    }

    .sidebar-action,
    .secondary-action {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
    }

    .sidebar-action {
      background: linear-gradient(135deg, #f5d272, #ffefbc);
      color: #18212d;
    }

    .secondary-action {
      background: rgba(255, 255, 255, 0.1);
      color: #fff4d2;
      border: 1px solid rgba(255, 255, 255, 0.16);
    }

    .sidebar-action:disabled,
    .secondary-action:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .table-support {
      --support-panel-height: clamp(14.5rem, 30vh, 20rem);
      display: grid;
      grid-template-columns: clamp(240px, 24vw, 320px) minmax(0, 1fr) clamp(220px, 22vw, 280px);
      gap: 12px;
      align-items: stretch;
    }

    .chat-panel,
    .cards-panel,
    .players-panel {
      border-radius: 24px;
      background: rgba(8, 20, 29, 0.58);
      border: 1px solid rgba(255, 255, 255, 0.14);
      backdrop-filter: blur(10px);
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.16);
      padding: 16px;
      display: grid;
      gap: 16px;
      min-width: 0;
      color: #f4efe4;
    }

    .chat-panel,
    .players-panel {
      height: var(--support-panel-height);
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      box-sizing: border-box;
    }

    .chat-list,
    .players-list,
    .wildcards-list {
      overflow-y: auto;
      min-height: 0;
      display: grid;
      align-content: start;
      gap: 10px;
      padding-right: 4px;
    }

    .chat-message,
    .player-row {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 10px 12px;
    }

    .chat-message strong {
      display: block;
      margin-bottom: 4px;
      color: #fff4d8;
    }

    .chat-empty {
      margin: 0;
      color: rgba(244, 239, 228, 0.78);
    }

    .chat-composer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
    }

    .cards-column {
      display: flex;
      height: var(--support-panel-height);
      min-height: 0;
    }

    .cards-panel {
      height: 100%;
      min-height: 0;
      box-sizing: border-box;
      overflow: hidden;
    }

    .hand-cards-panel {
      grid-template-rows: auto minmax(0, 1fr);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
    }

    .section-header-copy {
      display: grid;
      gap: 4px;
    }

    .section-header-side {
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      gap: 12px;
      margin-left: auto;
    }

    .aligned-right {
      text-align: right;
      justify-items: end;
    }

    .section-header-note {
      max-width: 16rem;
    }

    .hand-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) clamp(170px, 18vw, 220px);
      gap: 14px;
      align-items: stretch;
      min-height: 0;
      height: 100%;
    }

    .hand-main {
      min-width: 0;
      min-height: 0;
    }

    .hand-cards {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 6px;
    }

    .hand-card {
      width: clamp(94px, 10vw, 120px);
      flex: 0 0 auto;
      appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      border-radius: 20px;
      cursor: grab;
      transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
    }

    .hand-card:hover {
      transform: translateY(-4px);
    }

    .hand-card.selected {
      box-shadow: 0 0 0 4px rgba(96, 180, 255, 0.88);
    }

    .hand-card img {
      width: 100%;
      display: block;
      border-radius: 18px;
    }

    .wildcards-strip {
      display: grid;
      grid-template-rows: minmax(0, 1fr);
      height: 100%;
      min-width: 0;
      min-height: 0;
      padding-left: 14px;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }

    .wildcard-card {
      width: 100%;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      text-align: left;
      border-radius: 18px;
      padding: 14px;
      background: linear-gradient(145deg, rgba(120, 69, 190, 0.28), rgba(58, 29, 112, 0.42));
      border: 1px solid rgba(208, 182, 255, 0.26);
      cursor: pointer;
    }

    .wildcard-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: linear-gradient(145deg, #fbe7ff, #dcb3ff);
      color: #41195f;
      font-size: 1.2rem;
    }

    .wildcard-copy strong {
      display: block;
      color: #fff4d8;
      margin-bottom: 4px;
    }

    .players-list {
      height: 100%;
    }

    .player-row {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 10px;
    }

    .player-row.self {
      border: 1px solid rgba(255, 214, 117, 0.3);
      background: rgba(255, 214, 117, 0.12);
    }

    .player-dot {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      display: inline-block;
    }

    .player-name {
      font-weight: 600;
    }

    .player-points {
      color: rgba(244, 239, 228, 0.84);
      font-weight: 700;
    }

    .player-tag {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(255, 214, 117, 0.18);
      color: #ffe7a5;
      font-size: 0.78rem;
      font-weight: 700;
    }

    @media (max-width: 1160px) {
      .table-support {
        grid-template-columns: 1fr;
      }

      .chat-panel,
      .players-panel,
      .cards-column {
        height: auto;
      }
    }

    @media (max-width: 900px) {
      .hand-overlay,
      .hand-layout,
      .chat-composer {
        grid-template-columns: 1fr;
      }

      .board-overlay-shell {
        width: 100%;
      }

      .hand-overlay {
        transform: none;
      }
    }
  `,
})
export class DixitHandPhase {
  @Input() currentClue = '';
  @Input() cards: DeckCard[] = [];
  @Input() selectedCardCode = '';
  @Input() clueDraft = '';
  @Input() storytellerName = '';
  @Input() isCurrentPlayerStoryteller = false;
  @Input() handSubmitted = false;
  @Input() isStorySubmitDisabled = true;
  @Input() isHandSubmitDisabled = true;
  @Input() handSubmitButtonText = 'Jugar carta';
  @Input() wildcards: DixitWildcardReward[] = [];
  @Input() players: DixitPlayerRow[] = [];
  @Input() boardTokens: TrackBoardToken[] = [];
  @Input() wildcardCells: number[] = [];
  @Input() eventBackCells: number[] = [];
  @Input() eventForwardCells: number[] = [];
  @Input() chat: DixitChatComposer = {
    draft: '',
    canSend: false,
    messages: [],
  };

  @Output() readonly cardSelected = new EventEmitter<DeckCard>();
  @Output() readonly clearSelectionRequested = new EventEmitter<void>();
  @Output() readonly storySubmitRequested = new EventEmitter<void>();
  @Output() readonly handSubmitRequested = new EventEmitter<void>();
  @Output() readonly clueDraftChanged = new EventEmitter<string>();
  @Output() readonly wildcardUsed = new EventEmitter<string>();
  @Output() readonly chatDraftChanged = new EventEmitter<string>();
  @Output() readonly chatSubmitRequested = new EventEmitter<void>();

  draggedHandCardCode = '';
  isDropZoneActive = false;

  get selectedCard(): DeckCard | undefined {
    return this.cards.find((card) => card.code === this.selectedCardCode);
  }

  onClueDraftChanged(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.clueDraftChanged.emit(target.value.slice(0, 255));
  }

  onChatDraftChanged(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.chatDraftChanged.emit(target.value.slice(0, 255));
  }

  onHandCardDragStart(card: DeckCard, event?: DragEvent): void {
    this.draggedHandCardCode = card.code;
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.code);
    }
  }

  onHandCardDragEnd(): void {
    this.draggedHandCardCode = '';
    this.isDropZoneActive = false;
  }

  onDropZoneDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDropZoneActive = true;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDropZoneDragLeave(): void {
    this.isDropZoneActive = false;
  }

  onDropZoneDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDropZoneActive = false;

    const droppedCode = event.dataTransfer?.getData('text/plain') || this.draggedHandCardCode;
    const droppedCard = this.cards.find((card) => card.code === droppedCode);
    if (!droppedCard) {
      return;
    }

    this.cardSelected.emit(droppedCard);
    this.draggedHandCardCode = '';
  }
}
