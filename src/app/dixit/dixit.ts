import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CardPull } from '../services/card-pull';
import type { DeckCard } from '../services/card-pull';
import { DixitTrackBoard } from './components/track-board';
import type { TrackBoardToken } from './components/track-board';
import type { DixitRankingRow, DixitRevealedCard } from './phases/points-phase';

type DixitPhase = 'hand' | 'choice' | 'points';
type PointsStage = 'waiting' | 'reveal' | 'ranking';

interface PhaseStep {
  id: DixitPhase;
  title: string;
  description: string;
}

interface RosterPlayer {
  id: string;
  name: string;
  color: string;
}

interface RoundPlayer extends RosterPlayer {
  pointsBefore: number;
}

interface PlayerPanelRow extends RosterPlayer {
  points: number;
  isCurrentPlayer: boolean;
}

interface WildcardReward {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
}

interface BoardEffectPopup {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const PHASE_STEPS: readonly PhaseStep[] = [
  {
    id: 'hand',
    title: 'Elegir carta',
    description: 'Arrastra una carta desde tu mano hasta el tablero para dejarla preparada.',
  },
  {
    id: 'choice',
    title: 'Votacion',
    description: 'Con la pista visible, escoge la carta que quieres votar y confirma tu seleccion.',
  },
  {
    id: 'points',
    title: 'Puntuacion',
    description: 'Simula los eventos de votos, revelado y ranking mientras el tablero sigue visible.',
  },
];

const ROUND_CLUES = [
  'Una mirada perdida.',
  'El eco de un bosque dormido.',
  'Nadie vio venir la tormenta.',
  'La ultima luz antes del silencio.',
] as const;

const WILDCARD_CELL_POSITIONS = [3, 8, 11, 15, 19, 23, 27, 31, 35, 39, 41, 42] as const;
const EVENT_BACK_CELL_POSITIONS = [6, 14, 22, 30, 38] as const;
const EVENT_FORWARD_CELL_POSITIONS = [10, 18, 26, 34, 40] as const;

const WILDCARD_REWARDS: readonly Omit<WildcardReward, 'id'>[] = [
  {
    name: 'Suma 1 punto',
    description: 'Al usarlo durante la fase de mano avanzas 1 casilla.',
    icon: '+1',
    points: 1,
  },
  {
    name: 'Suma 2 puntos',
    description: 'Al usarlo durante la fase de mano avanzas 2 casillas.',
    icon: '+2',
    points: 2,
  },
] as const;

@Component({
  selector: 'app-dixit',
  standalone: true,
  imports: [DixitTrackBoard],
  template: `
    <section class="dixit-table">
      <header class="dixit-header">
        <div class="header-copy">
          <p class="eyebrow">Sala {{ id || 'demo' }}</p>
          <h1>Dixit</h1>
          <p class="phase-summary">{{ currentPhaseMeta.description }}</p>
        </div>

        <div class="phase-switch" aria-label="Fases de la ronda">
          @for (phaseStep of phaseSteps; track phaseStep.id) {
            <div
              class="phase-step"
              [class.active]="phase === phaseStep.id"
              [class.completed]="isPhaseCompleted(phaseStep.id)"
            >
              <span class="phase-index">
                <span>{{ phaseOrderIndex(phaseStep.id) + 1 }}</span>
              </span>
              <div>
                <strong>{{ phaseStep.title }}</strong>
                <span>{{ phaseStep.description }}</span>
              </div>
            </div>
          }
        </div>
      </header>

      @if (loading) {
        <article class="status-card">
          <p>Cargando cartas...</p>
        </article>
      } @else if (errorMessage) {
        <article class="status-card error">
          <p>{{ errorMessage }}</p>
        </article>
      } @else if (cards.length === 0) {
        <article class="status-card">
          <p>No se recibieron cartas para la demo.</p>
        </article>
      } @else {
        <div class="table-layout">
          <div class="table-main">
            <app-dixit-track-board
              [title]="'Mesa de juego'"
              [subtitle]="boardSubtitle"
              [tokens]="boardTokens"
              [wildcardCells]="wildcardCellPositions"
              [eventBackCells]="eventBackCellPositions"
              [eventForwardCells]="eventForwardCellPositions"
              [showControls]="false"
              [interactive]="false"
            >
              <div board-overlay class="board-overlay-content">
                <section class="board-overlay-shell" [attr.data-phase]="phase">
                  @if (phase === 'hand') {
                    <div class="story-card hand-overlay">
                      <div class="clue-copy">
                        <span class="overlay-label">Pista actual</span>
                        <h2>{{ currentClue }}</h2>
                        <p>
                          El tablero queda siempre visible y la seleccion de carta ocurre dentro
                          de la mesa.
                        </p>
                      </div>

                      <div
                        class="drop-zone"
                        [class.has-card]="!!selectedHandCard"
                        [class.is-dragover]="isDropZoneActive"
                        (dragover)="onDropZoneDragOver($event)"
                        (dragleave)="onDropZoneDragLeave()"
                        (drop)="onDropZoneDrop($event)"
                      >
                        @if (selectedHandCard; as selectedCard) {
                          <img
                            draggable="false"
                            [src]="selectedCard.image"
                            [alt]="selectedCard.value + ' de ' + selectedCard.suit"
                          />
                          <p>Seleccionada: {{ selectedCard.code }}</p>
                        } @else {
                          <p>Arrastrar una carta aqui para seleccionarla</p>
                        }
                      </div>
                    </div>
                  } @else if (phase === 'choice') {
                    <div class="story-card vote-overlay">
                      <div class="vote-copy">
                        <span class="overlay-label">Pista de la ronda</span>
                        <h2>{{ currentClue }}</h2>
                        <p>
                          Simula el momento en el que el backend ya ha enviado la mesa final para
                          votar. El tablero sigue debajo y la capa superior tiene opacidad.
                        </p>
                      </div>

                      <div class="vote-grid">
                        @for (card of choiceCards; track card.code) {
                          <button
                            type="button"
                            class="vote-card"
                            [class.selected]="card.code === selectedChoiceCardCode"
                            (click)="onChoiceCardSelected(card)"
                          >
                            <img
                              draggable="false"
                              [src]="card.image"
                              [alt]="card.value + ' de ' + card.suit"
                            />
                          </button>
                        }
                      </div>

                      <div class="vote-status">
                        @if (selectedChoiceCard) {
                          <p>Tu seleccion actual: {{ selectedChoiceCard.code }}</p>
                        } @else {
                          <p>Selecciona una carta para dejar listo tu voto.</p>
                        }

                        @if (voteSubmitted) {
                          <span class="status-pill">Voto local confirmado</span>
                        }
                      </div>
                    </div>
                  } @else {
                    <div class="story-card points-overlay">
                      <div class="points-copy">
                        <span class="overlay-label">Resolucion de ronda</span>
                        <h2>{{ currentClue }}</h2>
                      </div>

                      @if (pointsStage === 'waiting') {
                        <div class="points-panel">
                          <h3>Esperando votos</h3>
                          <p>{{ pointsVotesReceived }} / {{ pointsVotesTotal }} jugadores han votado</p>
                          <progress [value]="pointsVotesReceived" [max]="pointsVotesTotal || 1"></progress>
                          <p class="panel-footnote">
                            Usa los botones de simulacion para imitar los mensajes de websocket.
                          </p>
                        </div>
                      } @else if (pointsStage === 'reveal') {
                        <div class="points-panel">
                          <h3>Cartas reveladas</h3>
                          <div class="reveal-grid">
                            @for (result of pointsRevealedCards; track result.card.code) {
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
                        </div>
                      } @else {
                        <div class="points-panel ranking-panel">
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
                              @for (row of pointsRanking; track row.playerId) {
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
                    </div>
                  }
                </section>
              </div>
            </app-dixit-track-board>

            @if (phase === 'hand') {
              <div class="hand-support-grid">
                <section class="hand-ribbon">
                  <div class="hand-header">
                    <div>
                      <p class="overlay-label">Tu mano</p>
                      <h3>Arrastra o pulsa una carta</h3>
                    </div>

                    @if (selectedHandCard) {
                      <button type="button" class="secondary-action" (click)="clearHandSelection()">
                        Quitar seleccion
                      </button>
                    }
                  </div>

                  <div class="hand-cards">
                    @for (card of cards; track card.code) {
                      <button
                        type="button"
                        class="hand-card"
                        [class.selected]="card.code === selectedHandCardCode"
                        draggable="true"
                        (dragstart)="onHandCardDragStart(card, $event)"
                        (dragend)="onHandCardDragEnd()"
                        (click)="onHandCardSelected(card)"
                      >
                        <img
                          draggable="false"
                          [src]="card.image"
                          [alt]="card.value + ' de ' + card.suit"
                        />
                      </button>
                    }
                  </div>
                </section>

                <section class="wildcards-ribbon">
                  <div class="hand-header">
                    <div>
                      <p class="overlay-label">Comodines</p>
                      <h3>Tu reserva</h3>
                    </div>
                  </div>

                  @if (wildcards.length === 0) {
                    <p class="wildcards-empty">
                      Cae en una casilla especial del tablero para conseguir tu primer comodin.
                    </p>
                  } @else {
                    <div class="wildcards-list">
                      @for (wildcard of wildcards; track wildcard.id) {
                        <button
                          type="button"
                          class="wildcard-card"
                          [disabled]="phase !== 'hand'"
                          (click)="useWildcard(wildcard.id)"
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
                </section>
              </div>
            }
          </div>

          <aside class="table-sidebar">
            <article class="sidebar-card">
              <p class="overlay-label">Eventos simulados</p>
              <h3>Websocket</h3>

              @if (phase === 'hand') {
                <p>
                  Selecciona una carta y luego simula el evento con el que el servidor abriria la
                  fase de votacion.
                </p>
                <button
                  type="button"
                  class="sidebar-action"
                  [disabled]="!selectedHandCardCode"
                  (click)="simulateChoicePhaseOpened()"
                >
                  Simular WS: abrir votacion
                </button>
              } @else if (phase === 'choice') {
                <p>
                  Primero confirmas tu voto localmente. Despues simulas el evento del servidor que
                  cierra la votacion y abre la resolucion.
                </p>
                <button
                  type="button"
                  class="sidebar-action"
                  [disabled]="!selectedChoiceCardCode || voteSubmitted"
                  (click)="submitVoteSelection()"
                >
                  Confirmar voto local
                </button>
                <button
                  type="button"
                  class="sidebar-action"
                  [disabled]="!voteSubmitted"
                  (click)="simulatePointsPhaseOpened()"
                >
                  Simular WS: abrir puntuacion
                </button>
              } @else if (pointsStage === 'waiting') {
                <p>
                  En esta demo los votos ya no avanzan solos: los controlas con estos botones para
                  replicar mensajes entrantes.
                </p>
                <button
                  type="button"
                  class="sidebar-action"
                  [disabled]="pointsVotesReceived >= pointsVotesTotal"
                  (click)="simulateVoteReceived()"
                >
                  Simular WS: voto recibido
                </button>
                <button
                  type="button"
                  class="sidebar-action"
                  [disabled]="pointsVotesTotal === 0 || pointsVotesReceived >= pointsVotesTotal"
                  (click)="simulateAllVotesReceived()"
                >
                  Simular WS: todos votaron
                </button>
                <button
                  type="button"
                  class="sidebar-action"
                  [disabled]="pointsVotesReceived < pointsVotesTotal"
                  (click)="simulateResultsReveal()"
                >
                  Simular WS: revelar cartas
                </button>
              } @else if (pointsStage === 'reveal') {
                <p>La mesa ya conoce el resultado de la ronda. Solo falta publicar el ranking.</p>
                <button
                  type="button"
                  class="sidebar-action"
                  (click)="simulateRankingShown()"
                >
                  Simular WS: mostrar ranking
                </button>
              } @else {
                <p>
                  Con el ranking visible ya puedes emular el snapshot de una ronda nueva para
                  volver al arrastre inicial.
                </p>
                <button
                  type="button"
                  class="sidebar-action"
                  (click)="prepareNextRound()"
                >
                  Simular WS: siguiente ronda
                </button>
              }
            </article>

            <article class="sidebar-card">
              <p class="overlay-label">Jugadores</p>
              <h3>Mesa actual</h3>

              <div class="players-list">
                @for (player of playerRows; track player.id) {
                  <div class="player-row" [class.self]="player.isCurrentPlayer">
                    <span class="player-dot" [style.background]="player.color"></span>
                    <span class="player-name">{{ player.name }}</span>
                    <span class="player-score">{{ player.points }}</span>
                  </div>
                }
              </div>
            </article>
          </aside>
        </div>
      }
    </section>

    @if (activeEffectPopup; as popup) {
      <div class="wildcard-popup-backdrop" (click)="closeEffectPopup()">
        <article
          class="wildcard-popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="effect-popup-title"
          (click)="$event.stopPropagation()"
        >
          <p class="overlay-label">Casilla especial</p>
          <h2 id="effect-popup-title">{{ popup.title }}</h2>
          <div class="wildcard-popup-card">
            <span class="wildcard-icon large" aria-hidden="true">{{ popup.icon }}</span>
            <div class="wildcard-copy">
              <strong>{{ popup.title }}</strong>
              <p>{{ popup.description }}</p>
            </div>
          </div>
          <button type="button" class="sidebar-action" (click)="closeEffectPopup()">
            Continuar
          </button>
        </article>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      min-height: 100svh;
      color: #f4efe4;
      background:
        radial-gradient(circle at top left, rgba(248, 216, 137, 0.12), transparent 22%),
        radial-gradient(circle at bottom right, rgba(69, 125, 209, 0.18), transparent 28%),
        linear-gradient(140deg, #08232d 0%, #0b3542 48%, #12305f 100%);
    }

    .dixit-table {
      min-height: 100svh;
      padding: 24px 20px 32px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .dixit-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
    }

    .header-copy {
      max-width: 560px;
    }

    .eyebrow,
    .overlay-label {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
      color: rgba(250, 233, 191, 0.84);
    }

    h1,
    h2,
    h3 {
      margin: 0;
      color: #fff6d7;
    }

    .phase-summary {
      margin: 10px 0 0;
      color: rgba(244, 239, 228, 0.84);
      max-width: 56ch;
      line-height: 1.55;
    }

    .phase-switch {
      display: grid;
      grid-template-columns: repeat(3, minmax(180px, 1fr));
      gap: 10px;
      width: min(720px, 100%);
    }

    .phase-step {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: flex-start;
      padding: 14px 16px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: rgba(244, 239, 228, 0.7);
      backdrop-filter: blur(8px);
    }

    .phase-step strong,
    .phase-step span {
      display: block;
    }

    .phase-step strong {
      margin-bottom: 4px;
      color: inherit;
    }

    .phase-step.active {
      background: rgba(255, 238, 194, 0.18);
      border-color: rgba(255, 214, 117, 0.48);
      color: #fff7df;
    }

    .phase-step.completed {
      border-color: rgba(144, 227, 184, 0.42);
      color: rgba(228, 255, 240, 0.8);
    }

    .phase-index {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: rgba(7, 15, 22, 0.44);
      font-weight: 700;
      line-height: 1;
      text-align: center;
      padding: 0;
      box-sizing: border-box;
    }

    .phase-index > span {
      display: block;
      transform: translateY(8px);
    }

    .status-card {
      padding: 22px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
    }

    .status-card.error {
      color: #ffd6d6;
      border-color: rgba(255, 136, 136, 0.32);
    }

    .table-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.9fr) minmax(280px, 360px);
      gap: 18px;
      align-items: start;
    }

    .table-main {
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-width: 0;
    }

    .board-overlay-content {
      pointer-events: auto;
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .board-overlay-shell {
      width: min(840px, 100%);
      display: flex;
      justify-content: center;
    }

    .story-card {
      width: 100%;
      border-radius: 28px;
      box-sizing: border-box;
      display: grid;
      gap: 18px;
    }

    .hand-overlay {
      grid-template-columns: minmax(0, 1.35fr) minmax(220px, 280px);
      align-items: stretch;
      padding: 26px 28px;
      background: rgba(247, 245, 239, 0.9);
      color: #1e2631;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.18);
    }

    .hand-overlay h2,
    .vote-overlay h2,
    .points-overlay h2,
    .hand-ribbon h3,
    .sidebar-card h3,
    .points-panel h3 {
      font-family: "FuenteDilana", sans-serif;
      font-size: clamp(1.55rem, 2.6vw, 2.35rem);
      line-height: 1.05;
    }

    .hand-overlay h2,
    .vote-overlay h2,
    .points-overlay h2,
    .points-panel h3 {
      color: #1d2430;
    }

    .hand-overlay .overlay-label,
    .vote-overlay .overlay-label,
    .points-overlay .overlay-label {
      color: rgba(72, 82, 94, 0.78);
    }

    .clue-copy,
    .vote-copy,
    .points-copy {
      display: grid;
      gap: 12px;
    }

    .clue-copy p,
    .vote-copy p,
    .sidebar-card p,
    .panel-footnote {
      margin: 0;
      line-height: 1.52;
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
      transition:
        border-color 160ms ease,
        background 160ms ease,
        transform 160ms ease;
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

    .vote-overlay,
    .points-overlay {
      padding: 24px;
      background: rgba(248, 246, 240, 0.74);
      border: 1px solid rgba(255, 255, 255, 0.56);
      backdrop-filter: blur(10px);
      color: #1d2430;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.2);
    }

    .vote-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 14px;
    }

    .vote-card {
      appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      border-radius: 18px;
      cursor: pointer;
      transition:
        transform 160ms ease,
        box-shadow 160ms ease;
    }

    .vote-card:hover {
      transform: translateY(-3px);
    }

    .vote-card.selected {
      box-shadow: 0 0 0 4px rgba(255, 196, 63, 0.88);
    }

    .vote-card img,
    .reveal-card img,
    .hand-card img {
      width: 100%;
      display: block;
      border-radius: 18px;
    }

    .vote-status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .vote-status p {
      margin: 0;
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

    .points-panel {
      background: rgba(255, 255, 255, 0.56);
      border-radius: 20px;
      padding: 18px;
      display: grid;
      gap: 14px;
    }

    progress {
      width: 100%;
      height: 14px;
    }

    .reveal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 12px;
    }

    .reveal-card {
      background: rgba(17, 24, 39, 0.07);
      border-radius: 18px;
      padding: 10px;
      text-align: center;
    }

    .owner,
    .votes {
      margin: 0;
    }

    .owner {
      font-weight: 700;
      margin-top: 8px;
    }

    .votes {
      margin-top: 4px;
      color: rgba(29, 36, 48, 0.74);
    }

    .ranking-panel table {
      width: 100%;
      border-collapse: collapse;
      color: #1d2430;
    }

    .ranking-panel th,
    .ranking-panel td {
      padding: 10px 8px;
      text-align: left;
      border-bottom: 1px solid rgba(29, 36, 48, 0.12);
    }

    .ranking-panel tbody tr:last-child td {
      border-bottom: 0;
    }

    .hand-ribbon,
    .wildcards-ribbon,
    .sidebar-card {
      border-radius: 24px;
      background: rgba(8, 20, 29, 0.58);
      border: 1px solid rgba(255, 255, 255, 0.14);
      backdrop-filter: blur(10px);
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.16);
    }

    .hand-support-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) clamp(260px, 24vw, 320px);
      gap: 18px;
      align-items: start;
    }

    .hand-ribbon {
      padding: 18px;
      display: grid;
      gap: 18px;
    }

    .wildcards-ribbon {
      padding: 18px;
      display: grid;
      gap: 16px;
      aspect-ratio: 1;
      align-content: start;
      box-sizing: border-box;
    }

    .hand-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
    }

    .hand-cards {
      display: flex;
      gap: 14px;
      overflow-x: auto;
      padding-bottom: 6px;
    }

    .wildcards-empty {
      margin: 0;
      text-align: center;
      line-height: 1.55;
      color: rgba(244, 239, 228, 0.78);
      background: rgba(255, 255, 255, 0.06);
      border: 1px dashed rgba(255, 255, 255, 0.16);
      border-radius: 18px;
      padding: 28px 18px;
      box-sizing: border-box;
    }

    .wildcards-list {
      display: grid;
      gap: 12px;
      align-content: start;
      overflow: auto;
    }

    .wildcard-card,
    .wildcard-popup-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      border-radius: 18px;
      padding: 14px;
      background: linear-gradient(145deg, rgba(120, 69, 190, 0.28), rgba(58, 29, 112, 0.42));
      border: 1px solid rgba(208, 182, 255, 0.26);
    }

    .wildcard-card {
      width: 100%;
      text-align: left;
      cursor: pointer;
      transition: transform 140ms ease, opacity 140ms ease, box-shadow 140ms ease;
    }

    .wildcard-card:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(16, 7, 32, 0.22);
    }

    .wildcard-card:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .wildcard-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: linear-gradient(145deg, #fbe7ff, #dcb3ff);
      color: #41195f;
      font-family: "FuenteDilana", sans-serif;
      font-size: 1.2rem;
    }

    .wildcard-icon.large {
      width: 56px;
      height: 56px;
      font-size: 1.45rem;
      border-radius: 18px;
    }

    .wildcard-copy strong {
      display: block;
      color: #fff4d8;
      margin-bottom: 4px;
    }

    .wildcard-copy p {
      margin: 0;
      color: rgba(244, 239, 228, 0.84);
    }

    .hand-card {
      width: clamp(120px, 16vw, 168px);
      flex: 0 0 auto;
      appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      border-radius: 20px;
      cursor: grab;
      transition:
        transform 160ms ease,
        box-shadow 160ms ease,
        opacity 160ms ease;
    }

    .hand-card:hover {
      transform: translateY(-4px);
    }

    .hand-card.selected {
      box-shadow: 0 0 0 4px rgba(96, 180, 255, 0.88);
    }

    .hand-card:active {
      cursor: grabbing;
    }

    .table-sidebar {
      display: grid;
      gap: 18px;
      align-content: start;
    }

    .sidebar-card {
      padding: 18px;
      display: grid;
      gap: 14px;
    }

    .sidebar-action,
    .secondary-action {
      border: 0;
      border-radius: 999px;
      padding: 11px 16px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 120ms ease, opacity 120ms ease;
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
      transform: none;
    }

    .players-list {
      display: grid;
      gap: 10px;
    }

    .player-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.08);
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

    .player-score {
      font-weight: 700;
      color: #ffe7a5;
    }

    .wildcard-popup-backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(6, 10, 18, 0.58);
      backdrop-filter: blur(8px);
    }

    .wildcard-popup {
      width: min(92vw, 30rem);
      display: grid;
      gap: 16px;
      padding: 24px;
      border-radius: 28px;
      background: linear-gradient(160deg, rgba(25, 18, 56, 0.96), rgba(44, 28, 92, 0.94));
      border: 1px solid rgba(214, 184, 255, 0.3);
    }

    @media (max-width: 1160px) {
      .table-layout {
        grid-template-columns: 1fr;
      }

      .phase-switch {
        width: 100%;
      }
    }

    @media (max-width: 900px) {
      .dixit-header {
        flex-direction: column;
      }

      .phase-switch {
        grid-template-columns: 1fr;
      }

      .hand-overlay {
        grid-template-columns: 1fr;
      }

      .hand-support-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 700px) {
      .dixit-table {
        padding: 16px 12px 24px;
      }

      .vote-grid,
      .reveal-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .hand-card {
        width: 130px;
      }
    }
  `,
})
export class Dixit implements OnInit {
  readonly phaseSteps = PHASE_STEPS;
  readonly wildcardCellPositions: number[] = [...WILDCARD_CELL_POSITIONS];
  readonly eventBackCellPositions: number[] = [...EVENT_BACK_CELL_POSITIONS];
  readonly eventForwardCellPositions: number[] = [...EVENT_FORWARD_CELL_POSITIONS];

  private readonly route = inject(ActivatedRoute);
  private readonly cardPull = inject(CardPull);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly maxPlayersPerMatch = 6;
  private readonly playerRoster: readonly RosterPlayer[] = [
    { id: 'you', name: 'hackeeper', color: '#ff7725' },
    { id: 'ana', name: 'Azzal-e', color: '#27c93f' },
    { id: 'bruno', name: 'Natur4', color: '#2b79ff' },
    { id: 'carla', name: 'Eduss28', color: '#d645ff' },
    { id: 'diego', name: 'FSPPX', color: '#ff3a3a' },
  ];

  private readonly pointsByPlayer = new Map<string, number>([
    ['you', 12],
    ['ana', 14],
    ['bruno', 19],
    ['carla', 9],
    ['diego', 11],
  ]);

  private currentRoundPlayers: RoundPlayer[] = [];

  id = '';
  phase: DixitPhase = 'hand';
  pointsStage: PointsStage = 'waiting';
  roundNumber = 1;
  cards: DeckCard[] = [];
  choiceCards: DeckCard[] = [];
  boardTokens: TrackBoardToken[] = this.buildBoardTokensFromScores();
  loading = true;
  errorMessage = '';
  selectedHandCardCode = '';
  selectedChoiceCardCode = '';
  draggedHandCardCode = '';
  isDropZoneActive = false;
  voteSubmitted = false;
  currentClue: (typeof ROUND_CLUES)[number] = ROUND_CLUES[0];

  pointsVotesReceived = 0;
  pointsVotesTotal = 0;
  pointsRevealedCards: DixitRevealedCard[] = [];
  pointsRanking: DixitRankingRow[] = [];
  wildcards: WildcardReward[] = [];
  activeEffectPopup: BoardEffectPopup | null = null;
  private readonly effectPopupQueue: BoardEffectPopup[] = [];

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id')?.trim() ?? '';

    try {
      this.cards = await this.cardPull.getCards(this.maxPlayersPerMatch);
      this.choiceCards = [...this.cards];
      this.boardTokens = this.buildBoardTokensFromScores();
    } catch (error: unknown) {
      console.error('Error al cargar las cartas:', error);
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudieron cargar las cartas';
      this.cards = [];
      this.choiceCards = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get currentPhaseMeta(): PhaseStep {
    return PHASE_STEPS.find((phaseStep) => phaseStep.id === this.phase) ?? PHASE_STEPS[0];
  }

  get selectedHandCard(): DeckCard | undefined {
    return this.cards.find((card) => card.code === this.selectedHandCardCode);
  }

  get selectedChoiceCard(): DeckCard | undefined {
    return this.choiceCards.find((card) => card.code === this.selectedChoiceCardCode);
  }

  get boardSubtitle(): string {
    switch (this.phase) {
      case 'choice':
        return 'La mesa sigue visible mientras se superpone la votacion.';
      case 'points':
        return 'Usa la columna lateral para simular votos, revelado y ranking.';
      case 'hand':
      default:
        return 'Selecciona tu carta arrastrandola al area central del tablero.';
    }
  }

  get playerRows(): PlayerPanelRow[] {
    return this.playerRoster.map((player) => ({
      ...player,
      points: this.pointsByPlayer.get(player.id) ?? 0,
      isCurrentPlayer: player.id === 'you',
    }));
  }

  phaseOrderIndex(phase: DixitPhase): number {
    return PHASE_STEPS.findIndex((phaseStep) => phaseStep.id === phase);
  }

  isPhaseCompleted(phase: DixitPhase): boolean {
    return this.phaseOrderIndex(phase) < this.phaseOrderIndex(this.phase);
  }

  onHandCardSelected(card: DeckCard): void {
    this.selectedHandCardCode = card.code;
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
    if (this.phase !== 'hand') {
      return;
    }

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
    if (this.phase !== 'hand') {
      return;
    }

    event.preventDefault();
    this.isDropZoneActive = false;

    const droppedCode = event.dataTransfer?.getData('text/plain') || this.draggedHandCardCode;
    const droppedCard = this.cards.find((card) => card.code === droppedCode);
    if (!droppedCard) {
      return;
    }

    this.selectedHandCardCode = droppedCard.code;
    this.draggedHandCardCode = '';
  }

  clearHandSelection(): void {
    this.selectedHandCardCode = '';
  }

  simulateChoicePhaseOpened(): void {
    if (!this.selectedHandCardCode) {
      return;
    }

    this.phase = 'choice';
    this.selectedChoiceCardCode = '';
    this.voteSubmitted = false;
  }

  onChoiceCardSelected(card: DeckCard): void {
    if (this.phase !== 'choice') {
      return;
    }

    if (this.selectedChoiceCardCode === card.code) {
      this.selectedChoiceCardCode = '';
      this.voteSubmitted = false;
      return;
    }

    this.selectedChoiceCardCode = card.code;
    this.voteSubmitted = false;
  }

  submitVoteSelection(): void {
    if (this.phase !== 'choice' || !this.selectedChoiceCardCode) {
      return;
    }

    this.voteSubmitted = true;
  }

  simulatePointsPhaseOpened(): void {
    if (this.phase !== 'choice' || !this.voteSubmitted) {
      return;
    }

    this.phase = 'points';
    this.initializePointsPhase();
  }

  simulateVoteReceived(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'waiting') {
      return;
    }

    this.pointsVotesReceived = Math.min(this.pointsVotesReceived + 1, this.pointsVotesTotal);
  }

  simulateAllVotesReceived(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'waiting') {
      return;
    }

    this.pointsVotesReceived = this.pointsVotesTotal;
  }

  simulateResultsReveal(): void {
    if (
      this.phase !== 'points' ||
      this.pointsStage !== 'waiting' ||
      this.pointsVotesReceived < this.pointsVotesTotal
    ) {
      return;
    }

    const { revealedCards, ranking } = this.buildRevealAndRanking(this.currentRoundPlayers);
    this.pointsRevealedCards = revealedCards;
    this.pointsRanking = ranking;
    this.boardTokens = this.buildBoardTokensFromScores();
    this.pointsStage = 'reveal';
  }

  simulateRankingShown(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'reveal') {
      return;
    }

    this.pointsStage = 'ranking';
  }

  prepareNextRound(): void {
    if (this.phase !== 'points' || this.pointsStage !== 'ranking') {
      return;
    }

    this.roundNumber += 1;
    this.phase = 'hand';
    this.pointsStage = 'waiting';
    this.selectedHandCardCode = '';
    this.selectedChoiceCardCode = '';
    this.draggedHandCardCode = '';
    this.voteSubmitted = false;
    this.isDropZoneActive = false;
    this.pointsVotesReceived = 0;
    this.pointsVotesTotal = 0;
    this.pointsRevealedCards = [];
    this.pointsRanking = [];
    this.currentRoundPlayers = [];
    this.currentClue = ROUND_CLUES[(this.roundNumber - 1) % ROUND_CLUES.length];
    this.cards = this.rotateCards(this.cards);
    this.choiceCards = [...this.cards];
  }

  closeEffectPopup(): void {
    this.activeEffectPopup = this.effectPopupQueue.shift() ?? null;
  }

  useWildcard(wildcardId: string): void {
    if (this.phase !== 'hand') {
      return;
    }

    const wildcard = this.wildcards.find((entry) => entry.id === wildcardId);
    if (!wildcard) {
      return;
    }

    const currentPoints = this.pointsByPlayer.get('you') ?? 0;
    const updatedPoints = currentPoints + wildcard.points;

    this.pointsByPlayer.set('you', updatedPoints);
    this.wildcards = this.wildcards.filter((entry) => entry.id !== wildcardId);
    const resolvedPoints = this.resolveCurrentPlayerSpecialCells(currentPoints, updatedPoints);
    this.pointsByPlayer.set('you', resolvedPoints);
    this.boardTokens = this.buildBoardTokensFromScores();
  }

  private initializePointsPhase(): void {
    this.pointsStage = 'waiting';
    this.pointsRevealedCards = [];
    this.pointsRanking = [];
    this.currentRoundPlayers = this.getRoundPlayers();
    this.pointsVotesTotal = this.currentRoundPlayers.length;
    this.pointsVotesReceived = this.voteSubmitted && this.pointsVotesTotal > 0 ? 1 : 0;
  }

  private getRoundPlayers(): RoundPlayer[] {
    const totalPlayers = Math.min(this.choiceCards.length, this.playerRoster.length);

    return this.playerRoster.slice(0, totalPlayers).map((player) => ({
      ...player,
      pointsBefore: this.pointsByPlayer.get(player.id) ?? 0,
    }));
  }

  private buildRevealAndRanking(roundPlayers: RoundPlayer[]): {
    revealedCards: DixitRevealedCard[];
    ranking: DixitRankingRow[];
  } {
    const cardsInRound = this.choiceCards.slice(0, roundPlayers.length);
    if (cardsInRound.length === 0) {
      return {
        revealedCards: [],
        ranking: [],
      };
    }

    const activePlayers = roundPlayers.slice(0, cardsInRound.length);
    const voteCounts = new Map<string, number>();
    for (const card of cardsInRound) {
      voteCounts.set(card.code, 0);
    }

    for (let voterIndex = 0; voterIndex < activePlayers.length; voterIndex += 1) {
      const ownCardCode = cardsInRound[voterIndex].code;
      const targetCode = this.resolveVoteCardCode(cardsInRound, voterIndex, ownCardCode);
      if (!targetCode) {
        continue;
      }

      voteCounts.set(targetCode, (voteCounts.get(targetCode) ?? 0) + 1);
    }

    const revealedCards = cardsInRound.map((card, index) => ({
      card,
      ownerName: activePlayers[index].name,
      votes: voteCounts.get(card.code) ?? 0,
    }));

    const ranking = activePlayers
      .map((player, index) => {
        const ownerCardCode = cardsInRound[index].code;
        const pointsEarned = voteCounts.get(ownerCardCode) ?? 0;
        const totalPoints = player.pointsBefore + pointsEarned;

        return {
          playerId: player.id,
          playerName: player.name,
          pointsBefore: player.pointsBefore,
          pointsEarned,
          totalPoints,
        };
      })
      .sort((left, right) => right.totalPoints - left.totalPoints);

    for (const row of ranking) {
      this.pointsByPlayer.set(row.playerId, row.totalPoints);
    }

    this.applyCurrentPlayerSpecialCells(ranking);

    return { revealedCards, ranking };
  }

  private resolveVoteCardCode(
    cardsInRound: DeckCard[],
    voterIndex: number,
    ownCardCode: string
  ): string | null {
    if (cardsInRound.length <= 1) {
      return null;
    }

    const voter = this.playerRoster[voterIndex];
    if (
      voter?.id === 'you' &&
      this.selectedChoiceCardCode &&
      this.selectedChoiceCardCode !== ownCardCode &&
      cardsInRound.some((card) => card.code === this.selectedChoiceCardCode)
    ) {
      return this.selectedChoiceCardCode;
    }

    let targetIndex = (voterIndex + 1) % cardsInRound.length;
    if (cardsInRound[targetIndex].code === ownCardCode) {
      targetIndex = (targetIndex + 1) % cardsInRound.length;
    }

    const candidate = cardsInRound[targetIndex];
    return candidate.code === ownCardCode ? null : candidate.code;
  }

  private rotateCards(cards: DeckCard[]): DeckCard[] {
    if (cards.length <= 1) {
      return [...cards];
    }

    const [firstCard, ...rest] = cards;
    return [...rest, firstCard];
  }

  private buildBoardTokensFromScores(): TrackBoardToken[] {
    return this.playerRoster.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      position: this.pointsByPlayer.get(player.id) ?? 0,
    }));
  }

  private applyCurrentPlayerSpecialCells(ranking: DixitRankingRow[]): void {
    const currentPlayerPreviousPoints = this.boardTokens.find((token) => token.id === 'you')?.position ?? 0;
    const currentPlayerRow = ranking.find((row) => row.playerId === 'you');

    if (!currentPlayerRow) {
      return;
    }

    const resolvedPoints = this.resolveCurrentPlayerSpecialCells(
      currentPlayerPreviousPoints,
      currentPlayerRow.totalPoints
    );

    if (resolvedPoints === currentPlayerRow.totalPoints) {
      return;
    }

    this.pointsByPlayer.set('you', resolvedPoints);
    currentPlayerRow.pointsEarned = resolvedPoints - currentPlayerRow.pointsBefore;
    currentPlayerRow.totalPoints = resolvedPoints;
    ranking.sort((left, right) => right.totalPoints - left.totalPoints);
    this.boardTokens = this.buildBoardTokensFromScores();
  }

  private grantWildcardReward(): void {
    const template =
      WILDCARD_REWARDS[(this.wildcards.length + this.roundNumber - 1) % WILDCARD_REWARDS.length];
    const reward: WildcardReward = {
      id: `wildcard-${this.roundNumber}-${this.wildcards.length + 1}`,
      ...template,
    };

    this.wildcards = [...this.wildcards, reward];
    this.enqueueEffectPopup({
      id: reward.id,
      title: 'Te ha tocado un comodin',
      description: reward.description,
      icon: reward.icon,
    });
  }

  private resolveCurrentPlayerSpecialCells(previousPoints: number, nextPoints: number): number {
    if (nextPoints === previousPoints) {
      return nextPoints;
    }

    let resolvedPoints = nextPoints;
    const visitedPositions = new Set<number>();
    let safety = 0;

    while (safety < 8 && !visitedPositions.has(resolvedPoints)) {
      visitedPositions.add(resolvedPoints);
      safety += 1;

      if (this.wildcardCellPositions.includes(resolvedPoints)) {
        this.grantWildcardReward();
        break;
      }

      if (this.eventBackCellPositions.includes(resolvedPoints)) {
        resolvedPoints = Math.max(0, resolvedPoints - 1);
        this.enqueueEffectPopup({
          id: `event-back-${this.roundNumber}-${safety}`,
          title: 'Casilla de evento',
          description: 'Has caido en una casilla de evento y retrocedes 1 casilla.',
          icon: '-1',
        });
        continue;
      }

      if (this.eventForwardCellPositions.includes(resolvedPoints)) {
        resolvedPoints += 1;
        this.enqueueEffectPopup({
          id: `event-forward-${this.roundNumber}-${safety}`,
          title: 'Casilla de evento',
          description: 'Has caido en una casilla de evento y avanzas 1 casilla extra.',
          icon: '+1',
        });
        continue;
      }

      break;
    }

    return resolvedPoints;
  }

  private enqueueEffectPopup(popup: BoardEffectPopup): void {
    if (this.activeEffectPopup === null) {
      this.activeEffectPopup = popup;
      return;
    }

    this.effectPopupQueue.push(popup);
  }
}
