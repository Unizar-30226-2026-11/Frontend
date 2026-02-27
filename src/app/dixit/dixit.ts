import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CardPull, DeckCard } from '../services/card-pull';
import { DixitChoicePhase } from './phases/choice-phase';
import { DixitHandPhase } from './phases/hand-phase';

type DixitPhase = 'hand' | 'choice';

@Component({
  selector: 'app-dixit',
  standalone: true,
  imports: [RouterModule, DixitHandPhase, DixitChoicePhase],
  template: `
    <section class="dixit-board">
      <header class="dixit-header">
        <h1>Mi mazo</h1>

        @if (!loading && !errorMessage && cards.length > 0) {
          <div class="phase-switch">
            <button
              type="button"
              [class.active]="phase === 'hand'"
              (click)="setPhase('hand')"
            >
              Fase 1
            </button>
            <button
              type="button"
              [class.active]="phase === 'choice'"
              (click)="setPhase('choice')"
            >
              Fase 2
            </button>
          </div>
        }
      </header>

      @if (loading) {
        <p>Cargando cartas...</p>
      }

      @if (!loading && errorMessage) {
        <p>{{ errorMessage }}</p>
      }

      @if (!loading && !errorMessage && cards.length === 0) {
        <p>No se recibieron cartas.</p>
      }

      @if (!loading && cards.length > 0) {
        <div class="phase-content">
          @if (phase === 'hand') {
            <app-dixit-hand-phase
              [cards]="cards"
              [selectedCardCode]="selectedHandCardCode"
              (cardSelected)="onHandCardSelected($event)"
            />
          } @else {
            <app-dixit-choice-phase class="choice-phase"
              [cards]="choiceCards"
              [selectedCardCode]="selectedChoiceCardCode"
              (choiceConfirmed)="onChoiceConfirmed($event)"
            />
          }
        </div>
      }
    </section>
  `,
  styles: `
    .dixit-board {
      min-height: 100svh;
      padding-top: 20px;
      display: flex;
      flex-direction: column;
    }

    .dixit-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-right: 12px;
    }

    h1 {
      margin-top: 0px;
      margin-bottom: 16px;
    }

    .phase-switch {
      display: inline-flex;
      gap: 6px;
      background: rgba(255, 255, 255, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 4px;
      border-radius: 999px;
      backdrop-filter: blur(6px);
    }

    .phase-switch button {
      border: 0;
      background: transparent;
      color: #fff;
      padding: 6px 12px;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 600;
    }

    .phase-switch button.active {
      background: rgba(255, 255, 255, 0.9);
      color: #1b2430;
    }

    .phase-content {
      flex: 1;
      display: flex;
      min-height: 0;
      margin-bottom: 0;
    }

    .choice-phase {
      width: auto;
      height: auto;
      margin-bottom: 0;
    }

    @media (max-width: 700px) {
      .dixit-header {
        align-items: flex-start;
        flex-direction: column;
        padding-right: 0;
      }
    }
  `,
})
export class Dixit implements OnInit {
  id = 0;
  phase: DixitPhase = 'hand';
  cards: DeckCard[] = [];
  choiceCards: DeckCard[] = [];
  loading = true;
  errorMessage = '';
  selectedHandCardCode = '';
  selectedChoiceCardCode = '';
  constructor(
    private router: Router,
    private cardPull: CardPull,
    private cdr: ChangeDetectorRef
  ) {
    const urlSegments = this.router.url.split('/');
    this.id = Number(urlSegments[urlSegments.length - 1]);
  }

  async ngOnInit(): Promise<void> {
    try {
      console.log('[Dixit] Cargando mano...');
      this.cards = await this.cardPull.getCards(6);
      this.choiceCards = [...this.cards];
      console.log('[Dixit] Mano cargada:', this.cards.length);
    } catch (error) {
      console.error('Error al cargar las cartas:', error);
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudieron cargar las cartas';
      this.cards = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  setPhase(phase: DixitPhase): void {
    this.phase = phase;
  }

  onHandCardSelected(card: DeckCard): void {
    this.selectedHandCardCode = card.code;
  }

  onChoiceConfirmed(card: DeckCard): void {
    this.selectedChoiceCardCode = card.code;
    console.log('[Dixit] Carta confirmada:', card.code);
  }
}
