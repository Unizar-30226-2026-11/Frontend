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
  balance: {
    balance: number;
  };
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
  state: string;
  personalState: string;
  balance: number;
}
