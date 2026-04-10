export type DixitPhase = 'hand' | 'choice' | 'points';
export type PointsStage = 'waiting' | 'reveal' | 'ranking';

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

export interface PlayerPanelRow extends RosterPlayer {
  points: number;
  isCurrentPlayer: boolean;
}

export interface WildcardReward {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
}

export interface BoardEffectPopup {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface SpecialCellResolutionOptions {
  allowWildcardReward?: boolean;
}

export const PHASE_STEPS: readonly PhaseStep[] = [
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

export const ROUND_CLUES = [
  'Una mirada perdida.',
  'El eco de un bosque dormido.',
  'Nadie vio venir la tormenta.',
  'La ultima luz antes del silencio.',
] as const;

export const WILDCARD_CELL_POSITIONS = [3, 8, 11, 15, 19, 23, 27, 31, 35, 39, 41, 42] as const;
export const EVENT_BACK_CELL_POSITIONS = [6, 14, 22, 30, 38] as const;
export const EVENT_FORWARD_CELL_POSITIONS = [10, 18, 26, 34, 40] as const;

export const WILDCARD_REWARDS: readonly Omit<WildcardReward, 'id'>[] = [
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
