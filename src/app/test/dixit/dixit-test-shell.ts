import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Dixit } from '../../dixit/dixit';
import { Auth } from '../../services/auth';
import { CardPull, type DeckCard } from '../../services/card-pull';
import { DixitRealtime } from '../../services/dixit-realtime';
import {
  DixitRealtimeSimulator,
  type DixitSimulatorSnapshot,
} from './dixit-test-realtime';

const TEST_CARD_IMAGE = '/assets/Tablero.png';
const TEST_CARD_CATALOG: DeckCard[] = [
  createCard('c_101', 'Dragon de humo'),
  createCard('c_102', 'Bosque invertido'),
  createCard('c_103', 'Rey de papel'),
  createCard('c_104', 'Bailarina lunar'),
  createCard('c_105', 'Llave de coral'),
  createCard('c_106', 'Gato del eclipse'),
  createCard('c_107', 'Teatro flotante'),
  createCard('c_108', 'Escalera en lluvia'),
  createCard('c_109', 'Barco en frasco'),
  createCard('c_110', 'Jardin mecanico'),
  createCard('c_111', 'Gigante dormido'),
  createCard('c_112', 'Puente de tiza'),
  createCard('c_113', 'Zorro astral'),
  createCard('c_114', 'Cabina de cristal'),
  createCard('c_115', 'Libro sumergido'),
  createCard('c_116', 'Ciudad cometa'),
  createCard('c_117', 'Caballo de niebla'),
  createCard('c_118', 'Mapa sonambulo'),
  createCard('c_119', 'Circo del reloj'),
  createCard('c_120', 'Dama del faro'),
  createCard('c_121', 'Torre del espejismo'),
  createCard('c_122', 'Jardin de tinta'),
  createCard('c_123', 'Flauta del bosque'),
  createCard('c_124', 'Astronauta de carton'),
];

@Component({
  selector: 'app-dixit-test-shell',
  standalone: true,
  imports: [Dixit],
  providers: [
    DixitRealtimeSimulator,
    {
      provide: DixitRealtime,
      useExisting: DixitRealtimeSimulator,
    },
    {
      provide: CardPull,
      useValue: {
        getCards: async (count?: number) =>
          TEST_CARD_CATALOG.slice(0, typeof count === 'number' ? count : TEST_CARD_CATALOG.length),
      },
    },
    {
      provide: Auth,
      useValue: {
        session: () => ({
          token: 'test-token',
          activeGameId: null,
          user: {
            id: 'u_self',
            username: 'Tester local',
            email: 'test@local.dev',
          },
        }),
        username: () => 'Tester local',
        token: () => 'test-token',
        activeGameId: () => null,
        setActiveGameId: () => undefined,
        ensureInitialized: async () => null,
      },
    },
  ],
  template: `
    <section class="test-shell">
      <app-dixit />

      @if (drawerOpen) {
        <button
          type="button"
          class="drawer-backdrop"
          aria-label="Cerrar simulador"
          (click)="drawerOpen = false"
        ></button>
      }

      <button
        type="button"
        class="drawer-toggle"
        [class.open]="drawerOpen"
        (click)="drawerOpen = !drawerOpen"
      >
        {{ drawerOpen ? 'Cerrar simulador' : 'Simulador' }}
      </button>

      <aside class="drawer" [class.open]="drawerOpen" aria-label="Barra lateral de estado y simulador">
        <div class="drawer-scroll">
          <article class="sim-card">
            <p class="eyebrow">Sandbox</p>
            <h2>Dixit test rig</h2>
            <p>
              Esta ruta usa el <code>app-dixit</code> real con un websocket simulado y cartas locales,
              sin tocar el flujo de produccion.
            </p>
          </article>

          <article class="sim-card">
            <p class="eyebrow">Estado</p>
            <h3>Partida</h3>
            <div class="facts">
              <span><strong>Sala</strong><em>{{ snapshot?.lobbyCode || 'TEST-DIXIT' }}</em></span>
              <span><strong>Conexion</strong><em>{{ simulator.connectionStatus() }}</em></span>
              <span><strong>Fase</strong><em>{{ snapshot?.phase || 'hand' }}</em></span>
              <span><strong>Ronda</strong><em>{{ snapshot?.roundNumber || 1 }}</em></span>
              <span><strong>Storyteller</strong><em>{{ storytellerName(snapshot) }}</em></span>
            </div>

            <label class="field">
              <span>Pista</span>
              <input
                type="text"
                [value]="clueDraft"
                (input)="clueDraft = readTextInput($event, clueDraft)"
                placeholder="Pista para la ronda"
              />
            </label>

            <div class="button-grid">
              <button type="button" class="primary" (click)="startRound('u_self')">
                Ronda local
              </button>
              <button type="button" (click)="startRound('u_mara')">Ronda bot</button>
              <button type="button" (click)="openVoting()">Abrir votacion</button>
              <button type="button" (click)="openReveal()">Abrir reveal</button>
              <button type="button" (click)="showRanking()">Mostrar ranking</button>
              <button type="button" (click)="nextRound()">Siguiente ronda</button>
            </div>
          </article>

          <article class="sim-card">
            <p class="eyebrow">Eventos</p>
            <h3>Socket simulado</h3>

            <label class="field">
              <span>Ganador estrella</span>
              <select [value]="starWinnerId" (change)="starWinnerId = readTextInput($event, starWinnerId)">
                @for (player of players(); track player.id) {
                  <option [value]="player.id">{{ player.username }}</option>
                }
              </select>
            </label>

            <div class="button-grid">
              <button type="button" (click)="simulator.emitDuel()">Duelo</button>
              <button type="button" (click)="simulator.startMinigame(0, false)">Minijuego 1</button>
              <button type="button" (click)="simulator.startMinigame(1, true)">Minijuego 2</button>
              <button type="button" (click)="simulator.cancelMinigame()">Cancelar minijuego</button>
              <button type="button" (click)="simulator.spawnStar()">Spawn estrella</button>
              <button type="button" (click)="simulator.resolveStarClaim(starWinnerId)">Claim estrella</button>
              <button type="button" (click)="simulator.finishGame()">Fin de partida</button>
              <button type="button" class="secondary" (click)="simulator.resetDemo()">Reset</button>
            </div>

            <pre>{{ minigameResolutionText() }}</pre>
          </article>

          <article class="sim-card">
            <p class="eyebrow">Marcador</p>
            <h3>Jugadores</h3>
            <div class="players">
              @for (player of players(); track player.id) {
                <div class="player-row">
                  <div class="player-copy">
                    <strong>{{ player.username }}</strong>
                    <small>
                      Mano: {{ player.hand.length }} · Carta: {{ player.playedCardCode || 'ninguna' }} ·
                      Voto: {{ player.voteCardCode || 'pendiente' }}
                    </small>
                  </div>
                  <label class="score-field">
                    <span>Puntos</span>
                    <input
                      type="number"
                      min="0"
                      [value]="player.score"
                      (input)="updateScore(player.id, readNumberInput($event, player.score))"
                    />
                  </label>
                </div>
              }
            </div>
          </article>

          <article class="sim-card">
            <p class="eyebrow">Payload</p>
            <h3>Snapshot actual</h3>
            <pre>{{ snapshotText() }}</pre>
          </article>

          <article class="sim-card">
            <p class="eyebrow">Actividad</p>
            <h3>Log del simulador</h3>
            <div class="log-list">
              @for (entry of simulator.simulatorLogs().slice().reverse(); track entry.id) {
                <p><strong>{{ entry.timestamp }}</strong> {{ entry.message }}</p>
              }
            </div>
          </article>
        </div>
      </aside>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .test-shell {
        position: relative;
      }

      .drawer-toggle {
        position: fixed;
        right: 14px;
        top: 50%;
        z-index: 55;
        transform: translateY(-50%);
        border: 0;
        border-radius: 999px;
        padding: 11px 16px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        color: #17222f;
        background: linear-gradient(135deg, #ffd368, #fff0bf);
        box-shadow: 0 14px 28px rgba(7, 11, 19, 0.26);
      }

      .drawer-toggle.open {
        right: min(430px, 88vw);
      }

      .drawer-backdrop {
        position: fixed;
        inset: 0;
        z-index: 52;
        border: 0;
        background: rgba(4, 8, 14, 0.42);
      }

      .drawer {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 53;
        width: min(410px, 88vw);
        height: 100svh;
        padding: 14px;
        box-sizing: border-box;
        transform: translateX(100%);
        transition: transform 180ms ease;
        pointer-events: none;
      }

      .drawer.open {
        transform: translateX(0);
        pointer-events: auto;
      }

      .drawer-scroll {
        height: 100%;
        overflow-y: auto;
        display: grid;
        gap: 12px;
        padding-right: 4px;
      }

      .sim-card {
        padding: 18px;
        border-radius: 24px;
        display: grid;
        gap: 14px;
        background: rgba(8, 20, 29, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(10px);
        color: #f7f0dc;
        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.2);
      }

      .eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.72rem;
        color: rgba(255, 236, 188, 0.84);
      }

      h2,
      h3,
      p {
        margin: 0;
      }

      h2,
      h3 {
        font-family: "FuenteDilana", sans-serif;
        color: #fff6d7;
        line-height: 1.05;
      }

      .facts {
        display: grid;
        gap: 8px;
      }

      .facts span {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.06);
      }

      .facts strong {
        font-size: 0.86rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255, 235, 187, 0.74);
      }

      .facts em {
        font-style: normal;
        font-weight: 700;
      }

      .field {
        display: grid;
        gap: 6px;
      }

      .field span,
      .score-field span {
        font-size: 0.82rem;
        font-weight: 700;
        color: rgba(255, 240, 203, 0.88);
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
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.08);
        color: #fff5d7;
      }

      .button-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .button-grid button {
        border: 0;
        border-radius: 16px;
        padding: 11px 12px;
        font-weight: 800;
        cursor: pointer;
        color: #fff4d2;
        background: rgba(255, 255, 255, 0.12);
      }

      .button-grid button.primary {
        color: #18212d;
        background: linear-gradient(135deg, #f7d26f, #ffefba);
      }

      .button-grid button.secondary {
        background: rgba(255, 255, 255, 0.08);
      }

      .players {
        display: grid;
        gap: 10px;
      }

      .player-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 88px;
        gap: 12px;
        align-items: center;
        padding: 12px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.07);
      }

      .player-copy {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      .player-copy strong {
        color: #fff9e6;
      }

      .player-copy small {
        color: rgba(247, 240, 220, 0.76);
        line-height: 1.45;
      }

      .score-field {
        display: grid;
        gap: 6px;
      }

      pre {
        margin: 0;
        padding: 12px;
        border-radius: 16px;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
        background: rgba(0, 0, 0, 0.22);
        color: #cde9ff;
      }

      .log-list {
        display: grid;
        gap: 8px;
        max-height: 18rem;
        overflow-y: auto;
        padding-right: 4px;
      }

      .log-list p {
        line-height: 1.45;
        color: rgba(247, 240, 220, 0.88);
      }

      :host ::ng-deep app-dixit .sim-drawer,
      :host ::ng-deep app-dixit .sim-drawer-toggle,
      :host ::ng-deep app-dixit .sim-drawer-backdrop {
        display: none !important;
      }

      @media (max-width: 820px) {
        .drawer-toggle {
          top: auto;
          bottom: 14px;
          transform: none;
        }

        .button-grid {
          grid-template-columns: 1fr;
        }

        .player-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DixitTestShell implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly simulator = inject(DixitRealtimeSimulator);
  private readonly handleDocumentClickCapture = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target || !this.simulator.activeMinigame()) {
      return;
    }

    const clickedCloseButton = !!target.closest('.close-button[aria-label="Cerrar minijuego"]');
    const clickedBackdrop =
      target.classList.contains('minigame-backdrop') ||
      target.classList.contains('memory-backdrop');

    if (!clickedCloseButton && !clickedBackdrop) {
      return;
    }

    this.simulator.closeActiveMinigame();
  };

  drawerOpen = true;
  clueDraft = '';
  starWinnerId = 'u_self';

  get snapshot(): DixitSimulatorSnapshot | null {
    return this.simulator.simulatorSnapshot();
  }

  ngOnInit(): void {
    const lobbyCode =
      this.route.snapshot.paramMap.get('id')?.trim() || 'TEST-DIXIT';
    void this.simulator.ensureLobbyConnection(lobbyCode);
    this.clueDraft = this.snapshot?.clue || '';
    document.addEventListener('click', this.handleDocumentClickCapture, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleDocumentClickCapture, true);
  }

  players() {
    return this.snapshot?.players ?? [];
  }

  storytellerName(snapshot: DixitSimulatorSnapshot | null): string {
    const storyteller = snapshot?.players.find((player) => player.id === snapshot.storytellerId);
    return storyteller?.username ?? 'Sin resolver';
  }

  startRound(playerId: string): void {
    this.simulator.startRoundWithStoryteller(playerId);
    this.syncClueDraft();
  }

  openVoting(): void {
    this.syncClueDraft();
    this.simulator.openVotingPhase();
  }

  openReveal(): void {
    this.syncClueDraft();
    this.simulator.openRevealPhase();
  }

  showRanking(): void {
    this.syncClueDraft();
    this.simulator.showRankingPhase();
  }

  nextRound(): void {
    this.simulator.sendGameAction('NEXT_ROUND');
    this.clueDraft = '';
  }

  updateScore(playerId: string, nextScore: number): void {
    this.simulator.updatePlayerScore(playerId, nextScore);
  }

  readTextInput(event: Event, fallback: string): string {
    const target = event.target as HTMLInputElement | HTMLSelectElement | null;
    return target ? target.value.trim() : fallback;
  }

  readNumberInput(event: Event, fallback: number): number {
    const target = event.target as HTMLInputElement | null;
    if (!target) {
      return fallback;
    }

    const nextValue = Number(target.value);
    return Number.isFinite(nextValue) ? nextValue : fallback;
  }

  snapshotText(): string {
    return JSON.stringify(this.snapshot, null, 2);
  }

  minigameResolutionText(): string {
    return JSON.stringify(this.snapshot?.lastMinigameResolution ?? null, null, 2);
  }

  private syncClueDraft(): void {
    if (!this.clueDraft.trim()) {
      return;
    }

    this.simulator.setClue(this.clueDraft);
  }
}

function createCard(code: string, value: string): DeckCard {
  return {
    code,
    image: TEST_CARD_IMAGE,
    value,
    suit: 'DIXIT',
  };
}
