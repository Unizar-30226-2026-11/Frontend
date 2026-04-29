import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DeckCard } from '../../services/card-pull';

@Component({
  selector: 'app-dixit-choice-phase',
  standalone: true,
  template: `
    <section class="phase-stage-screen choice-stage-screen">
      <div class="phase-stage-header">
        <div class="phase-stage-copy">
          <p class="overlay-label">Votacion</p>
          <h2>{{ currentClue || 'Esperando pista' }}</h2>
          <p>
            @if (!canVote) {
              Eres el cuenta-cuentos. Espera a que el resto de jugadores vote.
            } @else if (voteSubmitted) {
              Tu voto ya esta registrado. Esperando a que el resto de jugadores termine.
            } @else if (selectedCard) {
              Has elegido {{ selectedCard.code }}. Puedes cambiarla antes de confirmar.
            } @else {
              Elige una carta para votar y confirma tu decision. Tu propia carta no se puede votar.
            }
          </p>
        </div>

        @if (voteSubmitted) {
          <span class="status-pill">Voto confirmado</span>
        }
      </div>

      @if (voteSubmitted) {
        <div class="vote-waiting-state">
          <strong>Esperando votos</strong>
          <p>
            @if (selectedCard) {
              Tu voto actual es {{ selectedCard.code }}.
            } @else {
              Tu voto ya fue enviado al servidor.
            }
          </p>
          <p>La ronda continuara automaticamente cuando el backend resuelva la votacion.</p>
        </div>
      } @else {
        <div class="choice-stage-grid">
          @for (card of cards; track card.code) {
            <button
              type="button"
              class="vote-card stage-vote-card"
              [class.selected]="card.code === selectedCardCode"
              [class.locked]="voteSubmitted"
              [class.own-card]="card.code === disabledCardCode"
              [disabled]="isCardDisabled(card)"
              (click)="cardSelected.emit(card)"
            >
              <img
                draggable="false"
                [src]="card.image"
                [alt]="card.value + ' de ' + card.suit"
              />
              @if (card.code === disabledCardCode) {
                <div class="vote-card-copy own-only">
                  <span class="vote-card-badge own">Tu carta</span>
                </div>
              }
            </button>
          }
        </div>

        <div class="phase-stage-footer">
          <p>
            @if (!canVote) {
              El cuenta-cuentos no participa en la votacion.
            } @else if (selectedCard) {
              Tu voto actual es {{ selectedCard.code }}.
            } @else {
              Selecciona una de las cartas para continuar.
            }
          </p>

          <button
            type="button"
            class="sidebar-action"
            [disabled]="!selectedCardCode || voteSubmitted || !canVote || selectedCardCode === disabledCardCode"
            (click)="voteSubmitRequested.emit()"
          >
            Confirmar voto
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
    }

    .overlay-label {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
      color: rgba(250, 233, 191, 0.84);
    }

    h2 {
      margin: 0;
      font-family: "FuenteDilana", sans-serif;
      font-size: clamp(1.7rem, 2.8vw, 2.5rem);
      line-height: 1.05;
      color: #fff6d7;
    }

    .phase-stage-screen {
      width: 100%;
      max-height: none;
      margin-inline: 0;
      padding: 16px 20px 18px;
      border-radius: 28px;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      gap: 12px;
      background:
        radial-gradient(circle at top left, rgba(255, 226, 158, 0.16), transparent 28%),
        linear-gradient(145deg, rgba(8, 20, 29, 0.76), rgba(14, 42, 68, 0.84));
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      box-shadow: 0 18px 38px rgba(0, 0, 0, 0.18);
      overflow: hidden;
      box-sizing: border-box;
    }

    .phase-stage-header,
    .phase-stage-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .phase-stage-footer {
      align-items: center;
    }

    .phase-stage-copy {
      display: grid;
      gap: 6px;
      max-width: 48rem;
    }

    .phase-stage-copy p,
    .phase-stage-footer p {
      margin: 0;
      color: rgba(244, 239, 228, 0.88);
      line-height: 1.52;
    }

    .choice-stage-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
      justify-content: stretch;
      align-items: start;
      gap: 14px 20px;
      align-content: center;
      min-height: 0;
      overflow-y: auto;
      width: 100%;
      max-width: 920px;
      margin-inline: auto;
      padding: 10px 22px 12px;
      box-sizing: border-box;
    }

    .vote-waiting-state {
      padding: 22px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: grid;
      gap: 10px;
      align-content: center;
      min-height: 0;
      width: 100%;
    }

    .vote-waiting-state strong {
      color: #fff4d8;
      font-size: 1.05rem;
    }

    .vote-waiting-state p {
      margin: 0;
      color: rgba(244, 239, 228, 0.88);
      line-height: 1.5;
    }

    .vote-card {
      appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      border-radius: 18px;
      cursor: pointer;
      transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
    }

    .vote-card:hover {
      transform: translateY(-3px);
    }

    .vote-card:disabled {
      cursor: not-allowed;
      transform: none;
    }

    .vote-card.selected {
      box-shadow: 0 0 0 4px rgba(255, 196, 63, 0.88);
    }

    .vote-card img {
      width: 100%;
      aspect-ratio: 3 / 5;
      display: block;
      border-radius: 16px;
      object-fit: cover;
    }

    .stage-vote-card {
      margin-top: 4px;
      display: block;
      width: 100%;
      max-width: 100%;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 16px 30px rgba(0, 0, 0, 0.22);
      justify-self: stretch;
    }

    .stage-vote-card.locked {
      opacity: 0.96;
    }

    .stage-vote-card.own-card {
      opacity: 0.58;
      box-shadow: 0 0 0 2px rgba(255, 116, 95, 0.45);
    }

    .vote-card-copy {
      display: grid;
      gap: 4px;
      padding: 8px 8px 10px;
      background: rgba(6, 17, 25, 0.88);
      text-align: left;
      min-height: 46px;
      align-content: center;
    }

    .vote-card-copy.own-only {
      justify-items: start;
    }

    .vote-card-badge {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .vote-card-badge.own {
      background: rgba(255, 116, 95, 0.18);
      color: #ffd9d2;
      border: 1px solid rgba(255, 116, 95, 0.24);
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(18, 121, 82, 0.14);
      color: #d4ffe8;
      font-weight: 700;
      border: 1px solid rgba(96, 232, 168, 0.2);
    }

    .sidebar-action {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
      background: linear-gradient(135deg, #f5d272, #ffefbc);
      color: #18212d;
    }

    .sidebar-action:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    @media (max-width: 900px) {
      :host {
        height: auto;
      }

      .phase-stage-screen {
        width: 100%;
        height: auto;
        grid-template-rows: auto auto auto;
      }

      .choice-stage-grid {
        grid-template-columns: none;
        grid-auto-flow: column;
        grid-auto-columns: minmax(132px, 152px);
        justify-content: start;
        align-content: start;
        overflow-x: auto;
        overflow-y: hidden;
        width: 100%;
        max-width: 100%;
        padding: 6px 4px 10px;
        margin-inline: 0;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
      }

      .stage-vote-card {
        min-width: 0;
      }
    }
  `,
})
export class DixitChoicePhase {
  @Input() currentClue = '';
  @Input() cards: DeckCard[] = [];
  @Input() selectedCardCode = '';
  @Input() disabledCardCode = '';
  @Input() canVote = true;
  @Input() voteSubmitted = false;

  @Output() readonly cardSelected = new EventEmitter<DeckCard>();
  @Output() readonly voteSubmitRequested = new EventEmitter<void>();

  get selectedCard(): DeckCard | undefined {
    return this.cards.find((card) => card.code === this.selectedCardCode);
  }

  isCardDisabled(card: DeckCard): boolean {
    return !this.canVote || this.voteSubmitted || card.code === this.disabledCardCode;
  }
}
