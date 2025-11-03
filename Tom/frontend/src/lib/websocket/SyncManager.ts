import { api } from '../axios';
import { ConnectionManager } from './ConnectionManager';

export class SyncManager {
  private syncInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = Date.now();

  constructor(private connectionManager: ConnectionManager) {}

  async syncNow(): Promise<void> {
    try {
      this.lastSyncTime = Date.now();
      const response = await api.post('/sync/all');
      console.log('✅ Sincronização completa:', response.data);
    } catch (error) {
      console.debug('Sincronização ignorada:', error);
    }
  }

  startAutoSync(): void {
    this.stopAutoSync();
    
    // Sincronização via WebSocket a cada 30s
    this.syncInterval = setInterval(() => {
      if (this.connectionManager.isConnected()) {
        console.log('🔄 Sincronização WebSocket periódica...');
        this.syncNow();
      }
    }, 30000);
    
    // Polling de fallback a cada 15s
    this.startPolling();
  }

  private startPolling(): void {
    this.stopPolling();
    
    this.pollingInterval = setInterval(async () => {
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      
      if (timeSinceLastSync > 20000) {
        console.log('📡 Polling de fallback...');
        await this.syncNow();
      }
      
      if (!this.connectionManager.isConnected()) {
        console.log('📡 Polling ativo (WebSocket offline)...');
        await this.syncNow();
      }
    }, 15000);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.stopPolling();
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  getTimeSinceLastSync(): number {
    return Date.now() - this.lastSyncTime;
  }
}
