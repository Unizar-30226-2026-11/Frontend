export const PLAYER_PRESENCE_STATUSES = ['CONNECTED', 'DISCONNECTED', 'UNKNOWN'] as const;

export type PlayerPresenceStatus = (typeof PLAYER_PRESENCE_STATUSES)[number];

export interface UserProfileApi {
  id_user: number;
  username: string;
  email: string;
  exp_level: number;
  progress_level: number;
  state: string;
  personal_state: string;
  id: string;
}

export interface UserProfileResponse {
  profile: UserProfileApi;
}

export interface UserBalanceResponse {
  balance: number | { coins?: number; balance?: number };
}

export interface UpdateUsernamePayload {
  username: string;
}

export interface UpdateStatusPayload {
  status: PlayerPresenceStatus;
}

export interface PlayerMutationResponse {
  message?: unknown;
}

export type InventoryEntryApi = string | { id?: string; itemId?: string; name?: string; type?: string };

export interface UserInventoryResponse {
  inventory: {
    inventory: InventoryEntryApi[];
  };
}

export interface PlayerInfo {
  id: string;
  legacyUserId: number;
  username: string;
  email: string;
  experienceLevel: number;
  progressLevel: number;
  state: PlayerPresenceStatus;
  personalState: string;
  balance: number;
}
