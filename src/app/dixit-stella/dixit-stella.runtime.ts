import type { DeckCard } from '../services/card-pull';
import {
  MAX_SELECTIONS,
  TOTAL_ROUNDS,
  type RevealOutcome,
  type ScoringSummaryRow,
  type StellaPhase,
  type StellaPlayerState,
} from './dixit-stella.constants';
import {
  buildOpponentSelection,
  getMatchingPlayers,
  replaceBoardRow,
  resolveChosenCardCode,
  resolveDarknessState,
  resolveNextExplorerId,
  resolveWinners,
} from './dixit-stella.logic';

export interface StellaRuntimeHost {
  phase: StellaPhase;
  roundNumber: number;
  players: StellaPlayerState[];
  currentPlayer: StellaPlayerState;
  boardCards: DeckCard[];
  activeExplorerId: string;
  darkPlayerId: string;
  selectionMessage: string;
  lastResolutionTitle: string;
  finalWinners: StellaPlayerState[];
  imageDeck: DeckCard[];
  deckCursor: number;
  firstExplorerIndex: number;
  activeWord: string;
  limitFeedbackActive: boolean;
  limitFeedbackTimer: ReturnType<typeof setTimeout> | null;
  revealLog: Array<{
    id: number;
    explorerName: string;
    cardCode: string;
    cardLabel: string;
    matchingPlayerNames: string[];
    outcome: RevealOutcome;
    outcomeLabel: string;
  }>;
  revealLogSequence: number;
  scoringSummary: ScoringSummaryRow[];
  setSelectionForPlayer(playerId: string, cardCodes: string[]): void;
  getRevealPrompt(player: StellaPlayerState): string;
  getRemainingSelectionCodes(player: StellaPlayerState): string[];
  getPlayerIndex(playerId: string): number;
  applyScoringPhase(): void;
  prepareRoundState(): void;
  getCardByCode(cardCode: string): DeckCard | undefined;
  awardAssociation(player: StellaPlayerState, points: number): void;
  pushRevealLog(
    explorerName: string,
    cardCode: string,
    cardLabel: string,
    matchingPlayerNames: string[],
    outcome: RevealOutcome
  ): void;
}

export function runToggleCurrentSelection(runtime: StellaRuntimeHost, cardCode: string): void {
  if (runtime.currentPlayer.submitted) {
    return;
  }

  if (runtime.currentPlayer.selection.includes(cardCode)) {
    runtime.currentPlayer.selection = runtime.currentPlayer.selection.filter((code) => code !== cardCode);
    runtime.currentPlayer.selectionCount = runtime.currentPlayer.selection.length;
    runtime.selectionMessage = `${runtime.currentPlayer.selection.length} cartas marcadas.`;
    return;
  }

  if (runtime.currentPlayer.selection.length >= MAX_SELECTIONS) {
    runtime.selectionMessage = 'No puedes marcar una undecima carta. El maximo reglamentario es 10.';
    runtime.limitFeedbackActive = true;

    if (runtime.limitFeedbackTimer !== null) {
      clearTimeout(runtime.limitFeedbackTimer);
    }

    runtime.limitFeedbackTimer = setTimeout(() => {
      runtime.limitFeedbackActive = false;
      runtime.limitFeedbackTimer = null;
    }, 420);
    return;
  }

  runtime.currentPlayer.selection = [...runtime.currentPlayer.selection, cardCode];
  runtime.currentPlayer.selectionCount = runtime.currentPlayer.selection.length;
  runtime.selectionMessage = `${runtime.currentPlayer.selection.length} cartas marcadas.`;
}

export function runAutoSubmitOpponents(runtime: StellaRuntimeHost): void {
  for (let index = 0; index < runtime.players.length; index += 1) {
    const player = runtime.players[index];
    if (player.isCurrentUser) {
      continue;
    }

    runtime.setSelectionForPlayer(
      player.id,
      buildOpponentSelection(runtime.activeWord, index, runtime.roundNumber, runtime.boardCards)
    );
  }
}

export function runStartAnnouncePhase(runtime: StellaRuntimeHost): void {
  if (!runtime.players.every((player) => player.selectionCount >= 1)) {
    runtime.selectionMessage = 'Todos los jugadores deben marcar al menos una carta.';
    return;
  }

  runtime.phase = 'announce';
  runtime.darkPlayerId = resolveDarknessState(runtime.players);
  runtime.lastResolutionTitle = 'Conteos cerrados';

  if (runtime.darkPlayerId) {
    const darkPlayer = runtime.players.find((player) => player.id === runtime.darkPlayerId);
    runtime.selectionMessage = `${darkPlayer?.name ?? 'Un jugador'} queda en Oscuridad por liderar en solitario.`;
    return;
  }

  runtime.selectionMessage =
    'Nadie entra en Oscuridad porque el maximo esta empatado o no hay lider unico.';
}

export function runStartRevealPhase(runtime: StellaRuntimeHost): void {
  if (runtime.phase !== 'announce') {
    return;
  }

  runtime.phase = 'reveal';
  runtime.activeExplorerId = resolveNextExplorerId(
    runtime.players,
    runtime.firstExplorerIndex - 1,
    (player) => runtime.getRemainingSelectionCodes(player)
  );
  runtime.lastResolutionTitle = 'Secuencia de revelado';

  if (!runtime.activeExplorerId) {
    runtime.applyScoringPhase();
    return;
  }

  const explorer = runtime.players.find((player) => player.id === runtime.activeExplorerId);
  if (explorer) {
    runtime.selectionMessage = runtime.getRevealPrompt(explorer);
  }
}

export function runResolveExplorerTurn(runtime: StellaRuntimeHost, cardCode?: string): void {
  if (runtime.phase !== 'reveal') {
    return;
  }

  const explorer = runtime.players.find((player) => player.id === runtime.activeExplorerId);
  if (!explorer) {
    runtime.applyScoringPhase();
    return;
  }

  const remainingCodes = runtime.getRemainingSelectionCodes(explorer);
  if (remainingCodes.length === 0) {
    const nextExplorerId = resolveNextExplorerId(
      runtime.players,
      runtime.getPlayerIndex(explorer.id),
      (player) => runtime.getRemainingSelectionCodes(player)
    );
    if (!nextExplorerId) {
      runtime.applyScoringPhase();
      return;
    }

    runtime.activeExplorerId = nextExplorerId;
    const nextExplorer = runtime.players.find((player) => player.id === runtime.activeExplorerId);
    if (nextExplorer) {
      runtime.selectionMessage = runtime.getRevealPrompt(nextExplorer);
    }
    return;
  }

  const chosenCardCode = resolveChosenCardCode(explorer, remainingCodes, cardCode, runtime.players);
  if (!chosenCardCode) {
    runtime.selectionMessage = 'Selecciona una de tus cartas aun no reveladas.';
    return;
  }

  explorer.revealedSelectionCodes = [...explorer.revealedSelectionCodes, chosenCardCode];

  const matchingPlayers = getMatchingPlayers(runtime.players, explorer.id, chosenCardCode);
  const chosenCard = runtime.getCardByCode(chosenCardCode);

  if (matchingPlayers.length === 0) {
    explorer.hasFallen = true;
    runtime.pushRevealLog(
      explorer.name,
      chosenCardCode,
      chosenCard?.value ?? chosenCardCode,
      [],
      'fall'
    );
    runtime.lastResolutionTitle = 'Caida';
    runtime.selectionMessage = `${explorer.name} cae: nadie mas habia marcado ${chosenCard?.value ?? chosenCardCode}.`;
  } else if (matchingPlayers.length === 1) {
    runtime.awardAssociation(explorer, 3);
    runtime.awardAssociation(matchingPlayers[0], 3);
    runtime.pushRevealLog(
      explorer.name,
      chosenCardCode,
      chosenCard?.value ?? chosenCardCode,
      matchingPlayers.map((player) => player.name),
      'super-spark'
    );
    runtime.lastResolutionTitle = 'Super-spark';
    runtime.selectionMessage = `${explorer.name} conecta con ${matchingPlayers[0].name} y ambos reciben 3 estrellas.`;
  } else {
    runtime.awardAssociation(explorer, 2);
    for (const matchingPlayer of matchingPlayers) {
      runtime.awardAssociation(matchingPlayer, 2);
    }
    runtime.pushRevealLog(
      explorer.name,
      chosenCardCode,
      chosenCard?.value ?? chosenCardCode,
      matchingPlayers.map((player) => player.name),
      'spark'
    );
    runtime.lastResolutionTitle = 'Spark';
    runtime.selectionMessage = `${explorer.name} conecta con ${matchingPlayers.length} rivales y se reparten 2 estrellas.`;
  }

  const nextExplorerId = resolveNextExplorerId(
    runtime.players,
    runtime.getPlayerIndex(explorer.id),
    (player) => runtime.getRemainingSelectionCodes(player)
  );
  if (!nextExplorerId) {
    runtime.applyScoringPhase();
    return;
  }

  runtime.activeExplorerId = nextExplorerId;
}

export function runAdvanceAfterScoring(runtime: StellaRuntimeHost): void {
  if (runtime.phase !== 'scoring') {
    return;
  }

  if (runtime.roundNumber === TOTAL_ROUNDS) {
    runtime.phase = 'finished';
    runtime.finalWinners = resolveWinners(runtime.players);
    const winner = runtime.finalWinners[0];
    runtime.selectionMessage = winner
      ? runtime.finalWinners.length > 1
        ? `${runtime.finalWinners.map((player) => player.name).join(', ')} comparten la victoria.`
        : `${winner.name} gana la partida.`
      : 'La partida ha terminado sin jugadores registrados.';
    return;
  }

  const nextBoard = replaceBoardRow(
    runtime.boardCards,
    runtime.imageDeck,
    runtime.deckCursor,
    runtime.roundNumber - 1
  );
  runtime.boardCards = nextBoard.boardCards;
  runtime.deckCursor = nextBoard.deckCursor;
  runtime.firstExplorerIndex = (runtime.firstExplorerIndex + 1) % runtime.players.length;
  runtime.roundNumber += 1;
  runtime.prepareRoundState();
}
