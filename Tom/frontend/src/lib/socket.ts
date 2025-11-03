import { io, Socket } from 'socket.io-client';
import { api } from './axios';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectDelay: number = 30000; // 30 segundos máximo entre tentativas
  private lastPongTime: number = Date.now();
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private isPageVisible: boolean = true;
  private visibilityListenerAdded: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = Date.now();
  private forceSyncOnNextVisible: boolean = false;

  connect(token: string): Socket {
    this.token = token;

    if (this.socket?.connected) {
      console.log('✅ Socket já conectado, reutilizando...');
      return this.socket;
    }

    // Desconectar socket antigo se existir
    if (this.socket) {
      console.log('🔄 Desconectando socket antigo...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    console.log(`🔌 Conectando ao WebSocket: ${WS_URL}`);
    
    this.socket = io(WS_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,        // Começar com 1s
      reconnectionDelayMax: 30000,    // Máximo de 30 segundos entre tentativas
      reconnectionAttempts: Infinity, // NUNCA DESISTIR de reconectar
      timeout: 20000,                 // Timeout de 20 segundos
      autoConnect: true,              // Conectar automaticamente
      forceNew: true,                 // Forçar nova conexão
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0; // Reset contador de tentativas
      this.startHeartbeat();
      this.startSyncInterval();
      
      // Sincronizar mensagens imediatamente ao conectar/reconectar
      this.syncAllMessages().catch(err => {
        console.error('❌ Erro ao sincronizar mensagens ao conectar:', err);
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ WebSocket desconectado:', reason);
      this.stopHeartbeat();
      this.stopSyncInterval();
      
      // SEMPRE tentar reconectar, independente do motivo
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
      this.reconnectAttempts++;
      
      console.log(`🔄 Tentando reconectar em ${delay/1000}s (tentativa #${this.reconnectAttempts})...`);
      
      setTimeout(() => {
        if (this.token && this.socket) {
          this.socket.connect();
        }
      }, delay);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão WebSocket:', error.message);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconectado após ${attemptNumber} tentativas`);
      this.reconnectAttempts = 0;
      // Sincronizar ao reconectar
      this.syncAllMessages().catch(err => {
        console.error('❌ Erro ao sincronizar após reconexão:', err);
      });
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

    // Escutar pong do servidor
    this.socket.on('pong', () => {
      this.lastPongTime = Date.now();
      console.debug('🏓 Pong recebido');
    });

    // Escutar ping do servidor e responder automaticamente
    this.socket.on('server_ping', () => {
      this.lastPongTime = Date.now();
      console.debug('🏓 Server ping recebido - respondendo...');
      if (this.socket?.connected) {
        this.socket.emit('client_pong');
      }
    });

    // Configurar Page Visibility API (funciona mesmo em background)
    this.setupPageVisibilityListener();

    // Configurar listeners de rede
    this.setupNetworkListeners();

    // Iniciar verificação de conexão
    this.startConnectionCheck();

    return this.socket;
  }

  /**
   * Configura listener para Page Visibility API
   * Detecta quando página vai para background/foreground
   */
  private setupPageVisibilityListener(): void {
    if (this.visibilityListenerAdded || typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      this.isPageVisible = !document.hidden;
      
      if (this.isPageVisible) {
        console.log('✨ PÁGINA VOLTOU AO FOCO - INICIANDO RECUPERAÇÃO COMPLETA...');
        
        const timeSinceLastSync = Date.now() - this.lastSyncTime;
        console.log(`⏱️  Tempo desde última sync: ${Math.round(timeSinceLastSync/1000)}s`);
        
        // SEMPRE forçar reconexão ao voltar
        // Mesmo que pareça conectado, pode ser conexão zumbi
        if (!this.socket?.connected) {
          console.log('🔄 WebSocket desconectado - reconectando...');
          this.socket?.connect();
        } else {
          const timeSinceLastPong = Date.now() - this.lastPongTime;
          console.log(`🏓 Último pong: ${Math.round(timeSinceLastPong/1000)}s atrás`);
          
          // Se passou muito tempo sem pong, assumir conexão morta
          if (timeSinceLastPong > 30000) { // 30 segundos sem pong
            console.warn('⚠️ Conexão provavelmente morta - forçando reconexão...');
            this.socket?.disconnect();
            setTimeout(() => this.socket?.connect(), 500);
          }
        }
        
        // SEMPRE sincronizar ao voltar, independente do estado
        console.log('🔄 Forçando sincronização IMEDIATA ao voltar...');
        this.syncAllMessages().catch(err => {
          console.error('❌ Erro ao sincronizar:', err);
        });
        
        // Forçar sync duplo após 2 segundos (garantia)
        setTimeout(() => {
          console.log('🔄 Sincronização de garantia (2s após voltar)...');
          this.syncAllMessages().catch(err => {
            console.error('❌ Erro na sync de garantia:', err);
          });
        }, 2000);
        
      } else {
        console.log('🌙 PáGINA FOI PARA BACKGROUND');
        console.log('⚠️ AVISO: Browsers podem pausar timers após alguns minutos');
        console.log('✅ Polling de fallback continuará funcionando');
        
        // Marcar para forçar sync quando voltar
        this.forceSyncOnNextVisible = true;
        
        // Enviar ping extra antes de ir para background
        if (this.socket?.connected) {
          console.log('🏓 Enviando ping extra antes de pausar...');
          this.socket.emit('ping');
        }
        
        // Sincronizar antes de ir para background
        this.syncAllMessages().catch(err => {
          console.error('❌ Erro ao sincronizar antes de background:', err);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.visibilityListenerAdded = true;
    console.log('✅ Page Visibility API configurada');
  }

  /**
   * Configura listeners para mudanças de rede
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Detectar quando rede volta online
    window.addEventListener('online', () => {
      console.log('🌐 Rede voltou online - reconectando...');
      if (!this.socket?.connected && this.token) {
        this.socket?.connect();
      }
    });

    // Detectar quando rede cai
    window.addEventListener('offline', () => {
      console.warn('📵 Rede offline detectada');
    });
  }

  /**
   * Inicia verificação periódica de conexão
   * Verifica se está recebendo pongs do servidor
   */
  private startConnectionCheck(): void {
    this.stopConnectionCheck();
    
    // Verificar a cada 30 segundos se conexão está viva
    this.connectionCheckInterval = setInterval(() => {
      if (!this.socket?.connected) {
        return;
      }

      const timeSinceLastPong = Date.now() - this.lastPongTime;
      
      // Se passou mais de 2 minutos sem pong, reconectar
      if (timeSinceLastPong > 120000) {
        console.warn('⚠️ Sem resposta do servidor há 2 minutos - forçando reconexão...');
        this.socket.disconnect();
        setTimeout(() => this.socket?.connect(), 1000);
      }
    }, 30000); // Verificar a cada 30 segundos
  }

  private stopConnectionCheck(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Enviar ping a cada 20 segundos (mais agressivo)
    // Funciona mesmo em background na maioria dos browsers
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        console.debug('🏓 Enviando ping...');
        this.socket.emit('ping');
        
        // Se página está em background, forçar múltiplos pings
        if (!this.isPageVisible) {
          console.debug('🌙 Página em background - enviando ping extra');
          setTimeout(() => {
            if (this.socket?.connected) {
              this.socket.emit('ping');
            }
          }, 5000);
        }
      }
    }, 20000); // 20 segundos
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Inicia sincronização automática periódica
   * ESTRATÉGIA DUPLA:
   * 1. WebSocket sync a cada 30s (se conectado)
   * 2. Polling de fallback a cada 15s (SEMPRE funciona, mesmo em background)
   */
  private startSyncInterval(): void {
    this.stopSyncInterval();
    
    // Sincronizar a cada 30 segundos via WebSocket
    this.syncInterval = setInterval(() => {
      if (this.socket?.connected) {
        console.log('🔄 Sincronização WebSocket periódica...');
        this.syncAllMessages().catch(err => {
          console.error('❌ Erro na sincronização periódica:', err);
        });
      }
    }, 30000); // 30 segundos
    
    // POLLING DE FALLBACK - funciona SEMPRE, mesmo sem WebSocket
    this.startPolling();
  }

  /**
   * Polling de fallback - funciona mesmo quando WebSocket está morto
   * Usa HTTP simples para sincronizar
   * CRUCIAL para funcionar em background
   */
  private startPolling(): void {
    this.stopPolling();
    
    // Polling a cada 15 segundos
    // Mais frequente que sync normal porque é o fallback
    this.pollingInterval = setInterval(async () => {
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      
      // Se passou mais de 20 segundos sem sync, forçar via polling
      if (timeSinceLastSync > 20000) {
        console.log('📡 Polling de fallback ativado (sem sync recente)...');
        await this.syncAllMessages();
      }
      
      // Se WebSocket não está conectado, usar polling como principal
      if (!this.socket?.connected) {
        console.log('📡 Polling ativo (WebSocket offline)...');
        await this.syncAllMessages();
      }
    }, 15000); // 15 segundos
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sincroniza todas as mensagens de todas as conexões ativas
   * FUNCIONA VIA HTTP - NÃO DEPENDE DE WEBSOCKET
   */
  private async syncAllMessages(): Promise<void> {
    try {
      this.lastSyncTime = Date.now();
      
      // Chamar endpoint de sincronização geral
      const response = await api.post('/sync/all');
      console.log('✅ Sincronização completa:', response.data);
      
      // Se estava marcado para forçar sync, limpar flag
      this.forceSyncOnNextVisible = false;
    } catch (error) {
      // Silenciar erro se não autenticado ou sem permissão
      console.debug('Sincronização ignorada:', error);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.stopSyncInterval();
    this.stopPolling();
    this.stopConnectionCheck();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }

  /**
   * Força reconexão imediata
   * Útil para debug e testes
   */
  forceReconnect(): void {
    console.log('🔄 Forçando reconexão imediata...');
    if (this.socket) {
      this.socket.disconnect();
      setTimeout(() => {
        this.socket?.connect();
      }, 500);
    }
  }

  /**
   * Retorna status detalhado da conexão
   */
  getConnectionStatus(): { 
    connected: boolean; 
    lastPong: number; 
    lastSync: number;
    pageVisible: boolean;
    reconnectAttempts: number;
  } {
    return {
      connected: this.socket?.connected || false,
      lastPong: Date.now() - this.lastPongTime,
      lastSync: Date.now() - this.lastSyncTime,
      pageVisible: this.isPageVisible,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Força sincronização manual completa
   * Pública para uso em componentes
   */
  async forceSyncNow(): Promise<void> {
    console.log('🔄 Sincronização MANUAL forçada...');
    await this.syncAllMessages();
    console.log('✅ Sincronização manual completa');
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

// NOVO: Service refatorado com melhor arquitetura (SRP)
// Para usar: import { socketServiceRefactored } from './socket'
export { socketServiceRefactored } from './websocket/SocketServiceRefactored';

export default socketService;
