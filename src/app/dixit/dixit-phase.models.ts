import type { RealtimeChatMessage } from '../interfaces/dixit-realtime';

export interface DixitPlayerRow {
  id: string;
  name: string;
  color: string;
  points: number;
  isCurrentPlayer: boolean;
}

export interface DixitWildcardReward {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
}

export interface DixitChatComposer {
  draft: string;
  canSend: boolean;
  messages: RealtimeChatMessage[];
}
