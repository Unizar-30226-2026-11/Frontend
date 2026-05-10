import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DeckCard } from '../../services/card-pull';
import {
  DixitTrackBoard,
  TrackBoardSpecialCell,
  TrackBoardToken,
} from '../components/track-board';

export interface DixitRevealedCard {
  card: DeckCard;
  ownerName: string;
  votes: number;
  isStorytellerCard: boolean;
}

export interface DixitRankingRow {
  playerId: string;
  playerName: string;
  pointsBefore: number;
  pointsEarned: number;
  totalPoints: number;
}

@Component({
  selector: 'app-dixit-points-phase',
  standalone: true,
  imports: [DixitTrackBoard],
  template: `
    <section class="points-phase">
      <app-dixit-track-board
        [title]="'Marcador de la mesa'"
        [subtitle]="'Preparado para recibir posiciones y eventos reales del backend.'"
        [tokens]="boardTokens"
        [boardImageUrl]="boardImageUrl"
        [specialCells]="specialCells"
        [showControls]="false"
        [interactive]="false"
      />

      @if (waitingVotes) {
        <div class="waiting-block stage-panel">
          <h3>Esperando votos...</h3>
          <p>{{ votesReceived }} / {{ votesTotal }} jugadores han votado</p>
          <progress [value]="votesReceived" [max]="votesTotal || 1"></progress>
        </div>
      } @else if (!showRanking) {
        <div class="reveal-block stage-panel">
          <h3>Cartas reveladas</h3>
          <div class="reveal-grid">
            @for (result of revealedCards; track result.card.code; let cardIndex = $index) {
              <article
                class="reveal-card"
                [class.storyteller-card]="result.isStorytellerCard"
                [style.--reveal-index]="cardIndex"
              >
                <div class="reveal-card-media">
                  <img
                    draggable="false"
                    [src]="result.card.image"
                    [alt]="result.card.value + ' de ' + result.card.suit"
                  />
                  @if (result.isStorytellerCard) {
                    <span class="storyteller-badge">Carta del cuenta-cuentos</span>
                  }
                </div>
                <p class="owner">{{ result.ownerName }}</p>
                <p class="votes">{{ result.votes }} voto{{ result.votes === 1 ? '' : 's' }}</p>
              </article>
            }
          </div>
        </div>
      } @else {
        <div class="ranking-block stage-panel">
          <h3>Clasificacion</h3>
          <table>
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Antes</th>
                <th>Ganados</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              @for (row of ranking; track row.playerId) {
                <tr>
                  <td>{{ row.playerName }}</td>
                  <td>{{ row.pointsBefore }}</td>
                  <td>{{ row.pointsEarned > 0 ? '+' : '' }}{{ row.pointsEarned }}</td>
                  <td>{{ row.totalPoints }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (canAdvanceToNextRound) {
            <div class="ranking-actions">
              <button type="button" (click)="nextRoundRequested.emit()">
                Preparar siguiente ronda
              </button>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      width: 100%;
    }

    .points-phase {
      width: min(1120px, 100%);
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 8px 0 20px;
    }

    .waiting-block,
    .reveal-block,
    .ranking-block {
      width: 100%;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      padding: 16px;
      box-sizing: border-box;
    }

    .stage-panel {
      animation: stage-panel-enter 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
      transform-origin: top center;
    }

    h3 {
      margin-top: 0;
      margin-bottom: 10px;
    }

    progress {
      width: min(420px, 100%);
      height: 14px;
    }

    .waiting-actions {
      margin-top: 14px;
    }

    .reveal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin-top: 10px;
      margin-bottom: 14px;
    }

    .reveal-card {
      --reveal-index: 0;
      background: rgba(0, 0, 0, 0.18);
      border: 1px solid transparent;
      border-radius: 10px;
      padding: 8px;
      text-align: center;
      opacity: 0;
      transform: translateY(14px) scale(0.98);
      animation: reveal-card-enter 360ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      animation-delay: calc(var(--reveal-index) * 70ms);
    }

    .reveal-card.storyteller-card {
      background:
        linear-gradient(rgba(255, 226, 139, 0.16), rgba(255, 226, 139, 0.08)),
        rgba(0, 0, 0, 0.22);
      border-color: rgba(255, 220, 117, 0.9);
      box-shadow: 0 0 0 2px rgba(255, 220, 117, 0.22), 0 16px 34px rgba(0, 0, 0, 0.2);
    }

    .reveal-card-media {
      position: relative;
      aspect-ratio: 3 / 4;
      width: 100%;
      overflow: hidden;
      border-radius: 10px;
      margin-bottom: 6px;
      background:
        radial-gradient(circle at top, rgba(255, 255, 255, 0.16), transparent 55%),
        rgba(6, 12, 20, 0.72);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    }

    .reveal-card img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      object-position: center;
    }

    .storyteller-badge {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      border-radius: 999px;
      padding: 6px 8px;
      background: rgba(12, 18, 26, 0.86);
      color: #ffe28b;
      font-size: 0.74rem;
      font-weight: 800;
      line-height: 1.1;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
    }

    .owner {
      margin: 0;
      font-weight: 600;
    }

    .votes {
      margin: 4px 0 0;
      opacity: 0.9;
    }

    .ranking-actions {
      margin-top: 16px;
      display: flex;
      justify-content: flex-end;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 9px 14px;
      cursor: pointer;
      font-weight: 600;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      border-bottom: 1px solid rgba(255, 255, 255, 0.18);
      padding: 10px 8px;
      text-align: left;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    @keyframes stage-panel-enter {
      from {
        opacity: 0;
        transform: translateY(18px) scale(0.985);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes reveal-card-enter {
      from {
        opacity: 0;
        transform: translateY(14px) scale(0.98);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `,
})
export class DixitPointsPhase {
  @Input() boardTokens: TrackBoardToken[] = [];
  @Input() boardImageUrl = '';
  @Input() specialCells: readonly TrackBoardSpecialCell[] = [];
  @Input() waitingVotes = false;
  @Input() votesReceived = 0;
  @Input() votesTotal = 0;
  @Input() revealedCards: DixitRevealedCard[] = [];
  @Input() ranking: DixitRankingRow[] = [];
  @Input() showRanking = false;
  @Input() canAdvanceToNextRound = false;

  @Output() readonly nextRoundRequested = new EventEmitter<void>();
}
