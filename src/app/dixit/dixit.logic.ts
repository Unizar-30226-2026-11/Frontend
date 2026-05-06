import type { DeckCard } from '../services/card-pull';
import type { TrackBoardToken } from './components/track-board';
import type {
  BoardEffectPopup,
  RosterPlayer,
  RoundPlayer,
} from './dixit.constants';
import type { DixitRankingRow, DixitRevealedCard } from './phases/points-phase';

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

export function getRoundPlayers(
  playerRoster: readonly RosterPlayer[],
  choiceCards: DeckCard[],
  pointsByPlayer: Map<string, number>
): RoundPlayer[] {
  const totalPlayers = Math.min(choiceCards.length, playerRoster.length);

  return playerRoster.slice(0, totalPlayers).map((player) => ({
    ...player,
    pointsBefore: pointsByPlayer.get(player.id) ?? 0,
  }));
}

export function buildRevealAndRanking(
  roundPlayers: RoundPlayer[],
  choiceCards: DeckCard[],
  playerRoster: readonly RosterPlayer[],
  selectedChoiceCardCode: string,
  currentPlayerId: string
): {
  revealedCards: DixitRevealedCard[];
  ranking: DixitRankingRow[];
} {
  // Esta funcion reconstruye la resolucion de una ronda cuando el backend
  // todavia no ha enviado el detalle final y necesitamos mantener la UI viva.
  const cardsInRound = choiceCards.slice(0, roundPlayers.length);
  if (cardsInRound.length === 0) {
    return {
      revealedCards: [],
      ranking: [],
    };
  }

  const activePlayers = roundPlayers.slice(0, cardsInRound.length);
  const voteCounts = new Map<string, number>();
  for (const card of cardsInRound) {
    voteCounts.set(card.code, 0);
  }

  for (let voterIndex = 0; voterIndex < activePlayers.length; voterIndex += 1) {
    const ownCardCode = cardsInRound[voterIndex].code;
    const targetCode = resolveVoteCardCode(
      cardsInRound,
      voterIndex,
      ownCardCode,
      playerRoster,
      selectedChoiceCardCode,
      currentPlayerId
    );
    if (!targetCode) {
      continue;
    }

    voteCounts.set(targetCode, (voteCounts.get(targetCode) ?? 0) + 1);
  }

  const revealedCards = cardsInRound.map((card, index) => ({
    card,
    ownerName: activePlayers[index].name,
    votes: voteCounts.get(card.code) ?? 0,
  }));

  const ranking = activePlayers
    .map((player, index) => {
      const ownerCardCode = cardsInRound[index].code;
      const pointsEarned = voteCounts.get(ownerCardCode) ?? 0;
      const totalPoints = player.pointsBefore + pointsEarned;

      return {
        playerId: player.id,
        playerName: player.name,
        pointsBefore: player.pointsBefore,
        pointsEarned,
        totalPoints,
      };
    })
    .sort((left, right) => right.totalPoints - left.totalPoints);

  return { revealedCards, ranking };
}

export function rotateCards(cards: DeckCard[]): DeckCard[] {
  if (cards.length <= 1) {
    return [...cards];
  }

  const [firstCard, ...rest] = cards;
  return [...rest, firstCard];
}

export function buildBoardTokensFromScores(
  playerRoster: readonly RosterPlayer[],
  pointsByPlayer: Map<string, number>
): TrackBoardToken[] {
  return playerRoster.map((player) => ({
    id: player.id,
    name: player.name,
    color: player.color,
    position: pointsByPlayer.get(player.id) ?? 0,
  }));
}

interface ResolveSpecialCellsParams {
  previousPoints: number;
  nextPoints: number;
  eventBackCellPositions: readonly number[];
  eventForwardCellPositions: readonly number[];
  roundNumber: number;
  onPopup: (popup: BoardEffectPopup) => void;
}

export function resolveCurrentPlayerSpecialCells(
  params: ResolveSpecialCellsParams
): number {
  const {
    previousPoints,
    nextPoints,
    eventBackCellPositions,
    eventForwardCellPositions,
    roundNumber,
    onPopup,
  } = params;

  if (nextPoints === previousPoints) {
    return nextPoints;
  }

  let resolvedPoints = nextPoints;
  const visitedPositions = new Set<number>();
  let safety = 0;

  // El bucle se corta si repetimos casilla para evitar cadenas infinitas
  // entre eventos de avanzar y retroceder.
  while (safety < 8 && !visitedPositions.has(resolvedPoints)) {
    visitedPositions.add(resolvedPoints);
    safety += 1;

    if (eventBackCellPositions.includes(resolvedPoints)) {
      resolvedPoints = Math.max(0, resolvedPoints - 1);
      onPopup({
        id: `event-back-${roundNumber}-${safety}`,
        title: 'Casilla de evento',
        description: 'Has caido en una casilla de evento y retrocedes 1 casilla.',
        icon: '-1',
      });
      continue;
    }

    if (eventForwardCellPositions.includes(resolvedPoints)) {
      resolvedPoints += 1;
      onPopup({
        id: `event-forward-${roundNumber}-${safety}`,
        title: 'Casilla de evento',
        description: 'Has caido en una casilla de evento y avanzas 1 casilla extra.',
        icon: '+1',
      });
      continue;
    }

    break;
  }

  return resolvedPoints;
}

function resolveVoteCardCode(
  cardsInRound: DeckCard[],
  voterIndex: number,
  ownCardCode: string,
  playerRoster: readonly RosterPlayer[],
  selectedChoiceCardCode: string,
  currentPlayerId: string
): string | null {
  if (cardsInRound.length <= 1) {
    return null;
  }

  const voter = playerRoster[voterIndex];
  if (
    voter?.id === currentPlayerId &&
    selectedChoiceCardCode &&
    selectedChoiceCardCode !== ownCardCode &&
    cardsInRound.some((card) => card.code === selectedChoiceCardCode)
  ) {
    return selectedChoiceCardCode;
  }

  let targetIndex = (voterIndex + 1) % cardsInRound.length;
  if (cardsInRound[targetIndex].code === ownCardCode) {
    targetIndex = (targetIndex + 1) % cardsInRound.length;
  }

  const candidate = cardsInRound[targetIndex];
  return candidate.code === ownCardCode ? null : candidate.code;
}
