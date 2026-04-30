import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { DixitRealtime } from '../../services/dixit-realtime';
import { Auth } from '../../services/auth';
import { DeckCard, CardPull } from '../../services/card-pull';
import { StellaCardPull } from '../../services/stella-card-pull';
import { DixitStella } from '../../dixit-stella/dixit-stella';
import {
  StellaRealtimeSimulator,
  type StellaSimulatorSnapshot,
} from './stella-test-realtime';

const TEST_CARD_IMAGE = '/assets/Tablero.png';
const TEST_CARD_CATALOG: DeckCard[] = Array.from({ length: 30 }, (_, index) => ({
  code: String(index + 1),
  image: TEST_CARD_IMAGE,
  value: `Carta Stella ${index + 1}`,
  suit: 'STELLA',
}));

@Component({
  selector: 'app-stella-test-shell',
  standalone: true,
  imports: [DixitStella],
  providers: [
    StellaRealtimeSimulator,
    {
      provide: DixitRealtime,
      useExisting: StellaRealtimeSimulator,
    },
    {
      provide: CardPull,
      useValue: {
        getCards: async (count?: number) =>
          TEST_CARD_CATALOG.slice(0, typeof count === 'number' ? count : TEST_CARD_CATALOG.length),
      },
    },
    StellaCardPull,
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
        activeGameEngine: () => 'Stella',
        setActiveGameId: () => undefined,
        ensureInitialized: async () => null,
      },
    },
  ],
  template: `
    <section class="test-shell">
      <app-dixit-stella />

      <button
        type="button"
        class="drawer-toggle"
        [class.open]="drawerOpen"
        (click)="drawerOpen = !drawerOpen"
      >
        {{ drawerOpen ? 'Cerrar simulador' : 'Simulador Stella' }}
      </button>

      @if (drawerOpen) {
        <aside class="drawer open" aria-label="Barra lateral Stella">
          <div class="drawer-scroll">
            <article class="sim-card">
              <p class="eyebrow">Sandbox</p>
              <h2>Stella test rig</h2>
              <p>
                Esta ruta usa el <code>app-dixit-stella</code> real con un websocket simulado.
              </p>
            </article>

            <article class="sim-card">
              <p class="eyebrow">Estado</p>
              <div class="facts">
                <span><strong>Sala</strong><em>{{ snapshot?.lobbyCode || 'TEST-STELLA' }}</em></span>
                <span><strong>Conexion</strong><em>{{ simulator.connectionStatus() }}</em></span>
                <span><strong>Fase</strong><em>{{ snapshot?.phase || 'STELLA_WORD_REVEAL' }}</em></span>
                <span><strong>Ronda</strong><em>{{ snapshot?.roundNumber || 1 }}</em></span>
                <span><strong>Scout</strong><em>{{ scoutName() }}</em></span>
              </div>

              <label class="field">
                <span>Palabra</span>
                <input
                  type="text"
                  [value]="wordDraft"
                  (input)="wordDraft = readTextInput($event, wordDraft)"
                  placeholder="Palabra Stella"
                />
              </label>

              <div class="button-grid">
                <button type="button" class="primary" (click)="setWord()">Actualizar palabra</button>
                <button type="button" (click)="simulator.openMarkingPhase()">Abrir marcado</button>
                <button type="button" (click)="submitLocalMarks()">Enviar marcas locales</button>
                <button type="button" (click)="simulator.openRevealPhase()">Abrir reveal</button>
                <button type="button" (click)="revealNextLocalMark()">Revelar carta</button>
                <button type="button" (click)="simulator.openScoringPhase()">Abrir scoring</button>
                <button type="button" (click)="simulator.finishGame()">Fin de partida</button>
                <button type="button" class="secondary" (click)="simulator.resetDemo()">Reset</button>
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
      }
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

      .drawer.open {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 53;
        width: min(410px, 88vw);
        height: 100svh;
        padding: 14px;
        box-sizing: border-box;
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

      input,
      button {
        font: inherit;
      }

      input {
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

      @media (max-width: 820px) {
        .drawer-toggle {
          top: auto;
          bottom: 14px;
          transform: none;
        }

        .button-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class StellaTestShell implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly simulator = inject(StellaRealtimeSimulator);

  drawerOpen = true;
  wordDraft = 'Luz';

  get snapshot(): StellaSimulatorSnapshot | null {
    return this.simulator.simulatorSnapshot();
  }

  ngOnInit(): void {
    const lobbyCode = this.route.snapshot.paramMap.get('id')?.trim() || 'TEST-STELLA';
    void this.simulator.ensureLobbyConnection(lobbyCode);
    this.wordDraft = this.snapshot?.word || this.wordDraft;
  }

  scoutName(): string {
    const player = this.snapshot?.players.find((entry) => entry.id === this.snapshot?.currentScoutId);
    return player?.username ?? 'Sin resolver';
  }

  setWord(): void {
    this.simulator.setWord(this.wordDraft);
  }

  submitLocalMarks(): void {
    const marks = (this.snapshot?.boardCards ?? []).filter((_, index) => index % 3 === 0).slice(0, 4);
    this.simulator.sendGameAction('STELLA_SUBMIT_MARKS', { cardIds: marks });
  }

  revealNextLocalMark(): void {
    const localPlayer = this.snapshot?.players.find((player) => player.id === 'u_self');
    const nextCardId = localPlayer?.marks.find((cardId) => !this.snapshot?.revealedCards.includes(cardId));
    if (typeof nextCardId !== 'number') {
      return;
    }

    this.simulator.sendGameAction('STELLA_REVEAL_MARK', { cardId: nextCardId });
  }

  readTextInput(event: Event, fallback: string): string {
    const target = event.target as HTMLInputElement | null;
    return target ? target.value.trim() : fallback;
  }

  snapshotText(): string {
    return JSON.stringify(this.snapshot, null, 2);
  }
}
