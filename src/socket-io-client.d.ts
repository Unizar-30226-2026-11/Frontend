export interface SocketIoClient {
  connected: boolean;
  on(event: string, listener: (payload?: unknown) => void): SocketIoClient;
  once(event: string, listener: (payload?: unknown) => void): SocketIoClient;
  emit(event: string, payload?: unknown): SocketIoClient;
  disconnect(): SocketIoClient;
}

export interface SocketIoConnectOptions {
  transports?: string[];
  auth?: Record<string, string>;
  query?: Record<string, string>;
  timeout?: number;
  reconnection?: boolean;
  autoConnect?: boolean;
}

export interface SocketIoFactory {
  (url: string, options?: SocketIoConnectOptions): SocketIoClient;
}

declare global {
  interface Window {
    io?: SocketIoFactory;
  }
}

export {};
