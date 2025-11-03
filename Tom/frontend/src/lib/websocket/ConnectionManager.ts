import { Socket, io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export class ConnectionManager {
  private socket: Socket | null = null;
  private token: string | null = null;
  public reconnectAttempts: number = 0;
  private readonly maxReconnectDelay = 30000;

  connect(token: string): Socket {
    this.token = token;

    if (this.socket?.connected) {
      console.log('✅ Socket já conectado');
      return this.socket;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: this.maxReconnectDelay,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      autoConnect: true,
      forceNew: true,
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback);
  }

  forceReconnect(): void {
    console.log('🔄 Forçando reconexão...');
    if (this.socket) {
      this.socket.disconnect();
      setTimeout(() => {
        this.socket?.connect();
      }, 500);
    }
  }
}
