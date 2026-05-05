import type { RealtimeChatMessage } from '../interfaces/dixit-realtime';

export interface DixitPlayerRow {
  id: string;
  name: string;
  color: string;
  points: number;
  isCurrentPlayer: boolean;
}

export interface DixitChatComposer {
  draft: string;
  canSend: boolean;
  messages: RealtimeChatMessage[];
}

export interface DixitHandLimitModifier {
  type: 'HAND_LIMIT';
  value: number;
  turnsLeft: number;
}
