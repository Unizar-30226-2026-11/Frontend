import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DeckCard } from '../../services/card-pull';
import { DixitTrackBoard, TrackBoardToken } from '../components/track-board';

export interface DixitRevealedCard {
  card: DeckCard;
  ownerName: string;
  votes: number;
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
        [title]="'Tablero de puntuacion (demo)'"
        [subtitle]="'Componente reutilizable con fichas encima de las casillas y animacion.'"
        [tokens]="boardTokens"
        (tokensChanged)="onBoardTokensChanged($event)"
      />

      @if (waitingVotes) {
        <div class="waiting-block">
          <h3>Esperando votos...</h3>
          <p>{{ votesReceived }} / {{ votesTotal }} jugadores han votado</p>
          <progress [value]="votesReceived" [max]="votesTotal || 1"></progress>
          <div class="waiting-actions">
            <button type="button" (click)="skipWaitingRequested.emit()">Forzar revelado</button>
          </div>
        </div>
      } @else if (!showRanking) {
        <div class="reveal-block">
          <h3>Cartas reveladas</h3>
          <div class="reveal-grid">
            @for (result of revealedCards; track result.card.code) {
              <article class="reveal-card">
                <img
                  draggable="false"
                  [src]="result.card.image"
                  [alt]="result.card.value + ' de ' + result.card.suit"
                />
                <p class="owner">{{ result.ownerName }}</p>
                <p class="votes">{{ result.votes }} voto{{ result.votes === 1 ? '' : 's' }}</p>
              </article>
            }
          </div>
          <button type="button" (click)="rankingRequested.emit()">Ver clasificacion</button>
        </div>
      } @else {
        <div class="ranking-block">
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
                  <td>+{{ row.pointsEarned }}</td>
                  <td>{{ row.totalPoints }}</td>
                </tr>
              }
            </tbody>
          </table>
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
      background: rgba(0, 0, 0, 0.18);
      border-radius: 10px;
      padding: 8px;
      text-align: center;
    }

    .reveal-card img {
      width: 100%;
      display: block;
      border-radius: 10px;
      margin-bottom: 6px;
    }

    .owner {
      margin: 0;
      font-weight: 600;
    }

    .votes {
      margin: 4px 0 0;
      opacity: 0.9;
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
  `,
})
export class DixitPointsPhase {
  boardTokens: TrackBoardToken[] = [
    { id: 'you', name: 'Tu', color: '#ff7725', position: 0 },
    { id: 'ana', name: 'Ana', color: '#27c93f', position: 4 },
    { id: 'bruno', name: 'Bruno', color: '#2b79ff', position: 8 },
    { id: 'carla', name: 'Carla', color: '#d645ff', position: 12 },
    { id: 'diego', name: 'Diego', color: '#ff3a3a', position: 16 },
    { id: 'elena', name: 'Elena', color: '#ffe34f', position: 20 },
  ];

  @Input() waitingVotes = false;
  @Input() votesReceived = 0;
  @Input() votesTotal = 0;
  @Input() revealedCards: DixitRevealedCard[] = [];
  @Input() ranking: DixitRankingRow[] = [];
  @Input() showRanking = false;

  @Output() readonly skipWaitingRequested = new EventEmitter<void>();
  @Output() readonly rankingRequested = new EventEmitter<void>();

  onBoardTokensChanged(tokens: TrackBoardToken[]): void {
    this.boardTokens = tokens;
  }
}
