import type { RealtimeGameEndedRankingEntry } from '../interfaces/dixit-realtime';

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

export interface BoardEffectPopup {
  id: string;
  title: string;
  description: string;
  icon: string;
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

export const EVENT_BACK_CELL_POSITIONS = [6, 14, 22, 30, 38] as const;
export const EVENT_FORWARD_CELL_POSITIONS = [10, 18, 26, 34, 40] as const;
