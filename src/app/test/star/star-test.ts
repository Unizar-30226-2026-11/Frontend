import { Component } from '@angular/core';
import {
  RealtimeStarClaim,
  RealtimeStarSpawn,
} from '../../interfaces/dixit-realtime';
import { FallingStarOverlay } from '../../dixit/components/falling-star-overlay';

interface StarTestPlayer {
  id: string;
  name: string;
  score: number;
}

@Component({
  selector: 'app-star-test',
  standalone: true,
  imports: [FallingStarOverlay],
  template: `
    <section class="star-test-page">
      <app-falling-star-overlay
        [star]="activeStar"
        [claimEnabled]="!!activeStar"
        [winnerLabel]="winnerBannerLabel"
        [winnerSequence]="claimSequence"
        (claimRequested)="simulateClaim(selectedWinnerId)"
      />

      <article class="star-test-card intro">
        <p class="eyebrow">Sandbox</p>
        <h1>Test de estrella fugaz</h1>
        <p>
          Esta pantalla simula la llegada de <code>server:game:star_spawned</code> y
          <code>server:game:star_claimed</code> sin depender del socket.
        </p>
      </article>

      <div class="star-test-grid">
        <article class="star-test-card">
          <h2>Simular spawn</h2>

          <div class="controls-grid">
            <label>
              <span>Inicio X</span>
              <input
                type="number"
                min="0"
                max="100"
                [value]="draftStartX"
                (input)="draftStartX = readNumberInput($event, draftStartX)"
              />
            </label>

            <label>
              <span>Inicio Y</span>
              <input
                type="number"
                min="0"
                max="100"
                [value]="draftStartY"
                (input)="draftStartY = readNumberInput($event, draftStartY)"
              />
            </label>

            <label>
              <span>Fin X</span>
              <input
                type="number"
                min="0"
                max="100"
                [value]="draftEndX"
                (input)="draftEndX = readNumberInput($event, draftEndX)"
              />
            </label>

            <label>
              <span>Fin Y</span>
              <input
                type="number"
                min="0"
                max="100"
                [value]="draftEndY"
                (input)="draftEndY = readNumberInput($event, draftEndY)"
              />
            </label>

            <label class="wide">
              <span>Duracion (ms)</span>
              <input
                type="number"
                min="1200"
                max="6000"
                step="100"
                [value]="draftDuration"
                (input)="draftDuration = readNumberInput($event, draftDuration)"
              />
            </label>
          </div>

          <div class="actions-row">
            <button type="button" (click)="randomizePath()">Trayectoria aleatoria</button>
            <button type="button" class="primary" (click)="simulateSpawn()">Simular star_spawned</button>
          </div>
        </article>

        <article class="star-test-card">
          <h2>Simular claim</h2>

          <label>
            <span>Ganador</span>
            <select [value]="selectedWinnerId" (change)="onWinnerChanged($event)">
              @for (player of players; track player.id) {
                <option [value]="player.id">{{ player.name }}</option>
              }
            </select>
          </label>

          <div class="actions-row">
            <button type="button" (click)="simulateClaim(selectedWinnerId)" [disabled]="!activeStar">
              Simular star_claimed
            </button>
          </div>

          <p class="footnote">
            Tambien puedes clicar la estrella en pantalla para disparar la captura con el ganador
            seleccionado.
          </p>
        </article>
      </div>

      <div class="star-test-grid">
        <article class="star-test-card">
          <h2>Payload activo</h2>
          <pre>{{ activeStar ? format(activeStar) : 'Sin estrella activa' }}</pre>
        </article>

        <article class="star-test-card">
          <h2>Ultimo claim</h2>
          <pre>{{ lastClaim ? format(lastClaim) : 'Todavia no ha llegado star_claimed' }}</pre>
        </article>
      </div>

      <article class="star-test-card">
        <h2>Puntuaciones</h2>

        <div class="scores-grid">
          @for (player of players; track player.id) {
            <div class="score-row">
              <strong>{{ player.name }}</strong>
              <span>{{ player.score }} pts</span>
            </div>
          }
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100svh;
        padding: 20px;
        box-sizing: border-box;
        color: #f7f0dc;
        background:
          radial-gradient(circle at top left, rgba(255, 225, 144, 0.16), transparent 24%),
          radial-gradient(circle at bottom right, rgba(95, 170, 255, 0.18), transparent 26%),
          linear-gradient(145deg, #081f2c, #102e49 58%, #122a5d);
      }

      .star-test-page {
        width: min(1100px, 100%);
        margin: 0 auto;
        display: grid;
        gap: 18px;
      }

      .star-test-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
      }

      .star-test-card {
        padding: 20px;
        border-radius: 24px;
        background: rgba(8, 20, 29, 0.66);
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.18);
        display: grid;
        gap: 14px;
      }

      .intro h1,
      .star-test-card h2 {
        margin: 0;
        font-family: "FuenteDilana", sans-serif;
        line-height: 1.05;
      }

      .eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.76rem;
        color: rgba(255, 236, 188, 0.84);
      }

      p,
      .footnote {
        margin: 0;
        line-height: 1.55;
        color: rgba(247, 240, 220, 0.88);
      }

      .controls-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .wide {
        grid-column: 1 / -1;
      }

      label {
        display: grid;
        gap: 6px;
      }

      label span {
        font-size: 0.9rem;
        font-weight: 700;
      }

      input,
      select,
      button {
        font: inherit;
      }

      input,
      select {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.08);
        color: #fff5d7;
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        font-weight: 800;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.12);
        color: #fff4d0;
      }

      button.primary {
        background: linear-gradient(135deg, #f7d26f, #ffefba);
        color: #172131;
      }

      button:disabled {
        opacity: 0.52;
        cursor: not-allowed;
      }

      .actions-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      pre {
        margin: 0;
        padding: 14px;
        border-radius: 16px;
        background: rgba(0, 0, 0, 0.2);
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
        color: #cde9ff;
      }

      .scores-grid {
        display: grid;
        gap: 10px;
      }

      .score-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.08);
      }

      @media (max-width: 700px) {
        :host {
          padding: 12px;
        }

        .controls-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class StarTest {
  // Mini roster local para probar cómo afecta star_claimed al marcador.
  players: StarTestPlayer[] = [
    { id: 'u_1', name: 'Ana', score: 12 },
    { id: 'u_2', name: 'Bruno', score: 9 },
    { id: 'u_3', name: 'Cora', score: 15 },
  ];

  activeStar: RealtimeStarSpawn | null = null;
  lastClaim: RealtimeStarClaim | null = null;
  winnerBannerLabel = '';
  claimSequence = 0;
  selectedWinnerId = this.players[0].id;

  draftStartX = 12;
  draftStartY = 22;
  draftEndX = 82;
  draftEndY = 68;
  draftDuration = 2600;

  simulateSpawn(): void {
    // Construye un payload con la misma forma que llega desde realtime,
    // usando coordenadas en porcentaje de pantalla.
    this.activeStar = {
      starId: `star_${Date.now()}`,
      path: {
        start: { x: this.clampPercentage(this.draftStartX), y: this.clampPercentage(this.draftStartY) },
        end: { x: this.clampPercentage(this.draftEndX), y: this.clampPercentage(this.draftEndY) },
      },
      duration: this.clampDuration(this.draftDuration),
      receivedAt: Date.now(),
    };
    this.lastClaim = null;
    this.winnerBannerLabel = '';
  }

  simulateClaim(winnerId: string): void {
    // Replica el contrato de backend: winnerId + mapa completo de scores ya
    // actualizados con el +3 aplicado al jugador que capturó la estrella.
    if (!this.activeStar) {
      return;
    }

    const nextScores = Object.fromEntries(
      this.players.map((player) => [
        player.id,
        player.score + (player.id === winnerId ? 3 : 0),
      ])
    );

    this.players = this.players.map((player) => ({
      ...player,
      score: nextScores[player.id] ?? player.score,
    }));

    this.lastClaim = {
      winnerId,
      newScores: nextScores,
      receivedAt: Date.now(),
    };
    this.activeStar = null;
    this.winnerBannerLabel = this.playerNameFor(winnerId);
    // El banner debe poder relanzarse incluso si el mismo jugador vuelve a ganar.
    this.claimSequence += 1;
  }

  randomizePath(): void {
    // Genera trayectorias con aspecto razonable: nace en la mitad izquierda/superior
    // y termina más abajo y hacia la derecha, como una estrella cruzando la pantalla.
    this.draftStartX = this.randomBetween(4, 28);
    this.draftStartY = this.randomBetween(8, 36);
    this.draftEndX = this.randomBetween(68, 96);
    this.draftEndY = this.randomBetween(42, 82);
    this.draftDuration = this.randomBetween(2000, 4000);
  }

  onWinnerChanged(event: Event): void {
    // El selector alimenta qué jugador ganará si se pulsa "claim" o se hace click en la estrella.
    const target = event.target as HTMLSelectElement | null;
    if (!target?.value) {
      return;
    }

    this.selectedWinnerId = target.value;
  }

  readNumberInput(event: Event, fallback: number): number {
    // La UI acepta escritura libre. Si el usuario deja un valor inválido,
    // se mantiene el último valor correcto para no romper la simulación.
    const target = event.target as HTMLInputElement | null;
    if (!target) {
      return fallback;
    }

    const nextValue = Number(target.value);
    return Number.isFinite(nextValue) ? nextValue : fallback;
  }

  format(value: object): string {
    return JSON.stringify(value, null, 2);
  }

  private playerNameFor(playerId: string): string {
    return this.players.find((player) => player.id === playerId)?.name ?? playerId;
  }

  private randomBetween(min: number, max: number): number {
    return Math.round(min + Math.random() * (max - min));
  }

  private clampPercentage(value: number): number {
    // El backend define las coordenadas en 0..100 sobre viewport.
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private clampDuration(value: number): number {
    // Se usa el mismo rango de seguridad que en realtime para que la prueba
    // se parezca al comportamiento real.
    return Math.max(1200, Math.min(6000, Math.round(value)));
  }
}
