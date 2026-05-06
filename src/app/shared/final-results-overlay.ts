import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface FinalResultsStat {
  label: string;
  value: string;
  muted?: boolean;
}

export interface FinalResultsRankingRow {
  id: string;
  title: string;
  subtitle: string;
  sideValue: string;
  placeLabel?: string;
  highlighted?: boolean;
}

@Component({
  selector: 'app-final-results-overlay',
  standalone: true,
  template: `
    <div class="final-results-backdrop">
      <article
        class="final-results-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="final-results-title"
      >
        <p class="overlay-label">{{ eyebrow }}</p>
        <h2 id="final-results-title">{{ title }}</h2>

        @if (stats.length > 0) {
          <div class="final-results-hero">
            @for (stat of stats; track stat.label + stat.value) {
              <div class="final-results-stat" [class.muted]="!!stat.muted">
                <span class="final-results-stat-label">{{ stat.label }}</span>
                <strong>{{ stat.value }}</strong>
              </div>
            }
          </div>
        } @else if (copy) {
          <p class="final-results-copy">{{ copy }}</p>
        }

        @if (accentText) {
          <p class="final-results-wallet">{{ accentText }}</p>
        }

        @if (errorText) {
          <p class="final-results-error">{{ errorText }}</p>
        }

        <div class="final-results-actions">
          @if (secondaryActionLabel) {
            <button
              type="button"
              class="secondary-action"
              [disabled]="secondaryActionDisabled"
              (click)="secondaryAction.emit()"
            >
              {{ secondaryActionLabel }}
            </button>
          }
          <button type="button" class="sidebar-action" (click)="primaryAction.emit()">
            {{ primaryActionLabel }}
          </button>
        </div>

        @if (showRanking && rankingRows.length > 0) {
          <div class="final-ranking-list" aria-label="Clasificacion final">
            @for (entry of rankingRows; track entry.id) {
              <article class="final-ranking-row" [class.current-player]="!!entry.highlighted">
                @if (entry.placeLabel) {
                  <div class="final-ranking-place">{{ entry.placeLabel }}</div>
                }
                <div class="final-ranking-main">
                  <strong>{{ entry.title }}</strong>
                  <span>{{ entry.subtitle }}</span>
                </div>
                <div class="final-ranking-coins">{{ entry.sideValue }}</div>
              </article>
            }
          </div>
        }
      </article>
    </div>
  `,
  styles: `
    .overlay-label {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
      color: rgba(250, 233, 191, 0.84);
    }

    .final-results-backdrop {
      position: fixed;
      inset: 0;
      z-index: 45;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top, rgba(255, 215, 130, 0.18), transparent 28%),
        rgba(5, 10, 18, 0.74);
      backdrop-filter: blur(10px);
    }

    .final-results-overlay {
      width: min(92vw, 42rem);
      display: grid;
      gap: 18px;
      padding: 28px;
      border-radius: 28px;
      background:
        linear-gradient(155deg, rgba(17, 29, 49, 0.98), rgba(11, 57, 78, 0.94)),
        rgba(10, 19, 34, 0.96);
      border: 1px solid rgba(255, 233, 176, 0.24);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.32);
    }

    h2 {
      margin: 0;
      color: #fff6d7;
    }

    .final-results-hero {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }

    .final-results-stat {
      display: grid;
      gap: 6px;
      padding: 16px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .final-results-stat strong {
      font-family: "FuenteDilana", sans-serif;
      font-size: clamp(1.5rem, 3vw, 2.3rem);
      color: #fff6d7;
      line-height: 1;
    }

    .final-results-stat.muted strong {
      color: #a8d6ff;
    }

    .final-results-stat-label {
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.72rem;
      color: rgba(250, 233, 191, 0.76);
    }

    .final-results-copy,
    .final-results-wallet,
    .final-results-error {
      margin: 0;
      line-height: 1.55;
      color: rgba(244, 239, 228, 0.9);
    }

    .final-results-wallet {
      color: #ffe29c;
      font-weight: 700;
    }

    .final-results-error {
      color: #ffd3d3;
    }

    .final-results-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .final-ranking-list {
      display: grid;
      gap: 10px;
      max-height: min(44vh, 22rem);
      overflow-y: auto;
      padding-right: 4px;
    }

    .final-ranking-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .final-ranking-row.current-player {
      border-color: rgba(255, 214, 117, 0.34);
      background: rgba(255, 214, 117, 0.12);
    }

    .final-ranking-place,
    .final-ranking-coins {
      font-family: "FuenteDilana", sans-serif;
      font-size: 1.35rem;
      color: #fff1c3;
    }

    .final-ranking-main {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .final-ranking-main strong {
      color: #fff7dd;
    }

    .final-ranking-main span {
      color: rgba(244, 239, 228, 0.78);
      font-size: 0.95rem;
    }

    .sidebar-action,
    .secondary-action {
      border: 0;
      border-radius: 999px;
      padding: 8px 12px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
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

    .secondary-action:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
    }

    @media (max-width: 700px) {
      .final-results-actions {
        flex-direction: column;
      }

      .final-results-actions > button {
        width: 100%;
      }

      .final-ranking-row {
        grid-template-columns: 1fr;
      }

      .final-ranking-coins,
      .final-ranking-place {
        justify-self: start;
      }

      .final-results-overlay {
        padding: 22px;
      }
    }
  `,
})
export class FinalResultsOverlay {
  @Input() eyebrow = 'Fin de partida';
  @Input() title = 'Resultados finales';
  @Input() copy = '';
  @Input() accentText = '';
  @Input() errorText = '';
  @Input() primaryActionLabel = 'Continuar';
  @Input() secondaryActionLabel = '';
  @Input() secondaryActionDisabled = false;
  @Input() showRanking = false;
  @Input() stats: FinalResultsStat[] = [];
  @Input() rankingRows: FinalResultsRankingRow[] = [];

  @Output() readonly primaryAction = new EventEmitter<void>();
  @Output() readonly secondaryAction = new EventEmitter<void>();
}
