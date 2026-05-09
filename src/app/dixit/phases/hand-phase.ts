import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DeckCard } from '../../services/card-pull';
import {
  DixitTrackBoard,
  TrackBoardSpecialCell,
  TrackBoardToken,
} from '../components/track-board';
import {
  DixitChatComposer,
  DixitHandLimitModifier,
  DixitPlayerRow,
} from '../dixit-phase.models';

@Component({
  selector: 'app-dixit-hand-phase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DixitTrackBoard],
  template: `
    <section class="hand-phase-layout">
      <section class="board-stage" [class.action-panel-open]="isActionPanelOpen">
        @if (!isActionPanelOpen) {
          <app-dixit-track-board
            [title]="''"
            [subtitle]="''"
            [tokens]="boardTokens"
            [boardImageUrl]="boardImageUrl"
            [specialCells]="specialCells"
            [showControls]="false"
            [interactive]="false"
          />
        } @else {
          <div
            class="action-panel-stage"
            [class.has-board-image]="!!boardImageUrl"
            [style.--board-image]="'url(' + boardImageUrl + ')'"
            aria-label="Panel de pista y jugada"
          ></div>
        }

        <button type="button" class="panel-toggle-button" (click)="toggleActionPanel()">
          {{ isActionPanelOpen ? 'Ver tablero' : 'Ver pista' }}
        </button>

        @if (isActionPanelOpen) {
        <section class="floating-hand-overlay-shell">
          <div class="story-card hand-overlay" [class.waiting-overlay]="handSubmitted">
            <div class="clue-copy">
              @if (handSubmitted) {
                <span class="overlay-label">Jugada enviada</span>
                <h2>Esperando al resto de jugadores</h2>
                <p class="storyteller-copy">
                  Cuenta-cuentos:
                  <strong>{{ storytellerName || 'Pendiente' }}</strong>
                </p>
                <p>
                  @if (isCurrentPlayerStoryteller) {
                    Tu pista y tu carta ya estan enviadas. La ronda avanzara cuando todos hayan terminado.
                  } @else {
                    Tu carta ya esta enviada. La ronda avanzara cuando todos los jugadores hayan terminado.
                  }
                </p>
                @if (currentClue) {
                  <p class="submitted-detail">Pista: <strong>{{ currentClue }}</strong></p>
                }
                @if (submittedCardLabel) {
                  <p class="submitted-detail">Carta enviada: <strong>{{ submittedCardLabel }}</strong></p>
                }
                <div class="waiting-feedback" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              } @else {
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
                    La pista ya esta publicada. Esperando a que el resto envie su carta.
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

                  @if (!isCurrentPlayerStoryteller) {
                    <button
                      type="button"
                      class="sidebar-action"
                      [disabled]="isHandSubmitDisabled"
                      (click)="handSubmitRequested.emit()"
                    >
                      {{ handSubmitButtonText }}
                    </button>
                  }
                </div>
              }
            </div>

            @if (handSubmitted) {
              <div class="waiting-zone">
                <span class="waiting-check" aria-hidden="true">OK</span>
                <strong>Jugada registrada</strong>
                <p>Ya no necesitas hacer nada en esta fase.</p>
              </div>
            } @else {
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
            }
          </div>
        </section>
        }
      </section>

      <section class="table-support">
        <aside class="chat-panel">
          <p class="overlay-label">Chat</p>
          <h3>Sala</h3>

          <div class="chat-list" #chatList>
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
              (keydown)="onChatComposerKeydown($event)"
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
                @if (handLimitModifier; as modifier) {
                  <img
                    class="hand-modifier-badge"
                    [src]="modifier.value === 1 ? 'assets/modificador_hand_limit_plus.png' : 'assets/modificador_hand_limit.png'"
                    [alt]="'Modificador de mano activo: ' + formatModifierValue(modifier.value)"
                    [title]="handLimitModifierTooltip"
                    draggable="false"
                  />
                }
                @if (selectedCard) {
                  <button type="button" class="secondary-action" (click)="clearSelectionRequested.emit()">
                    Quitar
                  </button>
                }
              </div>
            </div>

            <div class="hand-layout">
              <div class="hand-main">
                @if (cards.length === 0) {
                  <div class="hand-empty-state">
                    <strong>Esperando tu mano</strong>
                    <p>La fase ya esta activa, pero las cartas todavia no han llegado por <code>private_hand</code>.</p>
                  </div>
                } @else {
                  <div class="hand-cards">
                    @for (card of cards; track card.code) {
                      <button
                        type="button"
                        class="hand-card"
                        [class.selected]="card.code === selectedCardCode"
                        [disabled]="handSubmitted"
                        [attr.draggable]="handSubmitted ? 'false' : 'true'"
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
                }
              </div>
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
      --support-panel-height: clamp(14.5rem, 30vh, 20rem);
      --track-board-max-height: calc(100svh - var(--support-panel-height) - 8.5rem);
      display: grid;
      gap: 12px;
    }

    .board-stage {
      display: grid;
      gap: 0;
      min-width: 0;
      position: relative;
      isolation: isolate;
    }

    .action-panel-stage {
      --board-image: none;
      width: 100%;
      aspect-ratio: 15 / 5.6;
      height: min(var(--track-board-target-height, 38.5cqw), var(--track-board-max-height, 58svh));
      min-height: 26rem;
      border-radius: 12px;
      background:
        linear-gradient(125deg, rgba(19, 80, 88, 0.28), rgba(14, 31, 62, 0.5)),
        var(--board-image),
        radial-gradient(circle at 20% 20%, rgba(179, 231, 212, 0.32) 0%, rgba(0, 0, 0, 0) 44%),
        radial-gradient(circle at 82% 72%, rgba(71, 126, 210, 0.28) 0%, rgba(0, 0, 0, 0) 42%),
        linear-gradient(125deg, rgba(19, 80, 88, 0.9), rgba(14, 31, 62, 0.95));
      background-size: cover;
      background-position: center;
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }

    app-dixit-track-board {
      display: block;
      position: relative;
      z-index: 1;
    }

    .panel-toggle-button {
      position: absolute;
      left: auto;
      right: clamp(30px, 3.2vw, 52px);
      top: clamp(24px, 3vw, 42px);
      transform: none;
      z-index: 4;
      border: 1px solid rgba(255, 239, 188, 0.42);
      border-radius: 999px;
      padding: 9px 16px;
      background: rgba(8, 20, 29, 0.78);
      color: #fff4d2;
      font-weight: 800;
      font-size: 1rem;
      cursor: pointer;
      box-shadow: 0 12px 26px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(10px);
    }

    .panel-toggle-button:hover {
      background: rgba(19, 43, 58, 0.88);
    }

    .floating-hand-overlay-shell {
      position: absolute;
      inset: 0;
      z-index: 3;
      width: 100%;
      height: 100%;
      min-height: 0;
      margin: 0;
      pointer-events: auto;
      transform: none;
      display: grid;
      place-items: stretch;
      padding: clamp(12px, 1.6vw, 22px);
      box-sizing: border-box;
    }

    .story-card {
      width: 100%;
      height: 100%;
      min-height: 0;
      max-height: 100%;
      border-radius: 26px;
      box-sizing: border-box;
      display: grid;
      gap: clamp(16px, 2vw, 26px);
    }

    .hand-overlay {
      grid-template-columns: minmax(0, 1fr) minmax(330px, 0.72fr);
      align-items: center;
      justify-content: center;
      min-height: 0;
      overflow: auto;
      column-gap: clamp(36px, 5.8vw, 88px);
      padding: clamp(30px, 4.2vw, 58px);
      padding-top: clamp(70px, 6.4vw, 92px);
      background:
        radial-gradient(circle at top left, rgba(255, 239, 199, 0.16), transparent 34%),
        radial-gradient(circle at bottom right, rgba(214, 195, 145, 0.12), transparent 36%),
        linear-gradient(155deg, rgba(35, 45, 60, 0.9), rgba(23, 32, 44, 0.92));
      color: #f4efe4;
      border: 1px solid rgba(214, 195, 145, 0.34);
      box-shadow:
        0 24px 58px rgba(0, 0, 0, 0.32),
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        inset 0 0 0 1px rgba(214, 195, 145, 0.08);
      margin-inline: auto;
      transform: none;
    }

    .hand-overlay .drop-zone,
    .hand-overlay .waiting-zone {
      grid-column: 2;
      grid-row: 1;
      justify-self: center;
    }

    .hand-overlay .clue-copy {
      grid-column: 1;
      grid-row: 1;
      justify-self: center;
      align-self: center;
    }

    .waiting-overlay {
      min-height: 0;
      max-height: 100%;
      background:
        radial-gradient(circle at top left, rgba(216, 255, 231, 0.16), transparent 34%),
        linear-gradient(155deg, rgba(31, 58, 50, 0.92), rgba(23, 35, 44, 0.94));
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22), inset 0 0 0 1px rgba(18, 111, 77, 0.16);
    }

    .overlay-label {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.82rem;
      color: rgba(250, 233, 191, 0.84);
    }

    h2,
    h3 {
      margin: 0;
    }

    h2,
    h3 {
      font-family: "FuenteDilana", sans-serif;
    }

    h2 {
      font-size: clamp(1.65rem, 2.45vw, 2.45rem);
      line-height: 1.08;
      color: #fff6d7;
    }

    p {
      user-select: none;
    }
  
    .clue-copy {
      display: grid;
      gap: 14px;
      align-content: center;
      width: min(100%, 38rem);
      text-align: left;
    }

    .clue-copy > p:not(.overlay-label):not(.submitted-detail) {
      max-width: 32rem;
      color: rgba(244, 239, 228, 0.86);
      font-size: clamp(1.08rem, 1.2vw, 1.22rem);
    }

    .storyteller-copy {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(214, 195, 145, 0.16);
      color: rgba(244, 239, 228, 0.84);
      font-size: 1.05rem;
    }

    .storyteller-copy strong {
      color: #fff0bd;
    }

    .clue-copy p,
    .chat-message p {
      margin: 0;
      line-height: 1.52;
    }

    .clue-field {
      display: grid;
      gap: 9px;
      width: min(100%, 32rem);
      margin-top: 2px;
    }

    .clue-field span {
      font-size: 1rem;
      font-weight: 700;
      color: rgba(244, 239, 228, 0.84);
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
      justify-content: flex-start;
      gap: 12px;
      flex-wrap: wrap;
      width: min(100%, 32rem);
      margin-top: 4px;
    }

    .drop-zone {
      min-height: 0;
      width: min(100%, 390px);
      height: min(100%, 380px);
      border-radius: 22px;
      border: 2px dashed rgba(214, 195, 145, 0.46);
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 18px;
      text-align: center;
      align-self: center;
      transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
    }

    .drop-zone.is-dragover {
      border-color: rgba(23, 112, 238, 0.7);
      background: rgba(23, 112, 238, 0.14);
      transform: scale(1.02);
    }

    .drop-zone.has-card {
      background: rgba(20, 118, 86, 0.18);
      border-style: solid;
      border-color: rgba(214, 195, 145, 0.62);
      box-shadow: inset 0 0 0 1px rgba(255, 239, 188, 0.16);
    }

    .drop-zone img {
      width: min(178px, 100%);
      border-radius: 16px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
    }

    .submitted-detail {
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(214, 195, 145, 0.12);
      color: #fff0bd;
      border: 1px solid rgba(214, 195, 145, 0.18);
    }

    .waiting-feedback {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 18px;
    }

    .waiting-feedback span {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #126f4d;
      animation: waitingPulse 1.15s ease-in-out infinite;
    }

    .waiting-feedback span:nth-child(2) {
      animation-delay: 140ms;
    }

    .waiting-feedback span:nth-child(3) {
      animation-delay: 280ms;
    }

    .waiting-zone {
      min-height: 210px;
      border-radius: 20px;
      border: 1px solid rgba(18, 111, 77, 0.24);
      background: linear-gradient(160deg, rgba(18, 111, 77, 0.14), rgba(255, 255, 255, 0.62));
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 10px;
      padding: 18px;
      text-align: center;
    }

    .waiting-zone p {
      margin: 0;
      color: rgba(29, 36, 48, 0.72);
    }

    .waiting-check {
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: #126f4d;
      color: #f7fff9;
      font-weight: 900;
      letter-spacing: 0.04em;
      box-shadow: 0 12px 24px rgba(18, 111, 77, 0.22);
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
      font-size: 1rem;
      cursor: pointer;
    }

    .sidebar-action {
      background: linear-gradient(135deg, #f5d272, #ffefbc);
      color: #18212d;
    }

    .secondary-action {
      background: linear-gradient(135deg, #f0c95a, #ffe7a6);
      color: #1d2430;
      border: 1px solid rgba(29, 36, 48, 0.12);
      box-shadow: 0 10px 22px rgba(78, 59, 10, 0.14);
    }

    .sidebar-action:disabled,
    .secondary-action:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .table-support {
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
    .players-list {
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
      width: 100%;
      flex: 1 1 auto;
      height: var(--support-panel-height);
      min-height: 0;
    }

    .cards-panel {
      width: 100%;
      flex: 1 1 auto;
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

    .hand-modifier-badge {
      width: 42px;
      height: 42px;
      object-fit: contain;
      flex: 0 0 auto;
      border-radius: 10px;
      filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.24));
      cursor: help;
    }

    .hand-layout {
      display: block;
      min-height: 0;
      height: 100%;
      overflow: auto;
    }

    .hand-main {
      min-width: 0;
      min-height: 0;
    }

    .hand-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(94px, 1fr));
      gap: 12px;
      width: 100%;
      padding-bottom: 6px;
      align-items: start;
    }

    .hand-empty-state {
      min-height: 100%;
      display: grid;
      align-content: center;
      justify-items: start;
      gap: 8px;
      padding: 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px dashed rgba(255, 255, 255, 0.16);
    }

    .hand-empty-state p {
      margin: 0;
      color: rgba(244, 239, 228, 0.82);
      line-height: 1.5;
    }

    .hand-card {
      width: 100%;
      max-width: 96px;
      aspect-ratio: 3 / 5;
      justify-self: center;
      appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      border-radius: 20px;
      overflow: hidden;
      cursor: grab;
      transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
    }

    .hand-card:hover {
      transform: translateY(-4px);
    }

    .hand-card.selected {
      box-shadow: 0 0 0 4px rgba(96, 180, 255, 0.88);
    }

    .hand-card:disabled {
      cursor: default;
      opacity: 0.52;
      transform: none;
    }

    .hand-card img {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 18px;
      object-fit: cover;
      object-position: center;
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

    @keyframes waitingPulse {
      0%,
      100% {
        opacity: 0.3;
        transform: translateY(0);
      }

      50% {
        opacity: 1;
        transform: translateY(-3px);
      }
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

      .hand-cards {
        grid-template-columns: repeat(auto-fit, minmax(78px, 1fr));
      }

      .floating-hand-overlay-shell {
        width: 100%;
        margin-top: 0;
        transform: none;
        position: static;
        padding: 0;
      }

      .panel-toggle-button {
        left: auto;
        right: 12px;
        top: 12px;
        transform: none;
        padding: 9px 13px;
      }

      .hand-overlay {
        width: 100%;
      }

      .hand-overlay .clue-copy,
      .hand-overlay .drop-zone,
      .hand-overlay .waiting-zone {
        grid-column: 1;
        grid-row: auto;
      }

      .drop-zone,
      .waiting-zone {
        width: 100%;
        height: auto;
      }

      .action-panel-stage {
        display: none;
      }
    }
  `,
})
export class DixitHandPhase implements AfterViewChecked, OnChanges {
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
  @Input() players: DixitPlayerRow[] = [];
  @Input() boardTokens: TrackBoardToken[] = [];
  @Input() boardImageUrl = '';
  @Input() handLimitModifier: DixitHandLimitModifier | null = null;
  @Input() specialCells: readonly TrackBoardSpecialCell[] = [];
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
  @Output() readonly chatDraftChanged = new EventEmitter<string>();
  @Output() readonly chatSubmitRequested = new EventEmitter<void>();
  @ViewChild('chatList') private chatList?: ElementRef<HTMLElement>;

  draggedHandCardCode = '';
  isDropZoneActive = false;
  isActionPanelOpen = false;
  private lastScrolledChatKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    const clueChange = changes['currentClue'];
    const storytellerChange = changes['isCurrentPlayerStoryteller'];

    const clueJustOpened =
      clueChange &&
      typeof clueChange.currentValue === 'string' &&
      clueChange.currentValue.trim().length > 0 &&
      (
        clueChange.firstChange ||
        (typeof clueChange.previousValue === 'string' &&
          clueChange.previousValue.trim().length === 0)
      );

    const storytellerNeedsCluePanel =
      this.isCurrentPlayerStoryteller &&
      !this.currentClue.trim() &&
      (!!storytellerChange || !!clueChange);

    if (clueJustOpened || storytellerNeedsCluePanel) {
      this.isActionPanelOpen = true;
    }
  }

  get selectedCard(): DeckCard | undefined {
    return this.cards.find((card) => card.code === this.selectedCardCode);
  }

  toggleActionPanel(): void {
    this.isActionPanelOpen = !this.isActionPanelOpen;
  }

  get submittedCardLabel(): string {
    const selectedCard = this.selectedCard;
    if (selectedCard) {
      return `${selectedCard.value} (${selectedCard.code})`;
    }

    return this.selectedCardCode;
  }

  get handLimitModifierTooltip(): string {
    const modifier = this.handLimitModifier;
    if (!modifier) {
      return '';
    }

    const turnsLabel = modifier.turnsLeft === 1 ? '1 turno restante' : `${modifier.turnsLeft} turnos restantes`;
    return `${this.resolveHandLimitModifierMeaning(modifier.value)} ${turnsLabel}.`;
  }

  formatModifierValue(value: number): string {
    const absoluteValue = Math.abs(value);
    const cardsLabel = absoluteValue === 1 ? '1 carta' : `${absoluteValue} cartas`;
    const signedValue = value > 0 ? `+${absoluteValue}` : value < 0 ? `-${absoluteValue}` : '0';
    return `${signedValue} (${cardsLabel})`;
  }

  private resolveHandLimitModifierMeaning(value: number): string {
    const absoluteValue = Math.abs(value);
    const cardsLabel = absoluteValue === 1 ? '1 carta' : `${absoluteValue} cartas`;

    if (value > 0) {
      return `Bonus de mano: puedes tener ${cardsLabel} mas de lo normal.`;
    }

    if (value < 0) {
      return `Penalizacion de mano: puedes tener ${cardsLabel} menos de lo normal.`;
    }

    return 'Modificador de mano sin cambio de cartas.';
  }

  ngAfterViewChecked(): void {
    const nextChatKey = this.buildChatScrollKey();
    if (nextChatKey === this.lastScrolledChatKey) {
      return;
    }

    this.lastScrolledChatKey = nextChatKey;
    this.scrollChatToBottom();
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

  onChatComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.code !== 'Enter' && event.code !== 'NumpadEnter') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (!this.chat.canSend) {
      return;
    }

    this.chatSubmitRequested.emit();
  }

  onHandCardDragStart(card: DeckCard, event?: DragEvent): void {
    if (this.handSubmitted) {
      event?.preventDefault();
      return;
    }

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

  private buildChatScrollKey(): string {
    const lastMessage = this.chat.messages.at(-1);
    if (!lastMessage) {
      return 'empty';
    }

    return [
      this.chat.messages.length,
      lastMessage.timestamp,
      lastMessage.username,
      lastMessage.text,
    ].join('|');
  }

  private scrollChatToBottom(): void {
    const chatList = this.chatList?.nativeElement;
    if (!chatList) {
      return;
    }

    chatList.scrollTop = chatList.scrollHeight;
  }
}
