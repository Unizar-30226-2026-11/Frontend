export interface AuthUser {
  id: string;
  username: string;
  email?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  activeGameId: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

export interface LoginResponse {
  message: string;
  token: string;
  activeGameId?: string | null;
  user: {
    id: string;
    username: string;
    email?: string;
  };
}

export interface RefreshResponse {
  message?: string;
  accessToken?: string;
  token?: string;
  activeGameId?: string | null;
  user?: {
    id?: string;
    username?: string;
    email?: string;
  };
}
