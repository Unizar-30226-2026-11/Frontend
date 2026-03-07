export interface AuthUser {
  id: string;
  username: string;
  email?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: {
    id: string;
    username: string;
  };
}
