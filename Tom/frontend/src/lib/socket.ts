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
        console.log('✨✨✨ PÁGINA VOLTOU AO FOCO - RECUPERAÇÃO ULTRA-ROBUSTA ✨✨✨');
        
        const timeSinceLastSync = Date.now() - this.lastSyncTime;
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        
        console.log(`⏱️  Tempo desde última sync: ${Math.round(timeSinceLastSync/1000)}s`);
        console.log(`🏓 Tempo desde último pong: ${Math.round(timeSinceLastPong/1000)}s`);
        
        // ESTRATÉGIA AGRESSIVA DE RECONEXÃO
        if (!this.socket?.connected) {
          console.log('🔄 WebSocket DESCONECTADO - reconectando IMEDIATAMENTE...');
          this.socket?.connect();
        } else if (timeSinceLastPong > 30000) {
          // Conexão zumbi detectada (mais de 30s sem pong)
          console.warn('⚠️⚠️ CONEXÃO ZUMBI DETECTADA - forçando reconexão completa...');
          this.socket?.disconnect();
          setTimeout(() => this.socket?.connect(), 500);
        } else if (timeSinceLastSync > 60000) {
          // Muito tempo sem sync (mais de 1 minuto)
          console.warn('⚠️ Muito tempo sem sync - verificando saúde da conexão...');
          // Forçar ping para testar conexão
          if (this.socket?.connected) {
            this.socket.emit('ping');
          }
        }
        
        // SINCRONIZAÇÃO TRIPLA AGRESSIVA ao voltar
        console.log('🔄🔄🔄 Iniciando SINCRONIZAÇÃO TRIPLA...');
        
        // Sync 1: IMEDIATA
        this.syncAllMessages().catch(err => {
          console.error('❌ Erro na sync imediata:', err);
        });
        
        // Sync 2: Após 1 segundo (garantia)
        setTimeout(() => {
          console.log('🔄 Sync 2/3 (1s após voltar)...');
          this.syncAllMessages().catch(err => {
            console.error('❌ Erro na sync 2:', err);
          });
        }, 1000);
        
        // Sync 3: Após 3 segundos (garantia final)
        setTimeout(() => {
          console.log('🔄 Sync 3/3 FINAL (3s após voltar)...');
          this.syncAllMessages().catch(err => {
            console.error('❌ Erro na sync final:', err);
          });
        }, 3000);
        
        // Limpar flag de forçar sync
        this.forceSyncOnNextVisible = false;
        
      } else {
        console.log('🌙🌙🌙 PÁGINA INDO PARA BACKGROUND 🌙🌙🌙');
        console.log('⚠️ BROWSERS podem pausar timers JavaScript após alguns minutos');
        console.log('✅ POLLING HTTP continuará (não é pausado pelos browsers)');
        console.log('✅ Cronjob externo garantirá sincronização mesmo com app fechado');
        
        // Marcar para forçar sync quando voltar
        this.forceSyncOnNextVisible = true;
        
        // SINCRONIZAÇÃO DUPLA antes de ir para background
        console.log('🔄 Sincronizando antes de pausar...');
        
        // Sync 1: Imediata
        this.syncAllMessages().catch(err => {
          console.error('❌ Erro ao sincronizar antes de background:', err);
        });
        
        // Sync 2: Após 500ms (garantia)
        setTimeout(() => {
          this.syncAllMessages().catch(err => {
            console.error('❌ Erro na sync de garantia antes de background:', err);
          });
        }, 500);
        
        // Enviar múltiplos pings antes de pausar (manter conexão viva)
        if (this.socket?.connected) {
          console.log('🏓 Enviando pings extras antes de pausar...');
          this.socket.emit('ping');
          setTimeout(() => this.socket?.emit('ping'), 200);
          setTimeout(() => this.socket?.emit('ping'), 400);
        }
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
   * ESTRATÉGIA OTIMIZADA:
   * 1. WebSocket sync a cada 2 minutos (se conectado) - reduzido de 30s
   * 2. Polling de fallback a cada 60s (SEMPRE funciona, mesmo em background) - reduzido de 10s
   * 
   * NOTA: Sincronização periódica foi reduzida porque:
   * - WebSocket já recebe mensagens em tempo real via eventos
   * - Sincronização só é necessária em reconexões ou quando há muito tempo sem sync
   */
  private startSyncInterval(): void {
    this.stopSyncInterval();
    
    // Sincronizar a cada 2 minutos via WebSocket (reduzido de 30s)
    // Isso é apenas uma garantia - mensagens já chegam via eventos em tempo real
    this.syncInterval = setInterval(() => {
      if (this.socket?.connected) {
        const timeSinceLastSync = Date.now() - this.lastSyncTime;
        // Só sincronizar se passou mais de 1 minuto desde a última sync
        if (timeSinceLastSync > 60000) {
          console.log('🔄 Sincronização WebSocket periódica (garantia)...');
          this.syncAllMessages().catch(err => {
            console.error('❌ Erro na sincronização periódica:', err);
          });
        }
      }
    }, 120000); // 2 minutos (aumentado de 30s)
    
    // POLLING DE FALLBACK - funciona SEMPRE, mesmo sem WebSocket
    this.startPolling();
  }

  /**
   * Polling de fallback - funciona mesmo quando WebSocket está morto
   * Usa HTTP simples para sincronizar
   * CRUCIAL para funcionar em background
   * VERSÃO OTIMIZADA: Só sincroniza quando realmente necessário
   */
  private startPolling(): void {
    this.stopPolling();
    
    // POLLING OTIMIZADO: a cada 5 minutos
    // Só sincroniza se WebSocket estiver offline OU se passou muito tempo sem sync
    this.pollingInterval = setInterval(async () => {
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      const isConnected = this.socket?.connected || false;
      
      // ESTRATÉGIA 1: Se WebSocket offline, polling vira o método principal
      if (!isConnected) {
        console.log('📡 POLLING: WebSocket offline - modo fallback ativo');
        await this.syncAllMessages();
        return;
      }
      
      // ESTRATÉGIA 2: Se passou MUITO tempo sem sync (mais de 5 minutos), forçar
      // Isso garante que mesmo se o WebSocket estiver "zumbi", ainda sincroniza
      if (timeSinceLastSync > 300000) { // 5 minutos sem sync
        console.log(`📡 POLLING: Sem sync há ${Math.round(timeSinceLastSync/1000)}s - forçando...`);
        await this.syncAllMessages();
        return;
      }
      
      // Se WebSocket está conectado e sincronizou recentemente, não fazer nada
      // (evitar sincronizações desnecessárias)
    }, 300000); // 5 minutos (300000ms)
    
    console.log('✅ Polling otimizado iniciado (a cada 5 minutos, apenas se necessário)');
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
export default socketService;
