export type StellaPhase =
  | 'STELLA_WORD_REVEAL'
  | 'STELLA_MARKING'
  | 'STELLA_REVEAL'
  | 'SCORING'
  | 'FINISHED';
export type LanternState = 'LIGHT' | 'DARK';
export type RevealOutcome = 'super-spark' | 'spark' | 'fall';

export interface PhaseMeta {
  title: string;
  description: string;
}

export interface StellaPlayerState {
  id: string;
  name: string;
  color: string;
  score: number;
  selection: string[];
  selectionCount: number;
  submitted: boolean;
  lanternState: LanternState;
  hasFallen: boolean;
  revealedSelectionCodes: string[];
  roundPoints: number;
  successfulAssociations: number;
  isCurrentUser: boolean;
}

export interface RevealLogEntry {
  id: number;
  explorerName: string;
  cardCode: string;
  cardLabel: string;
  matchingPlayerNames: string[];
  outcome: RevealOutcome;
  outcomeLabel: string;
}

export interface ScoringSummaryRow {
  playerId: string;
  playerName: string;
  scoreBefore: number;
  roundPoints: number;
  penalty: number;
  netPoints: number;
  totalScore: number;
}

export const BOARD_COLUMNS = 5;
export const BOARD_ROWS = 3;
export const BOARD_CARD_COUNT = BOARD_COLUMNS * BOARD_ROWS;
export const TOTAL_ROUNDS = 4;
export const MIN_SELECTIONS = 1;
export const MAX_SELECTIONS = 10;

export const PHASE_META: Record<StellaPhase, PhaseMeta> = {
  STELLA_WORD_REVEAL: {
    title: 'Palabra',
    description: 'La palabra de la ronda ya es publica. Espera al marcado oficial del servidor.',
  },
  STELLA_MARKING: {
    title: 'Marcado',
    description: 'Selecciona entre 1 y 10 cartas y confirma tus marcas por socket.',
  },
  STELLA_REVEAL: {
    title: 'Revelado',
    description: 'El explorador resuelve una carta cada vez hasta caer o vaciar su seleccion.',
  },
  SCORING: {
    title: 'Puntuacion',
    description: 'El servidor ya ha consolidado la ronda y espera el avance a la siguiente.',
  },
  FINISHED: {
    title: 'Final',
    description: 'La partida ha terminado y el servidor ya ha cerrado la clasificacion final.',
  },
};

export const PLAYER_COLORS = [
  '#ff9f43',
  '#49dcb1',
  '#5b8def',
  '#f76ed7',
  '#ff6b6b',
  '#f4d35e',
] as const;

export const DEMO_PLAYER_NAMES = ['Ariel', 'Berta', 'Cael', 'Dora', 'Elio', 'Faro'] as const;
