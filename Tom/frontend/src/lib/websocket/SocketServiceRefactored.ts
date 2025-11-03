import { ConnectionManager } from './ConnectionManager';
import { HeartbeatManager } from './HeartbeatManager';
import { SyncManager } from './SyncManager';

/**
 * Facade Pattern - Interface simplificada para gerenciar WebSocket
 * Decomposto em múltiplos managers para seguir SRP (Single Responsibility Principle)
 */
export class SocketServiceRefactored {
  private connectionManager: ConnectionManager;
  private heartbeatManager: HeartbeatManager;
  private syncManager: SyncManager;

  constructor() {
    this.connectionManager = new ConnectionManager();
    this.heartbeatManager = new HeartbeatManager(this.connectionManager);
    this.syncManager = new SyncManager(this.connectionManager);
  }

  connect(token: string): void {
    const socket = this.connectionManager.connect(token);

    // Setup event listeners
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      this.connectionManager.reconnectAttempts = 0;
      this.heartbeatManager.start();
      this.syncManager.startAutoSync();
      this.syncManager.syncNow();
    });

    socket.on('disconnect', (reason: any) => {
      console.warn('⚠️ WebSocket desconectado:', reason);
      this.heartbeatManager.stop();
      this.syncManager.stopAutoSync();
      
      const delay = Math.min(
        1000 * Math.pow(2, this.connectionManager.reconnectAttempts),
        30000
      );
      this.connectionManager.reconnectAttempts++;
      
      console.log(`🔄 Reconectando em ${delay/1000}s...`);
      setTimeout(() => this.connectionManager.getSocket()?.connect(), delay);
    });

    socket.on('pong', () => {
      this.heartbeatManager.recordPong();
    });

    socket.on('server_ping', () => {
      this.heartbeatManager.recordPong();
      this.connectionManager.emit('client_pong', {});
    });

    socket.on('reconnect', () => {
      console.log('✅ Reconectado');
      this.connectionManager.reconnectAttempts = 0;
      this.syncManager.syncNow();
    });

    // Page Visibility
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const isVisible = !document.hidden;
        this.heartbeatManager.setPageVisibility(isVisible);
        
        if (isVisible) {
          console.log('✨ Página voltou ao foco');
          if (!this.connectionManager.isConnected()) {
            this.connectionManager.forceReconnect();
          }
          this.syncManager.syncNow();
          setTimeout(() => this.syncManager.syncNow(), 2000);
        } else {
          console.log('🌙 Página em background');
          this.connectionManager.emit('ping', {});
          this.syncManager.syncNow();
        }
      });
    }

    // Network listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Rede online');
        if (!this.connectionManager.isConnected()) {
          this.connectionManager.forceReconnect();
        }
      });
    }
  }

  disconnect(): void {
    this.heartbeatManager.stop();
    this.syncManager.stopAutoSync();
    this.connectionManager.disconnect();
  }

  emit(event: string, data: any): void {
    this.connectionManager.emit(event, data);
  }

  on(event: string, callback: (...args: any[]) => void): void {
    this.connectionManager.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.connectionManager.off(event, callback);
  }

  forceReconnect(): void {
    this.connectionManager.forceReconnect();
  }

  async forceSyncNow(): Promise<void> {
    await this.syncManager.syncNow();
  }

  getConnectionStatus() {
    return {
      connected: this.connectionManager.isConnected(),
      lastPong: this.heartbeatManager.getTimeSinceLastPong(),
      lastSync: this.syncManager.getTimeSinceLastSync(),
      reconnectAttempts: this.connectionManager.reconnectAttempts,
    };
  }

  getSocket() {
    return this.connectionManager.getSocket();
  }
}

// Export singleton
export const socketServiceRefactored = new SocketServiceRefactored();
