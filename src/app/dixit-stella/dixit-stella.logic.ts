import type { WordCard } from '../interfaces/word-card';
import type { DeckCard } from '../services/card-pull';
import {
  BOARD_COLUMNS,
  DEMO_PLAYER_NAMES,
  MAX_SELECTIONS,
  PLAYER_COLORS,
  type ScoringSummaryRow,
  type StellaPlayerState,
} from './dixit-stella.constants';

export function createSeedFromString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function shuffleWithSeed<T>(items: readonly T[], seedKey: string): T[] {
  const shuffledItems = [...items];
  let seed = createSeedFromString(seedKey);

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    const currentItem = shuffledItems[index];
    shuffledItems[index] = shuffledItems[swapIndex];
    shuffledItems[swapIndex] = currentItem;
  }

  return shuffledItems;
}

export function createPlayersFromLobby(lobbyPlayers: string[]): StellaPlayerState[] {
  const resolvedNames = [...lobbyPlayers];

  for (const demoName of DEMO_PLAYER_NAMES) {
    if (resolvedNames.length >= 4) {
      break;
    }
    resolvedNames.push(demoName);
  }

  return resolvedNames.slice(0, 6).map((name, index) => ({
    id: `player-${index + 1}`,
    name,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    score: 0,
    selection: [],
    selectionCount: 0,
    submitted: false,
    lanternState: 'LIGHT',
    hasFallen: false,
    revealedSelectionCodes: [],
    roundPoints: 0,
    successfulAssociations: 0,
    isCurrentUser: index === 0,
  }));
}

export function resolveActiveWord(wordCard: WordCard, roundNumber: number, roomId: string): string {
  const choiceIndex =
    createSeedFromString(`${wordCard.id}-${roundNumber}-${roomId}`) % wordCard.terms.length;
  return wordCard.terms[choiceIndex];
}

export function normalizeSelection(cardCodes: string[], boardCards: DeckCard[]): string[] {
  const allowedCodes = new Set(boardCards.map((card) => card.code));
  const uniqueCodes: string[] = [];

  for (const code of cardCodes) {
    if (!allowedCodes.has(code) || uniqueCodes.includes(code)) {
      continue;
    }

    uniqueCodes.push(code);
    if (uniqueCodes.length === MAX_SELECTIONS) {
      break;
    }
  }

  return uniqueCodes;
}

export function resetPlayersForRound(players: StellaPlayerState[]): void {
  for (const player of players) {
    player.selection = [];
    player.selectionCount = 0;
    player.submitted = false;
    player.lanternState = 'LIGHT';
    player.hasFallen = false;
    player.revealedSelectionCodes = [];
    player.roundPoints = 0;
    player.successfulAssociations = 0;
  }
}

export function buildOpponentSelection(
  activeWord: string,
  playerIndex: number,
  roundNumber: number,
  boardCards: DeckCard[]
): string[] {
  const desiredCount = 2 + (createSeedFromString(`${activeWord}-${playerIndex}-${roundNumber}`) % 5);
  const boardSize = boardCards.length;
  const startIndex = createSeedFromString(`${activeWord}-${playerIndex}-start`) % boardSize;
  const step = 2 + (createSeedFromString(`${activeWord}-${playerIndex}-step`) % 4);
  const orderedIndexes: number[] = [];

  for (let offset = 0; offset < boardSize; offset += 1) {
    const candidateIndex = (startIndex + offset * step) % boardSize;
    if (!orderedIndexes.includes(candidateIndex)) {
      orderedIndexes.push(candidateIndex);
    }
  }

  for (let offset = 0; offset < boardSize; offset += 1) {
    const candidateIndex = (startIndex + offset) % boardSize;
    if (!orderedIndexes.includes(candidateIndex)) {
      orderedIndexes.push(candidateIndex);
    }
  }

  return orderedIndexes
    .slice(0, Math.min(desiredCount, boardSize))
    .map((candidateIndex) => boardCards[candidateIndex].code);
}

export function resolveDarknessState(players: StellaPlayerState[]): string {
  let maxSelectionCount = 0;
  let contenders: StellaPlayerState[] = [];

  for (const player of players) {
    player.lanternState = 'LIGHT';
    if (player.selectionCount > maxSelectionCount) {
      maxSelectionCount = player.selectionCount;
      contenders = [player];
    } else if (player.selectionCount === maxSelectionCount) {
      contenders.push(player);
    }
  }

  if (maxSelectionCount > 0 && contenders.length === 1) {
    contenders[0].lanternState = 'DARK';
    return contenders[0].id;
  }

  return '';
}

export function getMatchingPlayers(
  players: StellaPlayerState[],
  explorerId: string,
  cardCode: string
): StellaPlayerState[] {
  return players.filter((player) => player.id !== explorerId && player.selection.includes(cardCode));
}

export function resolveChosenCardCode(
  explorer: StellaPlayerState,
  remainingCodes: string[],
  requestedCardCode: string | undefined,
  players: StellaPlayerState[]
): string {
  if (requestedCardCode && remainingCodes.includes(requestedCardCode)) {
    return requestedCardCode;
  }

  if (explorer.isCurrentUser) {
    return '';
  }

  let bestCardCode = remainingCodes[0];
  let bestScore = -1;

  for (const candidateCode of remainingCodes) {
    const matchCount = getMatchingPlayers(players, explorer.id, candidateCode).length;
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestCardCode = candidateCode;
    }
  }

  return bestCardCode;
}

export function resolveNextExplorerId(
  players: StellaPlayerState[],
  afterIndex: number,
  getRemainingSelectionCodes: (player: StellaPlayerState) => string[]
): string {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidateIndex = (afterIndex + offset + players.length) % players.length;
    const candidate = players[candidateIndex];

    if (candidate.hasFallen) {
      continue;
    }

    if (getRemainingSelectionCodes(candidate).length === 0) {
      continue;
    }

    return candidate.id;
  }

  return '';
}

export function applyScoringPhase(
  players: StellaPlayerState[],
  darkPlayerId: string
): { summary: ScoringSummaryRow[]; selectionMessage: string } {
  const summary: ScoringSummaryRow[] = [];

  for (const player of players) {
    const scoreBefore = player.score;
    const penalty = player.id === darkPlayerId && player.hasFallen ? player.successfulAssociations : 0;
    const netPoints = player.roundPoints - penalty;
    player.score += netPoints;

    summary.push({
      playerId: player.id,
      playerName: player.name,
      scoreBefore,
      roundPoints: player.roundPoints,
      penalty,
      netPoints,
      totalScore: player.score,
    });
  }

  const sortedSummary = summary.sort(
    (left, right) =>
      right.totalScore - left.totalScore || left.playerName.localeCompare(right.playerName)
  );

  if (darkPlayerId) {
    const darkPlayer = players.find((player) => player.id === darkPlayerId);
    if (darkPlayer?.hasFallen) {
      return {
        summary: sortedSummary,
        selectionMessage: `${darkPlayer.name} estaba en Oscuridad y pierde ${darkPlayer.successfulAssociations} estrellas por sus asociaciones exitosas.`,
      };
    }

    return {
      summary: sortedSummary,
      selectionMessage: `${darkPlayer?.name ?? 'El jugador oscuro'} sobrevivio a la ronda y conserva todos sus puntos.`,
    };
  }

  return {
    summary: sortedSummary,
    selectionMessage: 'La ronda termina sin penalizacion de Oscuridad.',
  };
}

export function replaceBoardRow(
  boardCards: DeckCard[],
  imageDeck: DeckCard[],
  deckCursor: number,
  rowIndex: number
): { boardCards: DeckCard[]; deckCursor: number } {
  const replacementStart = rowIndex * BOARD_COLUMNS;
  const replacementCards = imageDeck.slice(deckCursor, deckCursor + BOARD_COLUMNS);

  if (replacementCards.length < BOARD_COLUMNS) {
    return { boardCards, deckCursor };
  }

  const nextBoard = [...boardCards];
  nextBoard.splice(replacementStart, BOARD_COLUMNS, ...replacementCards);
  return {
    boardCards: nextBoard,
    deckCursor: deckCursor + BOARD_COLUMNS,
  };
}

export function sortPlayersByScore(players: StellaPlayerState[]): StellaPlayerState[] {
  return [...players].sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}

export function resolveWinners(players: StellaPlayerState[]): StellaPlayerState[] {
  if (players.length === 0) {
    return [];
  }

  const highestScore = Math.max(...players.map((player) => player.score));
  return sortPlayersByScore(players).filter((player) => player.score === highestScore);
}
