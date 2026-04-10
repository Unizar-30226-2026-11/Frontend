import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DeckCard } from '../../services/card-pull';
import { DixitTrackBoard, TrackBoardToken } from '../components/track-board';

export interface DixitRevealedCard {
  card: DeckCard;
  ownerName: string;
  votes: number;
}

export interface DixitRankingRow {
  playerId: string;
  playerName: string;
  pointsBefore: number;
  pointsEarned: number;
  totalPoints: number;
}

@Component({
  selector: 'app-dixit-points-phase',
  standalone: true,
  imports: [DixitTrackBoard],
  templateUrl: './points-phase.html',
  styleUrl: './points-phase.css',
})
export class DixitPointsPhase {
  @Input() boardTokens: TrackBoardToken[] = [];
  @Input() waitingVotes = false;
  @Input() votesReceived = 0;
  @Input() votesTotal = 0;
  @Input() revealedCards: DixitRevealedCard[] = [];
  @Input() ranking: DixitRankingRow[] = [];
  @Input() showRanking = false;

  @Output() readonly skipWaitingRequested = new EventEmitter<void>();
  @Output() readonly rankingRequested = new EventEmitter<void>();
  @Output() readonly nextRoundRequested = new EventEmitter<void>();
}
