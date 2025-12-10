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
  private rateLimitCooldownUntil: number = 0; // Timestamp até quando não deve sincronizar devido a rate limit
  private isSyncing: boolean = false; // Flag para evitar múltiplas sincronizações simultâneas

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
      
      // Sincronizar mensagens ao conectar/reconectar (apenas se não estiver em cooldown)
      // Verificar se realmente é uma reconexão (última sync há mais de 1 minuto)
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      const isInRateLimitCooldown = Date.now() < this.rateLimitCooldownUntil;
      
      if (!isInRateLimitCooldown && timeSinceLastSync > 60000) { // Só sincronizar se passou mais de 1 minuto
        console.log('🔄 WebSocket conectado - sincronizando...');
        this.syncAllMessages().catch(err => {
          console.error('❌ Erro ao sincronizar mensagens ao conectar:', err);
        });
      } else if (isInRateLimitCooldown) {
        const remainingMinutes = Math.ceil((this.rateLimitCooldownUntil - Date.now()) / 1000 / 60);
        console.log(`⏭️ WebSocket conectado mas em cooldown (${remainingMinutes}min restantes) - pulando sincronização`);
      } else {
        console.log('ℹ️ WebSocket conectado mas sincronização recente - não é necessário sincronizar');
      }
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
      
      // Sincronizar ao reconectar (apenas se não estiver em cooldown)
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      const isInRateLimitCooldown = Date.now() < this.rateLimitCooldownUntil;
      
      if (!isInRateLimitCooldown && timeSinceLastSync > 60000) { // Só sincronizar se passou mais de 1 minuto
        console.log('🔄 WebSocket reconectado - sincronizando...');
        this.syncAllMessages().catch(err => {
          console.error('❌ Erro ao sincronizar após reconexão:', err);
        });
      } else if (isInRateLimitCooldown) {
        const remainingMinutes = Math.ceil((this.rateLimitCooldownUntil - Date.now()) / 1000 / 60);
        console.log(`⏭️ WebSocket reconectado mas em cooldown (${remainingMinutes}min restantes) - pulando sincronização`);
      } else {
        console.log('ℹ️ WebSocket reconectado mas sincronização recente - não é necessário sincronizar');
      }
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
        
        // ESTRATÉGIA OTIMIZADA DE RECONEXÃO (sem sincronizações múltiplas)
        if (!this.socket?.connected) {
          console.log('🔄 WebSocket DESCONECTADO - reconectando...');
          this.socket?.connect();
        } else if (timeSinceLastPong > 30000) {
          // Conexão zumbi detectada (mais de 30s sem pong)
          console.warn('⚠️ CONEXÃO ZUMBI DETECTADA - forçando reconexão completa...');
          this.socket?.disconnect();
          setTimeout(() => this.socket?.connect(), 500);
        } else if (timeSinceLastPong > 60000) {
          // Muito tempo sem pong - apenas ping para testar conexão
          console.log('⚠️ Muito tempo sem pong - testando conexão...');
          if (this.socket?.connected) {
            this.socket.emit('ping');
          }
        }
        
        // Sincronização única e condicional ao voltar (apenas se necessário e não estiver em cooldown)
        // timeSinceLastSync já foi declarado acima, reutilizar
        const isInRateLimitCooldown = Date.now() < this.rateLimitCooldownUntil;
        
        if (!isInRateLimitCooldown && timeSinceLastSync > 300000) { // Só sincronizar se passou mais de 5 minutos
          console.log('🔄 Página voltou ao foco - sincronizando (última sync há mais de 5min)...');
          this.syncAllMessages().catch(err => {
            console.error('❌ Erro na sincronização:', err);
          });
        } else if (isInRateLimitCooldown) {
          const remainingCooldown = Math.ceil((this.rateLimitCooldownUntil - Date.now()) / 1000 / 60);
          console.log(`⏭️ Em cooldown de rate limit (${remainingCooldown}min restantes) - pulando sincronização`);
        } else {
          console.log('ℹ️ Sincronização recente, não é necessário sincronizar novamente');
        }
        
        // Limpar flag de forçar sync
        this.forceSyncOnNextVisible = false;
        
      } else {
        console.log('🌙 Página indo para background');
        // Não sincronizar ao ir para background - o polling cuidará disso
        // Marcar para verificar quando voltar (mas sem forçar sync imediata)
        this.forceSyncOnNextVisible = false;
        
        // Apenas um ping para manter conexão viva
        if (this.socket?.connected) {
          this.socket.emit('ping');
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
    
    // Sincronizar a cada 10 minutos via WebSocket (aumentado para evitar rate limit)
    // Isso é apenas uma garantia - mensagens já chegam via eventos em tempo real
    this.syncInterval = setInterval(() => {
      if (this.socket?.connected) {
        const timeSinceLastSync = Date.now() - this.lastSyncTime;
        const isInRateLimitCooldown = Date.now() < this.rateLimitCooldownUntil;
        
        // Só sincronizar se passou mais de 10 minutos desde a última sync e não está em cooldown
        if (!isInRateLimitCooldown && timeSinceLastSync > 600000) { // 10 minutos
          console.log('🔄 Sincronização WebSocket periódica (garantia)...');
          this.syncAllMessages().catch(err => {
            console.error('❌ Erro na sincronização periódica:', err);
          });
        }
      }
    }, 600000); // 10 minutos (aumentado de 2 minutos para evitar rate limit)
    
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
    // E respeita cooldown de rate limit
    this.pollingInterval = setInterval(async () => {
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      const isConnected = this.socket?.connected || false;
      const isInRateLimitCooldown = Date.now() < this.rateLimitCooldownUntil;
      
      // Se está em cooldown de rate limit, não fazer nada
      if (isInRateLimitCooldown) {
        const remainingMinutes = Math.ceil((this.rateLimitCooldownUntil - Date.now()) / 1000 / 60);
        console.log(`📡 POLLING: Em cooldown de rate limit (${remainingMinutes}min restantes) - pulando`);
        return;
      }
      
      // ESTRATÉGIA 1: Se WebSocket offline, polling vira o método principal
      if (!isConnected) {
        console.log('📡 POLLING: WebSocket offline - modo fallback ativo');
        await this.syncAllMessages();
        return;
      }
      
      // ESTRATÉGIA 2: Se passou MUITO tempo sem sync (mais de 10 minutos), forçar
      // Isso garante que mesmo se o WebSocket estiver "zumbi", ainda sincroniza
      // Aumentado para 10 minutos para evitar rate limit
      if (timeSinceLastSync > 600000) { // 10 minutos sem sync
        console.log(`📡 POLLING: Sem sync há ${Math.round(timeSinceLastSync/1000/60)}min - forçando...`);
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
    // Evitar múltiplas sincronizações simultâneas
    if (this.isSyncing) {
      console.log('⏭️ Sincronização já em andamento, ignorando...');
      return;
    }

    // Verificar se está em cooldown de rate limit
    if (Date.now() < this.rateLimitCooldownUntil) {
      const remainingMinutes = Math.ceil((this.rateLimitCooldownUntil - Date.now()) / 1000 / 60);
      console.log(`⏭️ Em cooldown de rate limit (${remainingMinutes}min restantes) - pulando sincronização`);
      return;
    }

    this.isSyncing = true;
    
    try {
      this.lastSyncTime = Date.now();
      
      // Chamar endpoint de sincronização geral
      const response = await api.post('/sync/all');
      console.log('✅ Sincronização completa:', response.data);
      
      // Se estava marcado para forçar sync, limpar flag
      this.forceSyncOnNextVisible = false;
      
      // Resetar cooldown de rate limit em caso de sucesso
      this.rateLimitCooldownUntil = 0;
    } catch (error: any) {
      // Tratar erro 429 (Too Many Requests)
      if (error?.response?.status === 429) {
        const retryAfter = error?.response?.data?.message || '';
        // Extrair minutos do retry message (ex: "retry in 9 minutes")
        const match = retryAfter.match(/(\d+)\s*minute/i);
        const minutes = match ? parseInt(match[1]) : 10; // Default 10 minutos se não conseguir extrair
        const cooldownMs = minutes * 60 * 1000;
        
        this.rateLimitCooldownUntil = Date.now() + cooldownMs;
        console.warn(`⚠️ Rate limit atingido - cooldown de ${minutes} minutos ativado`);
        console.warn(`⏭️ Próxima sincronização permitida em ${minutes} minutos`);
        
        // Não tentar sincronizar novamente durante o cooldown
        return;
      }
      
      // Silenciar outros erros (não autenticado, sem permissão, etc)
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        console.debug('Sincronização ignorada:', error);
      }
    } finally {
      this.isSyncing = false;
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
   * Respeita rate limit mesmo quando chamada manualmente
   */
  async forceSyncNow(): Promise<void> {
    const isInRateLimitCooldown = Date.now() < this.rateLimitCooldownUntil;
    
    if (isInRateLimitCooldown) {
      const remainingMinutes = Math.ceil((this.rateLimitCooldownUntil - Date.now()) / 1000 / 60);
      console.warn(`⚠️ Sincronização manual bloqueada - em cooldown de rate limit (${remainingMinutes}min restantes)`);
      throw new Error(`Rate limit ativo. Aguarde ${remainingMinutes} minutos.`);
    }
    
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
