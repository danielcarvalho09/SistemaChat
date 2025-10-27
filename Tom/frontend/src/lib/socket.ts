import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  connect(token: string): Socket {
    this.token = token;

    if (this.socket?.connected) {
      return this.socket;
    }

    // Desconectar socket antigo se existir
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(WS_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,        // Tentar reconectar após 500ms
      reconnectionDelayMax: 3000,    // Máximo de 3 segundos entre tentativas
      reconnectionAttempts: Infinity, // Tentar reconectar infinitamente
      timeout: 10000,                // Timeout de 10 segundos
      autoConnect: true,             // Conectar automaticamente
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ WebSocket desconectado:', reason);
      this.stopHeartbeat();
      
      // Tentar reconectar manualmente se não for desconexão intencional
      if (reason === 'io server disconnect') {
        // Servidor desconectou, reconectar manualmente
        setTimeout(() => {
          if (this.token) {
            console.log('🔄 Tentando reconectar...');
            this.socket?.connect();
          }
        }, 1000);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão WebSocket:', error.message);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconectado após ${attemptNumber} tentativas`);
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Tentativa de reconexão #${attemptNumber}`);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ Erro ao reconectar:', error.message);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Falha ao reconectar após todas as tentativas');
    });

    return this.socket;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Enviar ping a cada 25 segundos para manter conexão viva
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
