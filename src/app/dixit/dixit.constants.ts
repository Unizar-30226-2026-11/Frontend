import type { RealtimeGameEndedRankingEntry } from '../interfaces/dixit-realtime';
import type { TrackBoardSpecialCell } from './components/track-board';

export type DixitPhase = 'hand' | 'choice' | 'points' | 'finished';
export type PointsStage = 'waiting' | 'reveal' | 'ranking';
export type MinigameUiState = 'playing' | 'waiting' | 'won' | 'lost' | 'cancelled';
export type SimulationTriggerMode = 'duel' | null;

export interface PhaseStep {
  id: DixitPhase;
  title: string;
  description: string;
}

export interface RosterPlayer {
  id: string;
  name: string;
  color: string;
}

export interface RoundPlayer extends RosterPlayer {
  pointsBefore: number;
}

export interface ResolvedPhaseState {
  phase: DixitPhase;
  pointsStage: PointsStage;
}

export interface RoundVoteEntry {
  voterId: string;
  targetCardCode: string;
}

export interface FinalRankingRow extends RealtimeGameEndedRankingEntry {
  playerName: string;
  isCurrentPlayer: boolean;
}

export const PHASE_STEPS: readonly PhaseStep[] = [
  {
    id: 'hand',
    title: 'Elegir carta',
    description: 'Selecciona una carta y enviala cuando el servidor te deje jugar.',
  },
  {
    id: 'choice',
    title: 'Votacion',
    description: 'Con la pista visible, escoge la carta que quieres votar y confirma tu seleccion.',
  },
  {
    id: 'points',
    title: 'Puntuacion',
    description: 'Espera el resultado del servidor y revisa la resolucion de la ronda.',
  },
  {
    id: 'finished',
    title: 'Fin de partida',
    description: 'Consulta tu posicion final, las monedas ganadas y la clasificacion.',
  },
];

export const DEFAULT_CARD_IMAGE = '/assets/Tablero.png';
export const DEFAULT_PLAYER_COLORS = [
  '#ff7725',
  '#27c93f',
  '#2b79ff',
  '#d645ff',
  '#ff3a3a',
  '#ffd166',
] as const;

// Refleja Backend/src/shared/constants/board-config.ts.
// Los indices son puntuaciones reales del backend: 0 es la salida y 42 el final.
export const SPECIAL_BOARD_CELLS: readonly TrackBoardSpecialCell[] = [
  {
    index: 5,
    kind: 'odd',
    badge: '+/-',
    label: 'Impares: alterna bonus y penalizacion segun orden de llegada.',
  },
  {
    index: 7,
    kind: 'even',
    badge: '-/+',
    label: 'Pares: alterna penalizacion y bonus segun orden de llegada.',
  },
  {
    index: 9,
    kind: 'odd',
    badge: '+/-',
    label: 'Impares: alterna bonus y penalizacion segun orden de llegada.',
  },
  {
    index: 10,
    kind: 'bonus',
    badge: '⇄',
    label: 'Bonus: puede ofrecer un cambio de modo de juego.',
  },
  {
    index: 11,
    kind: 'even',
    badge: '-/+',
    label: 'Pares: alterna penalizacion y bonus segun orden de llegada.',
  },
  {
    index: 18,
    kind: 'shuffle',
    badge: '↻',
    label: 'Shuffle: cambia toda tu mano; en Stella intercambia puntos.',
  },
  {
    index: 21,
    kind: 'bonus',
    badge: '⇄',
    label: 'Bonus: puede ofrecer un cambio de modo de juego.',
  },
  {
    index: 25,
    kind: 'duel',
    badge: '⚔',
    label: 'Duelo: permite retar a otro jugador apostando puntos.',
  },
  {
    index: 27,
    kind: 'equilibrium',
    badge: '=',
    label: 'Equilibrio: todos avanzan puntos segun su posicion en la clasificacion.',
  },
  {
    index: 31,
    kind: 'bonus',
    badge: '⇄',
    label: 'Bonus: puede ofrecer un cambio de modo de juego.',
  },
  {
    index: 34,
    kind: 'shuffle',
    badge: '↻',
    label: 'Shuffle: cambia toda tu mano; en Stella intercambia puntos.',
  },
  {
    index: 37,
    kind: 'bonus',
    badge: '⇄',
    label: 'Bonus: puede ofrecer un cambio de modo de juego.',
  },
  {
    index: 40,
    kind: 'duel',
    badge: '⚔',
    label: 'Duelo: permite retar a otro jugador apostando puntos.',
  },
] as const;
