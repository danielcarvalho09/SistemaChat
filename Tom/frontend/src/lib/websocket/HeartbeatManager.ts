import { ConnectionManager } from './ConnectionManager';

export class HeartbeatManager {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPongTime: number = Date.now();
  private isPageVisible: boolean = true;

  constructor(private connectionManager: ConnectionManager) {}

  start(): void {
    this.stop();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.connectionManager.isConnected()) {
        console.debug('🏓 Enviando ping...');
        this.connectionManager.emit('ping', {});
        
        if (!this.isPageVisible) {
          console.debug('🌙 Ping extra (background)');
          setTimeout(() => {
            if (this.connectionManager.isConnected()) {
              this.connectionManager.emit('ping', {});
            }
          }, 5000);
        }
      }
    }, 20000); // 20s
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  recordPong(): void {
    this.lastPongTime = Date.now();
  }

  getTimeSinceLastPong(): number {
    return Date.now() - this.lastPongTime;
  }

  setPageVisibility(isVisible: boolean): void {
    this.isPageVisible = isVisible;
  }
}
