import makeWASocket, {
  DisconnectReason,
  WASocket,
  ConnectionState,
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
  downloadMediaMessage,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger.js';
import { getSocketServer } from '../websocket/socket.server.js';
import { getPrismaClient } from '../config/database.js';
import { supabaseStorageService } from '../services/supabase-storage.service.js';


export class ClientCreationInProgressError extends Error {
  constructor(connectionId: string) {
    super(`Client creation already in progress for ${connectionId}`);
    this.name = 'ClientCreationInProgressError';
  }
}

/**
 * Interface do cliente Baileys
 */
export interface BaileysClient {
  id: string;
  socket: WASocket;
  qrCode?: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr';
  lastMessageReceived?: Date;
  keepAliveInterval?: NodeJS.Timeout;
  heartbeatInterval?: NodeJS.Timeout; // Heartbeat ativo para manter conexão viva
  syncInterval?: NodeJS.Timeout; // Sincronização periódica de mensagens
  connectingTimeout?: NodeJS.Timeout; // Timeout para detectar conexão travada em "connecting"
  hasCredentials?: boolean; // Indica se tem credenciais salvas (já foi conectado antes)
  reconnectAttempts?: number; // Contador de tentativas de reconexão
  isReconnecting?: boolean; // Flag para evitar múltiplas reconexões simultâneas
  lastHeartbeat?: Date; // Última vez que o heartbeat foi bem-sucedido
  lastSync?: Date; // Última vez que sincronizou mensagens
  lastDisconnectAt?: Date | null;
  lastSyncFrom?: Date | null;
  lastSyncTo?: Date | null;
}

interface QuotedMessagePayload {
  stanzaId: string;
  messageId: string;
  messageType: string;
  content: string;
  mediaUrl: string | null;
  isFromContact: boolean;
  metadata?: any;
}

interface SendMessageOptions {
  quotedMessage?: QuotedMessagePayload;
}

type IncomingRetryItem = {
  connectionId: string;
  from: string;
  messageText: string;
  messageType: string;
  mediaUrl: string | null;
  isFromMe: boolean;
  externalId: string;
  pushName: string | null;
  senderName: string | null; // ✅ Nome do remetente (para grupos)
  quotedContext?: {
    stanzaId?: string;
    participant?: string;
    quotedMessage?: any;
  };
  retries: number;
  lastAttempt: Date;
};


class BaileysManager {
  private clients: Map<string, BaileysClient> = new Map();
  private prisma = getPrismaClient();
  private reconnectionLocks: Map<string, { locked: boolean; lockedAt: Date }> = new Map(); 
  private syncRetryQueue: Map<string, IncomingRetryItem> = new Map(); 
  private readonly MAX_RECONNECT_ATTEMPTS = 5; 
  private readonly QR_RESET_DELAY_MS = 2000;
  private readonly LOCK_TIMEOUT_MS = 180000; 
  private circuitBreaker: Map<string, { failures: number; lastFailure: Date; state: 'closed' | 'open' | 'half-open' }> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; 
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; 

  /**
   * Cria um novo cliente Baileys para uma conexão
   * Implementa auth state persistente no PostgreSQL conforme docs
   */
  async createClient(connectionId: string): Promise<BaileysClient> {
    const createStartTime = new Date();
    try {
      logger.info(`[Baileys] 🚀 ========== INICIANDO CRIAÇÃO DE CLIENTE ==========`);
      logger.info(`[Baileys] 📅 Timestamp: ${createStartTime.toISOString()}`);
      logger.info(`[Baileys] 🔗 Connection ID: ${connectionId}`);

      // Verificar se já está em processo de criação/reconexão
      const existingLock = this.reconnectionLocks.get(connectionId);
      if (existingLock && existingLock.locked) {
        // Verificar se o lock expirou (timeout de segurança)
        const lockAge = Date.now() - existingLock.lockedAt.getTime();
        if (lockAge > this.LOCK_TIMEOUT_MS) {
          logger.warn(`[Baileys] ⚠️ Lock expired for ${connectionId} (${Math.round(lockAge / 1000)}s old) - releasing and retrying`);
          this.reconnectionLocks.delete(connectionId);
        } else {
          logger.warn(`[Baileys] ⚠️ Client ${connectionId} is already being created/reconnected (lock age: ${Math.round(lockAge / 1000)}s), skipping...`);
        throw new ClientCreationInProgressError(connectionId);
        }
      }

      // Verificar se cliente já existe e está conectado
      const existingClient = this.clients.get(connectionId);
      if (existingClient && existingClient.status === 'connected') {
        logger.info(`[Baileys] ✅ Client ${connectionId} already exists and is connected - returning existing client`);
        return existingClient;
      }

      // Marcar como em processo de criação (com timestamp)
      const lockTime = new Date();
      this.reconnectionLocks.set(connectionId, {
        locked: true,
        lockedAt: lockTime,
      });
      logger.info(`[Baileys] 🔒 Lock criado para ${connectionId} em ${lockTime.toISOString()}`);

      // Remover cliente existente se houver (se não estiver conectado)
      // Usar a mesma variável existingClient já declarada acima
      if (existingClient && existingClient.status !== 'connected') {
        logger.warn(`[Baileys] ⚠️ Client ${connectionId} already exists but status is '${existingClient.status}', removing...`);
        await this.removeClient(connectionId, false); // false = não fazer logout
      }

      // Carregar ou criar auth state do banco de dados
      logger.info(`[Baileys] 🔑 Carregando credenciais do banco para ${connectionId}...`);
      const { state, saveCreds } = await this.usePostgreSQLAuthState(connectionId);
      logger.info(`[Baileys] ✅ Credenciais carregadas para ${connectionId}`);

      // Criar socket Baileys conforme documentação
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['WhatsApp Multi-Device', 'Chrome', '1.0.0'],
        syncFullHistory: false, // Desabilitado: só sincronizar mensagens a partir da primeira conexão
        markOnlineOnConnect: true, // Marcar como online ao conectar (IMPORTANTE para manter conexão)
        // Configurações otimizadas para melhorar estabilidade da conexão
        connectTimeoutMs: 120000, // Timeout de 120s para conectar (aumentado para mais estabilidade)
        defaultQueryTimeoutMs: 120000, // Timeout para queries (aumentado)
        keepAliveIntervalMs: 20000, // Pings a cada 20s (mais frequente para manter conexão viva)
        retryRequestDelayMs: 500, // Delay mínimo entre tentativas (aumentado para evitar sobrecarga)
        emitOwnEvents: true, // Emitir eventos de mensagens enviadas por nós
        fireInitQueries: true, // Executar queries iniciais ao conectar
        getMessage: async (key) => {
          // Buscar mensagem do banco pelo externalId para histórico
          try {
            const msg = await this.prisma.message.findFirst({
              where: { externalId: key.id as string },
              select: { content: true, messageType: true },
            });
            if (msg) {
              return { conversation: msg.content } as any;
            }
          } catch (error) {
            logger.debug(`Could not fetch message ${key.id} from database`);
          }
          return undefined;
        },
      });

      // Verificar se tem credenciais salvas (reconexão vs nova conexão)
      const connectionData = await this.prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        select: { authData: true, lastDisconnectReason: true },
      });
      const hasCredentials = connectionData?.authData ? true : false;
      
      logger.info(`[Baileys] 📋 Informações da conexão:`);
      logger.info(`[Baileys]    - Tem credenciais: ${hasCredentials ? 'SIM' : 'NÃO'}`);
      if (connectionData?.lastDisconnectReason) {
        logger.info(`[Baileys]    - Último motivo de desconexão: ${connectionData.lastDisconnectReason}`);
      }
      
      const client: BaileysClient = {
        id: connectionId,
        socket,
        status: 'connecting',
        hasCredentials,
        reconnectAttempts: 0,
        isReconnecting: false,
      };

      this.clients.set(connectionId, client);
      logger.info(`[Baileys] ✅ Cliente criado e adicionado ao mapa. Status: 'connecting'`);

      // Event: Salvar credenciais quando atualizadas
      socket.ev.on('creds.update', saveCreds);

      // Event: Atualização de conexão
      socket.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(connectionId, update);
      });

      // Event: Mensagens recebidas (tempo real e sync)
      socket.ev.on('messages.upsert', async (m) => {
        logger.info(`[Baileys] 📨 Event 'messages.upsert' recebido para ${connectionId} - ${m.messages?.length || 0} mensagens`);
        await this.handleIncomingMessages(connectionId, m);
      });
      
      // ✅ LOG: Confirmar que listener foi registrado
      logger.info(`[Baileys] ✅ Listener 'messages.upsert' registrado para ${connectionId}`);

      // Event: Sincronização de histórico (mensagens antigas)
      // Baseado em: https://baileys.wiki/docs/socket/history-sync
      socket.ev.on('messaging-history.set', async ({ chats, contacts, messages, syncType }) => {
        logger.info(`[Baileys] 📚 History sync received for ${connectionId}:`);
        logger.info(`  - Messages: ${messages?.length || 0}`);
        logger.info(`  - Chats: ${chats?.length || 0}`);
        logger.info(`  - Contacts: ${contacts?.length || 0}`);
        logger.info(`  - Sync Type: ${syncType || 'unknown'}`);
        
        // Armazenar chats e contacts conforme documentação
        if (chats && chats.length > 0) {
          await this.handleHistoryChats(connectionId, chats);
        }
        
        if (contacts && contacts.length > 0) {
          await this.handleHistoryContacts(connectionId, contacts);
        }
        
          // Processar mensagens do histórico
        if (messages && messages.length > 0) {
          await this.handleIncomingMessages(connectionId, {
            messages,
            type: 'history',
          });
        }
      });


      // Event: Atualização de status de mensagens (delivered, read)
      socket.ev.on('messages.update', async (updates) => {
        await this.handleMessageStatusUpdate(connectionId, updates);
      });

      // Iniciar monitoramento de conexão
      this.startConnectionMonitoring(connectionId);
      
      // Iniciar heartbeat ativo
      this.startActiveHeartbeat(connectionId);
      
      // Sincronização periódica leve como backup (funciona independente do frontend)
      this.startPeriodicSync(connectionId);
      
      

      logger.info(`[Baileys] ✅ Client created successfully: ${connectionId}`);
      
      // Liberar lock após criação bem-sucedida
      this.reconnectionLocks.delete(connectionId);
      
      const createEndTime = new Date();
      const createDuration = Math.round((createEndTime.getTime() - createStartTime.getTime()) / 1000);
      logger.info(`[Baileys] ✅ ========== CLIENTE CRIADO COM SUCESSO ==========`);
      logger.info(`[Baileys] 📅 Timestamp: ${createEndTime.toISOString()}`);
      logger.info(`[Baileys] ⏱️ Duração: ${createDuration} segundos`);
      logger.info(`[Baileys] 🔗 Connection ID: ${connectionId}`);
      logger.info(`[Baileys] ===========================================`);
      
      return client;
    } catch (error) {
      const errorTime = new Date();
      const errorDuration = Math.round((errorTime.getTime() - createStartTime.getTime()) / 1000);
      
      // ✅ LOGS DETALHADOS DE ERRO
      logger.error(`[Baileys] ❌ ========== ERRO AO CRIAR CLIENTE ==========`);
      logger.error(`[Baileys] 📅 Timestamp: ${errorTime.toISOString()}`);
      logger.error(`[Baileys] ⏱️ Duração até erro: ${errorDuration} segundos`);
      logger.error(`[Baileys] 🔗 Connection ID: ${connectionId}`);
      logger.error(`[Baileys] ❌ Tipo de erro: ${error instanceof Error ? error.constructor.name : typeof error}`);
      logger.error(`[Baileys] 💬 Mensagem: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        logger.error(`[Baileys] 📋 Stack trace:`, error.stack);
      }
      logger.error(`[Baileys] ===========================================`);
      
      // ✅ LIBERAR LOCK EM CASO DE ERRO (sempre garantir liberação)
      this.reconnectionLocks.delete(connectionId);
      logger.info(`[Baileys] 🔓 Lock liberado para ${connectionId} após erro`);
      
      // Se for ClientCreationInProgressError, não fazer mais nada
      if (error instanceof ClientCreationInProgressError) {
        logger.warn(`[Baileys] ⚠️ Criação já em progresso para ${connectionId} (após ${errorDuration}s)`);
        throw error; // Re-throw para que o chamador saiba que é um erro esperado
      }
      
      // ✅ Emitir evento de falha de conexão
      try {
        const socketServer = getSocketServer();
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao criar cliente';
        socketServer.emitWhatsAppConnectionFailed(connectionId, errorMessage);
        
        // Atualizar status no banco
        await this.updateConnectionStatus(connectionId, 'disconnected');
        this.emitStatus(connectionId, 'disconnected');
      } catch (emitError) {
        logger.error(`[Baileys] ❌ Erro ao emitir evento de falha:`, emitError);
      }
      
      throw error;
    }
  }

  /**
   * Implementa auth state persistente no PostgreSQL
   * Baseado em: https://baileys.wiki/docs/socket/configuration#auth
   * 
   * ⚠️ CRIPTOGRAFIA REMOVIDA: Estava impedindo reconexão automática
   * As credenciais agora são salvas sem criptografia para garantir reconexão
   */
  private async usePostgreSQLAuthState(connectionId: string) {
    // Buscar credenciais salvas do banco
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
    });

    let creds: AuthenticationState['creds'];
    let keys: Record<string, any> = {};

    // ✅ VERIFICAÇÃO ROBUSTA: Verificar se authData existe E não está vazio
    if (connection?.authData && connection.authData !== null && connection.authData !== '') {
      // Carregar credenciais existentes
      try {
        const authDataString = connection.authData as string;
        
        // Verificar se não está vazio após trim
        if (authDataString.trim() === '') {
          logger.warn(`[Baileys] ⚠️ Auth data is empty string for ${connectionId}, creating new credentials`);
          creds = initAuthCreds();
        } else {
          // Tentar parse direto (sem criptografia)
          try {
            const authData = JSON.parse(authDataString, BufferJSON.reviver);
            
            // ✅ VERIFICAÇÃO ADICIONAL: Verificar se creds existe e tem dados válidos
            if (!authData.creds || !authData.creds.me || !authData.creds.me.id) {
              logger.warn(`[Baileys] ⚠️ Auth data exists but is invalid for ${connectionId}, creating new credentials`);
              creds = initAuthCreds();
            } else {
              creds = authData.creds;
              keys = authData.keys || {};
              const meId = creds.me?.id || 'N/A';
              logger.info(`[Baileys] ✅ Loaded existing auth for ${connectionId} (has valid credentials)`);
              logger.debug(`[Baileys] 📋 Credentials loaded - me.id: ${meId}`);
            }
          } catch (parseError) {
            // Se falhar, pode ser dado legado criptografado - tentar descriptografar uma vez
            logger.warn(`[Baileys] ⚠️ Failed to parse auth data, trying legacy decrypt...`);
            try {
              const { decrypt } = await import('../utils/encryption.js');
              const decrypted = decrypt(authDataString);
              const authData = JSON.parse(decrypted, BufferJSON.reviver);
              
              // ✅ VERIFICAÇÃO ADICIONAL: Verificar se creds existe e tem dados válidos
              if (!authData.creds || !authData.creds.me || !authData.creds.me.id) {
                logger.warn(`[Baileys] ⚠️ Legacy auth data exists but is invalid for ${connectionId}, creating new credentials`);
                creds = initAuthCreds();
              } else {
        creds = authData.creds;
        keys = authData.keys || {};
                const meId = creds.me?.id || 'N/A';
                logger.info(`[Baileys] ✅ Loaded legacy encrypted auth for ${connectionId} (will save unencrypted)`);
                logger.debug(`[Baileys] 📋 Legacy credentials loaded - me.id: ${meId}`);
              }
            } catch (legacyError) {
              logger.warn(`[Baileys] ⚠️ Failed to parse/decrypt auth data, creating new credentials:`, parseError);
              logger.warn(`[Baileys] ⚠️ Legacy decrypt also failed:`, legacyError);
              creds = initAuthCreds();
            }
          }
        }
      } catch (error) {
        logger.warn(`[Baileys] ⚠️ Failed to load auth data, creating new credentials:`, error);
        creds = initAuthCreds();
      }
    } else {
      // Criar novas credenciais
      logger.info(`[Baileys] 🆕 No auth data found for ${connectionId} - creating NEW credentials (will generate QR Code)`);
      creds = initAuthCreds();
    }

    // Função para salvar credenciais (SEM CRIPTOGRAFIA)
    const saveCreds = async () => {
      try {
        // Usar BufferJSON para serializar corretamente os Buffers
        const authDataString = JSON.stringify(
          {
            creds,
            keys,
          },
          BufferJSON.replacer
        );

        // ✅ SALVAR SEM CRIPTOGRAFIA para garantir reconexão
        logger.debug(`[Baileys] 💾 Saving auth data for ${connectionId} (unencrypted)`);

        await this.prisma.whatsAppConnection.update({
          where: { id: connectionId },
          data: { authData: authDataString },
        });

        logger.debug(`[Baileys] ✅ Saved auth for ${connectionId}`);
      } catch (error) {
        logger.error(`[Baileys] ❌ Error saving auth for ${connectionId}:`, error);
      }
    };

    return {
      state: {
        creds,
        keys: {
          get: (type: keyof SignalDataTypeMap, ids: string[]) => {
            const data: Record<string, any> = {};
            ids.forEach((id) => {
              const key = `${type}-${id}`;
              if (keys[key]) {
                data[id] = keys[key];
              }
            });
            return data;
          },
          set: (data: any) => {
            Object.keys(data).forEach((type) => {
              Object.keys(data[type]).forEach((id) => {
                const key = `${type}-${id}`;
                keys[key] = data[type][id];
              });
            });
          },
        },
      } as AuthenticationState,
      saveCreds,
    };
  }

  /**
   * Manipula atualização de conexão
   * Baseado em: https://baileys.wiki/docs/socket/connecting
   */
  private async handleConnectionUpdate(
    connectionId: string,
    update: Partial<ConnectionState>
  ) {
    const client = this.clients.get(connectionId);
    if (!client) return;

    const { connection, lastDisconnect, qr } = update;

    // QR Code gerado
    if (qr) {
      client.qrCode = qr;
      client.status = 'qr';
      logger.info(`[Baileys] QR Code generated for ${connectionId}`);
      await this.emitQRCode(connectionId, qr);
      return;
    }

    // Conectando
    if (connection === 'connecting') {
      const connectingAt = new Date();
      client.status = 'connecting';
      
      // ✅ LOG DETALHADO PARA DIAGNÓSTICO
      logger.info(`[Baileys] 🔄 ========== TENTATIVA DE CONEXÃO ==========`);
      logger.info(`[Baileys] 📅 Timestamp: ${connectingAt.toISOString()}`);
      logger.info(`[Baileys] 🔗 Connection ID: ${connectionId}`);
      logger.info(`[Baileys] 🔑 Tem credenciais: ${client.hasCredentials ? 'SIM' : 'NÃO'}`);
      logger.info(`[Baileys] 🔄 Tentativas de reconexão: ${client.reconnectAttempts || 0}`);
      logger.info(`[Baileys] 🔒 Lock ativo: ${this.reconnectionLocks.get(connectionId)?.locked ? 'SIM' : 'NÃO'}`);
      logger.info(`[Baileys] ===========================================`);
      
      this.emitStatus(connectionId, 'connecting');
      
      // Atualizar status no banco
      try {
        await this.prisma.whatsAppConnection.update({
          where: { id: connectionId },
          data: { status: 'connecting' },
        });
      } catch (error) {
        logger.warn(`[Baileys] ⚠️ Erro ao atualizar status para 'connecting':`, error);
      }
      
      // ✅ TIMEOUT DE SEGURANÇA: Se ficar em "connecting" por mais de 2 minutos, forçar desconexão
      // ✅ BUG FIX: Armazenar referência do timeout para poder cancelá-lo se a conexão for bem-sucedida
      const connectingTimeout = setTimeout(async () => {
        try {
          const currentClient = this.clients.get(connectionId);
          // ✅ BUG FIX: Verificar novamente o status antes de forçar desconexão (evitar race condition)
          if (currentClient && currentClient.status === 'connecting') {
            const stuckTime = Math.round((Date.now() - connectingAt.getTime()) / 1000);
            logger.error(`[Baileys] ⚠️ ========== CONEXÃO TRAVADA EM "CONNECTING" ==========`);
            logger.error(`[Baileys] 📅 Timestamp: ${new Date().toISOString()}`);
            logger.error(`[Baileys] 🔗 Connection ID: ${connectionId}`);
            logger.error(`[Baileys] ⏱️ Tempo travado: ${stuckTime} segundos`);
            logger.error(`[Baileys] 🔍 Possíveis causas:`);
            logger.error(`[Baileys]    - QR code não foi escaneado`);
            logger.error(`[Baileys]    - Credenciais inválidas`);
            logger.error(`[Baileys]    - Problema de rede`);
            logger.error(`[Baileys]    - Servidor WhatsApp indisponível`);
            logger.error(`[Baileys] 💡 Ação: Forçando desconexão e resetando status`);
            logger.error(`[Baileys] ===========================================`);
            
            // ✅ BUG FIX: Verificar status uma última vez antes de modificar (evitar sobrescrever conexão bem-sucedida)
            const finalCheck = this.clients.get(connectionId);
            if (finalCheck && finalCheck.status === 'connecting') {
              // Forçar desconexão
              finalCheck.status = 'disconnected';
              await this.updateConnectionStatus(connectionId, 'disconnected');
              this.emitStatus(connectionId, 'disconnected');
              
              // Limpar lock se existir
              this.reconnectionLocks.delete(connectionId);
            } else {
              logger.info(`[Baileys] ✅ Conexão mudou de status durante timeout - cancelando ação`);
            }
          }
        } catch (error) {
          logger.error(`[Baileys] ❌ Erro no callback do timeout de conexão:`, error);
        }
      }, 120000); // 2 minutos
      
      // Armazenar referência do timeout no cliente para poder cancelá-lo
      client.connectingTimeout = connectingTimeout;
      
      return;
    }

    // Conectado
    if (connection === 'open') {
      // ✅ BUG FIX: Cancelar timeout de "connecting" se existir (evitar race condition)
      if (client.connectingTimeout) {
        clearTimeout(client.connectingTimeout);
        client.connectingTimeout = undefined;
        logger.debug(`[Baileys] ✅ Timeout de "connecting" cancelado para ${connectionId} - conexão bem-sucedida`);
      }
      
      client.status = 'connected';
      logger.info(`[Baileys] ✅ Connected: ${connectionId}`);
      
      // ✅ VERIFICAÇÃO CRÍTICA: Verificar se socket e listeners estão ativos
      if (!client.socket) {
        logger.error(`[Baileys] ❌ Socket não encontrado após conexão para ${connectionId}!`);
      } else {
        logger.info(`[Baileys] ✅ Socket verificado e ativo para ${connectionId}`);
        // Verificar se socket tem listeners registrados
        const listeners = (client.socket.ev as any)?._events || {};
        const hasMessagesListener = listeners['messages.upsert'] || listeners['connection.update'];
        logger.info(`[Baileys] 📊 Listeners registrados: ${Object.keys(listeners).length} eventos`);
        if (!hasMessagesListener) {
          logger.warn(`[Baileys] ⚠️ Listener 'messages.upsert' pode não estar registrado para ${connectionId}!`);
        } else {
          logger.info(`[Baileys] ✅ Listener 'messages.upsert' confirmado para ${connectionId}`);
        }
      }

      // Resetar contador de reconexão ao conectar com sucesso
      this.resetReconnectionAttempts(connectionId);
      
      // ✅ Resetar circuit breaker após conexão bem-sucedida
      this.resetCircuitBreaker(connectionId);

      let lastDisconnectAt: Date | null = null;
      let firstConnectedAt: Date | null = null;
      try {
        const connectionRecord = await this.prisma.whatsAppConnection.findUnique({
          where: { id: connectionId },
          select: { lastDisconnectAt: true, firstConnectedAt: true },
        });
        lastDisconnectAt = connectionRecord?.lastDisconnectAt ?? null;
        firstConnectedAt = connectionRecord?.firstConnectedAt ?? null;
      } catch (fetchError) {
        logger.warn(`[Baileys] ⚠️ Could not read connection data for ${connectionId}:`, fetchError);
      }

      client.lastDisconnectAt = lastDisconnectAt;
      client.lastSyncFrom = lastDisconnectAt;
      client.lastSyncTo = null;

      // Salvar firstConnectedAt se for a primeira conexão
      // E forçar sincronização de mensagens desde a primeira conexão ao reconectar
      await this.saveFirstConnectedAt(connectionId);

      // ✅ IMPORTANTE: Buscar firstConnectedAt novamente após saveFirstConnectedAt
      // porque pode ter sido criado agora (primeira conexão)
      // Mas só sincronizar se já existia ANTES (reconexão), não na primeira conexão
      let shouldSync = firstConnectedAt !== null; // Sincronizar se já tinha firstConnectedAt (reconexão)
      
      // Se não tinha firstConnectedAt antes, verificar se foi criado agora
      // Se foi criado agora, é primeira conexão - NÃO sincronizar (não há mensagens antigas)
      if (!shouldSync) {
        try {
          const updatedConnection = await this.prisma.whatsAppConnection.findUnique({
            where: { id: connectionId },
            select: { firstConnectedAt: true },
          });
          // Se firstConnectedAt foi criado agora, é primeira conexão - não sincronizar
          // Se já existia, é reconexão - sincronizar
          // Mas como não tinha antes, não sincronizar agora (primeira conexão)
          firstConnectedAt = updatedConnection?.firstConnectedAt ?? null;
          shouldSync = false; // Primeira conexão - não sincronizar
        } catch (fetchError) {
          logger.warn(`[Baileys] ⚠️ Could not read updated firstConnectedAt for ${connectionId}:`, fetchError);
          shouldSync = false;
        }
      }

      // ✅ SINCRONIZAÇÃO AUTOMÁTICA: Sempre sincronizar quando conexão é aberta após reconexão
      // Isso garante que mensagens perdidas durante desconexão sejam recuperadas
      // Funciona para reconexões automáticas (sem QR code)
      // E funciona mesmo sem o frontend aberto (rodando no backend)
      // ✅ IMPORTANTE: Só sincronizar se já tinha firstConnectedAt ANTES (reconexão)
      // porque na primeira conexão não há mensagens antigas para sincronizar
      
      if (shouldSync) {
        const syncType = lastDisconnectAt ? 'reconexão automática' : 'primeira conexão';
        logger.info(`[Baileys] 🔄 ========== SINCRONIZAÇÃO AUTOMÁTICA ==========`);
        logger.info(`[Baileys] 📅 Timestamp: ${new Date().toISOString()}`);
        logger.info(`[Baileys] 🔗 Connection ID: ${connectionId}`);
        logger.info(`[Baileys] 🔄 Tipo: ${syncType}`);
        if (firstConnectedAt) {
          logger.info(`[Baileys] ⏰ Primeira conexão foi em: ${firstConnectedAt.toISOString()}`);
        }
        if (lastDisconnectAt) {
          logger.info(`[Baileys] ⏰ Última desconexão foi em: ${lastDisconnectAt.toISOString()}`);
          const disconnectDuration = Math.round((Date.now() - lastDisconnectAt.getTime()) / 1000);
          logger.info(`[Baileys] ⏱️ Tempo desconectado: ${disconnectDuration} segundos`);
        }
        logger.info(`[Baileys] 🔍 Iniciando sincronização de TODAS conversas desde firstConnectedAt...`);
        logger.info(`[Baileys] 💡 Esta sincronização funciona mesmo sem o frontend aberto`);
        logger.info(`[Baileys] ===========================================`);
        
        // Aguardar alguns segundos para conexão estabilizar completamente
        setTimeout(async () => {
          try {
            // Verificar se ainda está conectado antes de sincronizar
            const currentClient = this.clients.get(connectionId);
            if (!currentClient || currentClient.status !== 'connected') {
              logger.warn(`[Baileys] ⚠️ Conexão não está mais conectada, cancelando sincronização`);
              return;
            }

            logger.info(`[Baileys] 🔄 Iniciando sincronização automática...`);
            
            // Forçar sincronização de TODAS as conversas ativas desde firstConnectedAt
            const syncedCount = await this.syncAllActiveConversations(connectionId, 100);
            
            logger.info(`[Baileys] ✅ Sincronização automática completa: ${syncedCount} conversas sincronizadas`);
            
            // Também detectar e recuperar gaps
            const { gapsFound, recovered } = await this.detectAndRecoverGaps(connectionId);
            logger.info(`[Baileys] ✅ Detecção de gaps: ${gapsFound} encontrados, ${recovered} em recuperação`);

            // Processar fila de mensagens que falharam anteriormente
            const retried = await this.processRetryQueue(connectionId);
            if (retried > 0) {
              logger.info(`[Baileys] ✅ Retry queue drained: ${retried} mensagens reprocesadas`);
            }

            const syncEnd = new Date();
            if (currentClient) {
              currentClient.lastSyncTo = syncEnd;
            }

            await this.prisma.whatsAppConnection.update({
              where: { id: connectionId },
              data: {
                lastSyncTo: syncEnd,
              },
            }).catch((updateError) => {
              logger.warn(`[Baileys] ⚠️ Could not update lastSyncTo for ${connectionId}:`, updateError);
            });
            
            logger.info(`[Baileys] ✅ ========== SINCRONIZAÇÃO AUTOMÁTICA CONCLUÍDA ==========`);
          } catch (syncError) {
            logger.error(`[Baileys] ❌ Erro na sincronização automática:`, syncError);
            logger.error(`[Baileys] ❌ Stack trace:`, syncError instanceof Error ? syncError.stack : 'No stack');
          }
        }, 5000); // 5 segundos de espera para conexão estabilizar
      } else {
        logger.info(`[Baileys] ℹ️ Primeira conexão - sincronização será feita após salvar firstConnectedAt`);
      }

      await this.updateConnectionStatus(connectionId, 'connected', {
        lastSyncFrom: lastDisconnectAt,
        lastSyncTo: null,
      });
      this.emitStatus(connectionId, 'connected');
      return;
    }

    // Desconectado
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const errorMessage = (lastDisconnect?.error as Error)?.message || 'Unknown error';
      const disconnectAt = new Date();

      // Determinar motivo da desconexão
      let disconnectReason = 'unknown';
      let reasonDescription = 'Desconexão desconhecida';

      if (statusCode === DisconnectReason.restartRequired) {
        disconnectReason = 'restart_required';
        reasonDescription = 'Reinício necessário (normal após escanear QR code)';
      } else if (statusCode === DisconnectReason.loggedOut) {
        disconnectReason = 'logged_out';
        reasonDescription = 'Logout realizado no celular';
      } else if (statusCode === DisconnectReason.badSession) {
        disconnectReason = 'bad_session';
        reasonDescription = 'Sessão inválida ou credenciais corrompidas';
      } else if (statusCode === DisconnectReason.timedOut) {
        disconnectReason = 'timed_out';
        reasonDescription = 'Timeout na conexão';
      } else if (statusCode === 503) {
        disconnectReason = 'service_unavailable';
        reasonDescription = 'Serviço WhatsApp temporariamente indisponível';
      } else if (statusCode === 500) {
        disconnectReason = 'server_error';
        reasonDescription = 'Erro interno do servidor WhatsApp';
      } else if (statusCode === 401) {
        disconnectReason = 'unauthorized';
        reasonDescription = 'Não autorizado - credenciais inválidas';
      } else if (statusCode === 408) {
        disconnectReason = 'request_timeout';
        reasonDescription = 'Timeout na requisição';
      } else if (statusCode) {
        disconnectReason = `error_${statusCode}`;
        reasonDescription = `Erro ${statusCode}: ${errorMessage}`;
      }

      // Marcar cliente como desconectado imediatamente para parar heartbeats/presence
      client.status = 'disconnected';
      
      // ✅ LOGS DETALHADOS PARA RAILWAY
      logger.error(`[Baileys] ❌ ========== DESCONEXÃO DETECTADA ==========`);
      logger.error(`[Baileys] 📅 Timestamp: ${disconnectAt.toISOString()}`);
      logger.error(`[Baileys] 🔗 Connection ID: ${connectionId}`);
      logger.error(`[Baileys] 📊 Status Code: ${statusCode || 'N/A'}`);
      logger.error(`[Baileys] 🔍 Motivo: ${disconnectReason}`);
      logger.error(`[Baileys] 📝 Descrição: ${reasonDescription}`);
      logger.error(`[Baileys] 💬 Mensagem de Erro: ${errorMessage}`);
      logger.error(`[Baileys] 🔢 DisconnectReason.restartRequired = ${DisconnectReason.restartRequired}`);
      logger.error(`[Baileys] 🔢 DisconnectReason.loggedOut = ${DisconnectReason.loggedOut}`);
      logger.error(`[Baileys] 🔢 DisconnectReason.badSession = ${DisconnectReason.badSession}`);
      logger.error(`[Baileys] 🔢 DisconnectReason.timedOut = ${DisconnectReason.timedOut}`);
      
      // Log detalhado do erro completo
      if (lastDisconnect?.error) {
        try {
          const errorDetails = {
            name: (lastDisconnect.error as Error).name,
            message: (lastDisconnect.error as Error).message,
            stack: (lastDisconnect.error as Error).stack,
            output: (lastDisconnect.error as Boom)?.output,
            data: (lastDisconnect.error as Boom)?.data,
          };
          logger.error(`[Baileys] 📋 Detalhes completos do erro:`, JSON.stringify(errorDetails, null, 2));
        } catch (e) {
          logger.error(`[Baileys] 📋 Erro ao serializar detalhes:`, e);
        }
      }
      
      logger.error(`[Baileys] ===========================================`);

      client.lastDisconnectAt = disconnectAt;
      client.lastSyncFrom = null;
      client.lastSyncTo = null;

      // Salvar motivo da desconexão no banco
      try {
        await this.prisma.whatsAppConnection.update({
          where: { id: connectionId },
          data: {
            lastDisconnectAt: disconnectAt,
            lastDisconnectReason: `${disconnectReason}: ${reasonDescription}`,
            status: 'disconnected',
          },
        });
      } catch (dbError) {
        logger.error(`[Baileys] ❌ Erro ao salvar motivo da desconexão no banco:`, dbError);
      }

      // Restart required (normal após QR scan)
      if (statusCode === DisconnectReason.restartRequired) {
        logger.info(`[Baileys] Restart required for ${connectionId} (normal after QR scan)`);
        
        // Aguardar 3 segundos antes de reiniciar para evitar conflitos
        setTimeout(async () => {
          try {
            // Verificar se não está já reconectando
            const lock = this.reconnectionLocks.get(connectionId);
            if (!lock || !lock.locked) {
              await this.createClient(connectionId);
            } else {
              logger.info(`[Baileys] Skipping restart for ${connectionId} - already reconnecting`);
            }
          } catch (error) {
            logger.error(`[Baileys] Error restarting ${connectionId}:`, error);
          }
        }, 3000);
        return;
      }

      // Logout
      if (statusCode === DisconnectReason.loggedOut) {
        await this.handleSessionInvalidation(connectionId, 'logged_out', lastDisconnect?.error);
        return;
      }

      // Sessão inválida / credenciais corrompidas (stream:error ack -> badSession)
      // ✅ TRATAMENTO ESPECÍFICO PARA ERRO 500
      if (statusCode === DisconnectReason.badSession || statusCode === 500) {
        logger.warn(`[Baileys] ⚠️ Bad session or error 500 detected for ${connectionId}`);
        
        // Verificar circuit breaker antes de tentar reconectar
        const circuitState = this.getCircuitBreakerState(connectionId);
        
        if (circuitState === 'open') {
          logger.warn(`[Baileys] 🚫 Circuit breaker OPEN for ${connectionId} - too many failures, waiting before retry`);
          await this.updateConnectionStatus(connectionId, 'disconnected', {
            lastDisconnectAt: disconnectAt,
            lastDisconnectReason: `${disconnectReason}: ${reasonDescription}`,
          });
          this.emitStatus(connectionId, 'disconnected');
          
          // Aguardar timeout do circuit breaker antes de resetar credenciais
          setTimeout(async () => {
            try {
            logger.info(`[Baileys] 🔄 Circuit breaker timeout expired for ${connectionId}, resetting credentials...`);
            await this.handleSessionInvalidation(connectionId, 'bad_session', lastDisconnect?.error);
            } catch (error) {
              logger.error(`[Baileys] ❌ Erro ao resetar credenciais após circuit breaker timeout:`, error);
            }
          }, this.CIRCUIT_BREAKER_TIMEOUT);
          return;
        }
        
        // Registrar falha no circuit breaker
        this.recordCircuitBreakerFailure(connectionId);
        
        // Tentar reconexão inteligente antes de resetar credenciais
        const reconnectAttempts = client.reconnectAttempts || 0;
        const shouldRetry = reconnectAttempts < 3; // Tentar 3 vezes antes de resetar
        
        if (shouldRetry) {
          logger.info(`[Baileys] 🔄 Attempting smart reconnection for ${connectionId} (attempt ${reconnectAttempts + 1}/3)`);
          await this.attemptReconnection(connectionId);
          return;
        }
        
        // Após 3 tentativas, resetar credenciais
        logger.warn(`[Baileys] 🔄 Max retry attempts reached, resetting credentials for ${connectionId}`);
        await this.handleSessionInvalidation(connectionId, 'bad_session', lastDisconnect?.error);
        return;
      }

      // Tratamento especial para erro 503 (Service Unavailable)
      if (statusCode === 503) {
        logger.warn(`[Baileys] ⚠️ Error 503 (Service Unavailable) - WhatsApp may be temporarily unavailable`);
        logger.warn(`[Baileys] 💡 Will wait 30 seconds before attempting reconnection`);
        
        // Aguardar 30 segundos antes de tentar reconectar (evitar múltiplas tentativas)
        setTimeout(async () => {
          try {
          const shouldReconnect = this.shouldAttemptReconnection(connectionId, statusCode);
          if (shouldReconnect) {
            logger.info(`[Baileys] 🔄 Auto-reconnecting ${connectionId} after 503 error...`);
            await this.attemptReconnection(connectionId);
            }
          } catch (error) {
            logger.error(`[Baileys] ❌ Erro ao reconectar após erro 503:`, error);
          }
        }, 30000); // 30 segundos para erro 503
        
        await this.updateConnectionStatus(connectionId, 'disconnected', {
          lastDisconnectAt: disconnectAt,
          lastDisconnectReason: `${disconnectReason}: ${reasonDescription}`,
        });
        this.emitStatus(connectionId, 'disconnected');
        return;
      }
      
      // Reconexão automática inteligente
      // Só reconecta se:
      // 1. Tem credenciais salvas (já foi conectado antes)
      // 2. Não é um logout deliberado
      // 3. Não excedeu o limite de tentativas
      const shouldReconnect = this.shouldAttemptReconnection(connectionId, statusCode);
      
      if (shouldReconnect) {
        logger.info(`[Baileys] 🔄 Auto-reconnecting ${connectionId}...`);
        await this.attemptReconnection(connectionId);
      } else {
        // Verificar se é uma conexão com credenciais que falhou por outro motivo
        if (client.hasCredentials) {
          logger.warn(`[Baileys] ⚠️ Connection with credentials failed (code: ${statusCode})`);
          logger.warn(`[Baileys] 💡 Try reconnecting manually or check WhatsApp on phone`);
        }
        
        logger.warn(`[Baileys] ❌ Disconnected: ${connectionId} (code: ${statusCode}).`);
        await this.updateConnectionStatus(connectionId, 'disconnected', {
          lastDisconnectAt: disconnectAt,
          lastDisconnectReason: `${disconnectReason}: ${reasonDescription}`,
        });
        this.emitStatus(connectionId, 'disconnected');
      }
    }
  }

  /**
   * Manipula chats recebidos do histórico
   * Baseado em: https://baileys.wiki/docs/socket/history-sync
   */
  private async handleHistoryChats(connectionId: string, chats: any[]): Promise<void> {
    try {
      logger.info(`[Baileys] 📚 Processing ${chats.length} chats from history sync`);
      
      // Armazenar informações de chats para referência futura
      // Os chats contêm metadados importantes como nome, última mensagem, etc.
      for (const chat of chats) {
        try {
          const jid = chat.id;
          if (!jid) continue;
          
          // Extrair número de telefone do JID (remover @s.whatsapp.net)
          const phoneNumber = jid.split('@')[0];
          
          // Buscar ou criar contato
          const contact = await this.prisma.contact.upsert({
            where: { phoneNumber },
            update: {
              name: chat.name || undefined,
              pushName: chat.name || undefined,
            },
            create: {
              phoneNumber,
              name: chat.name || undefined,
              pushName: chat.name || undefined,
            },
          });
          
          // Buscar ou criar conversa
          let conversation = await this.prisma.conversation.findFirst({
            where: {
              contactId: contact.id,
              connectionId,
            },
          });

          if (conversation) {
            // Atualizar última mensagem se necessário
            if (chat.conversationTimestamp) {
              const chatTimestamp = new Date(Number(chat.conversationTimestamp) * 1000);
              if (chatTimestamp > conversation.lastMessageAt) {
                await this.prisma.conversation.update({
                  where: { id: conversation.id },
                  data: { lastMessageAt: chatTimestamp },
                });
              }
            }
          } else {
            // Criar nova conversa
            conversation = await this.prisma.conversation.create({
              data: {
                contactId: contact.id,
                connectionId,
                lastMessageAt: chat.conversationTimestamp ? new Date(Number(chat.conversationTimestamp) * 1000) : new Date(),
              },
            });
          }
          
          logger.debug(`[Baileys] ✅ Processed chat: ${jid}`);
        } catch (error) {
          logger.error(`[Baileys] ❌ Error processing chat:`, error);
        }
      }
      
      logger.info(`[Baileys] ✅ Finished processing ${chats.length} chats`);
    } catch (error) {
      logger.error(`[Baileys] ❌ Error handling history chats:`, error);
    }
  }

  /**
   * Manipula contacts recebidos do histórico
   * Baseado em: https://baileys.wiki/docs/socket/history-sync
   */
  private async handleHistoryContacts(connectionId: string, contacts: any[]): Promise<void> {
    try {
      logger.info(`[Baileys] 📚 Processing ${contacts.length} contacts from history sync`);
      
      // Armazenar informações de contatos para referência futura
      for (const contact of contacts) {
        try {
          const jid = contact.id;
          if (!jid) continue;
          
          // Extrair número de telefone do JID
          const phoneNumber = jid.split('@')[0];
          
          // Atualizar ou criar contato
          await this.prisma.contact.upsert({
            where: { phoneNumber },
            update: {
              name: contact.name || contact.notify || undefined,
              pushName: contact.notify || contact.name || undefined,
            },
            create: {
              phoneNumber,
              name: contact.name || contact.notify || undefined,
              pushName: contact.notify || contact.name || undefined,
            },
          });
          
          logger.debug(`[Baileys] ✅ Processed contact: ${jid}`);
        } catch (error) {
          logger.error(`[Baileys] ❌ Error processing contact:`, error);
        }
      }
      
      logger.info(`[Baileys] ✅ Finished processing ${contacts.length} contacts`);
    } catch (error) {
      logger.error(`[Baileys] ❌ Error handling history contacts:`, error);
    }
  }

  /**
   * Manipula mensagens recebidas
   * Baseado em: https://baileys.wiki/docs/socket/handling-messages
   * Mensagens vêm no formato proto.IWebMessageInfo conforme documentação
   */
  private async handleIncomingMessages(connectionId: string, messageUpdate: any) {
    try {
      const { messages, type } = messageUpdate;

      logger.info(`[Baileys] 📨 ========== MENSAGEM RECEBIDA ==========`);
      logger.info(`[Baileys] 📅 Timestamp: ${new Date().toISOString()}`);
      logger.info(`[Baileys] 🔗 Connection ID: ${connectionId}`);
      logger.info(`[Baileys] 📊 Type: ${type || 'notify'}`);
      logger.info(`[Baileys] 📊 Count: ${messages?.length || 0}`);

      // ✅ Verificar se cliente ainda existe e está conectado
      const client = this.clients.get(connectionId);
      if (!client) {
        logger.error(`[Baileys] ❌ Cliente ${connectionId} não encontrado no mapa - mensagens serão ignoradas!`);
        return;
      }
      if (client.status !== 'connected') {
        logger.warn(`[Baileys] ⚠️ Cliente ${connectionId} não está conectado (status: ${client.status}) - processando mesmo assim`);
      } else {
        logger.info(`[Baileys] ✅ Cliente encontrado e status: ${client.status}`);
      }
      logger.info(`[Baileys] ===========================================`);

      // Buscar firstConnectedAt para sincronização inteligente
      const connection = await this.prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        select: { firstConnectedAt: true },
      });

      const firstConnectedAt = connection?.firstConnectedAt;
      
      // Se não tem firstConnectedAt, ainda não conectou pela primeira vez
      // Nesse caso, não processar histórico antigo (aguardar conexão)
      // Mas mensagens em tempo real (notify) sempre devem ser processadas
      if (!firstConnectedAt && type === 'history') {
        logger.info(`[Baileys] ⏭️ Skipping history sync - connection ${connectionId} hasn't been connected yet (will process after first connection)`);
        return;
      }
      
      // IMPORTANTE: Mensagens em tempo real (notify/append) sempre processar, mesmo sem firstConnectedAt
      // Elas são novas e devem ser capturadas imediatamente
      // Para mensagens history: processar desde firstConnectedAt, deduplicação vai pular as já existentes

      // Atualizar timestamp de última mensagem recebida
      // ✅ client já foi declarado acima, apenas atualizar
      if (client) {
        client.lastMessageReceived = new Date();
      }

      // VALIDAÇÃO: Se receber muitas mensagens de uma vez, pode ser sincronização atrasada
      if (messages && messages.length > 10) {
        logger.warn(`[Baileys] ⚠️ Received batch of ${messages.length} messages - possible delayed sync detected`);
        logger.info(`[Baileys] 📊 Processing large batch - will process in chunks to avoid overload`);
      }
      
      // 📊 Estatísticas de sincronização (declarar ANTES de usar)
      const syncStats = {
        total: messages?.length || 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        type,
      };
      
      // Se receber MUITAS mensagens (> 50), processar em lotes menores para evitar timeout
      const BATCH_SIZE = 50;
      const shouldProcessInBatches = messages && messages.length > BATCH_SIZE;
      
      if (shouldProcessInBatches) {
        logger.info(`[Baileys] 📦 Large batch detected (${messages.length} messages) - processing in batches of ${BATCH_SIZE}`);
        
        const batches: any[][] = [];
        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
          batches.push(messages.slice(i, i + BATCH_SIZE));
        }
        
        logger.info(`[Baileys] 📦 Split into ${batches.length} batches`);
        
        // Processar cada lote
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          logger.info(`[Baileys] 📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} messages)...`);
          
          // Processar lote (usar mesmo código de processamento)
          await this.processMessageBatch(
            connectionId,
            batch,
            type,
            firstConnectedAt || null,
            syncStats,
            client?.lastSyncFrom ?? null
          );
          
          // Delay entre lotes para evitar sobrecarga
          if (batchIndex < batches.length - 1) {
            logger.info(`[Baileys] ⏸️ Pausing 2 seconds before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        // Log final
        logger.info(`[Baileys] 📊 Batch processing complete: Total=${syncStats.total}, Processed=${syncStats.processed}, Skipped=${syncStats.skipped}, Errors=${syncStats.errors}`);
        return; // Sair da função - já processou tudo em lotes
      }
      
      // Processar mensagens normalmente (se não foi processado em lotes)
      await this.processMessageBatch(
        connectionId,
        messages,
        type,
        firstConnectedAt || null,
        syncStats,
        client?.lastSyncFrom ?? null
      );
    } catch (error) {
      logger.error(`[Baileys] ❌ Error handling messages for ${connectionId}:`, error);
      // Não propagar erro - continuar funcionamento
    }
  }

  /**
   * Processa um lote de mensagens com proteção robusta
   * Garante que todas mensagens sejam processadas mesmo com erros
   */
  private async processMessageBatch(
    connectionId: string,
    messages: any[],
    type: string,
    firstConnectedAt: Date | null,
    syncStats: { total: number; processed: number; skipped: number; errors: number; type: string },
    syncWindowStart: Date | null
  ): Promise<void> {
    logger.info(`[Baileys] 📨 Processing message batch - Type: ${type}, Count: ${messages?.length || 0}, firstConnectedAt: ${firstConnectedAt?.toISOString() || 'N/A'}`);
    
    // Log de tipo de mensagem para debug
    if (type === 'notify') {
      logger.info(`[Baileys] ✅ Processing REAL-TIME messages (notify) - will process ALL`);
    } else if (type === 'append') {
      logger.info(`[Baileys] ✅ Processing NEW messages (append) - will process ALL`);
    } else if (type === 'history') {
      logger.info(`[Baileys] ⚠️ Processing HISTORY messages - will filter old ones (before ${firstConnectedAt?.toISOString() || 'N/A'})`);
    }

    const totalMessages = messages?.length || 0;
    let processedIndex = 0;
    
    for (const msg of messages) {
      processedIndex++;
      
      try {
        // VERIFICAÇÃO 1: Verificar se conexão ainda está ativa durante processamento
        const currentClient = this.clients.get(connectionId);
        if (!currentClient || currentClient.status !== 'connected' || !currentClient.socket) {
          logger.warn(`[Baileys] ⚠️ Connection ${connectionId} closed during sync - stopping at message ${processedIndex}/${totalMessages}`);
          logger.warn(`[Baileys] ⚠️ ${totalMessages - processedIndex + 1} messages remaining - will retry on next sync`);
          break; // Parar loop mas não falhar completamente
        }
        
        const from = msg.key.remoteJid;
        const isFromMe = msg.key.fromMe || false;
        const externalId = msg.key.id;
        const pushName = msg.pushName || null;

        // ✅ Capturar participante em grupos (quem enviou a mensagem dentro do grupo)
        const isGroup = from?.endsWith('@g.us') || false;
        const participant = msg.key.participant || null; // JID do participante que enviou (em grupos)
        let senderName: string | null = null;
        
        // Se for grupo e não for mensagem nossa, buscar nome do participante
        if (isGroup && !isFromMe && participant) {
          try {
            // Tentar buscar nome do participante do grupo
            const client = this.clients.get(connectionId);
            if (client?.socket) {
              try {
                // Buscar informações do grupo (forma mais confiável)
                const groupMetadata = await client.socket.groupMetadata(from);
                const participantInfo = groupMetadata.participants.find(p => p.id === participant);
                if (participantInfo) {
                  senderName = participantInfo.name || participantInfo.notify || null;
                }
              } catch (groupError) {
                logger.debug(`[Baileys] Could not fetch participant name from group:`, groupError);
              }
              
              // Se não encontrou do grupo, usar pushName da mensagem
              if (!senderName && pushName) {
                senderName = pushName;
              }
            } else {
              // Fallback: usar pushName se disponível
              if (pushName) {
                senderName = pushName;
              }
            }
          } catch (error) {
            logger.debug(`[Baileys] Error fetching sender name for group message:`, error);
            // Fallback: usar pushName se disponível
            if (pushName) {
              senderName = pushName;
            }
          }
        } else if (!isFromMe && pushName) {
          // Para mensagens individuais, usar pushName
          senderName = pushName;
        }

        logger.info(`[Baileys] 📱 Processing message ${processedIndex}/${totalMessages} from ${from}, isFromMe: ${isFromMe}, pushName: ${pushName}, senderName: ${senderName || 'N/A'}, isGroup: ${isGroup}`);

        let messageTimestamp: Date | null = null;
        if (msg.messageTimestamp) {
          messageTimestamp = new Date(Number(msg.messageTimestamp) * 1000);
        } else if (msg.key?.messageTimestamp) {
          messageTimestamp = new Date(Number(msg.key.messageTimestamp) * 1000);
        }

        if (syncWindowStart && (type === 'history' || type === 'append')) {
          if (messageTimestamp && messageTimestamp < syncWindowStart) {
            logger.debug(
              `[Baileys] ⏭️ Skipping message before last disconnect window (${messageTimestamp.toISOString()})`
            );
            syncStats.skipped++;
            continue;
          }
        }

        // ===== FILTROS =====
        
        // 0. Filtrar mensagens MUITO antigas (anteriores à primeira conexão - margem de segurança)
        // ✅ CORRIGIDO: Processar TODAS mensagens desde firstConnectedAt
        // A deduplicação (por externalId) vai pular mensagens já sincronizadas automaticamente
        // Isso garante que mensagens perdidas durante desconexão sejam recuperadas
        if (firstConnectedAt && type === 'history') {
          if (!messageTimestamp) {
            // Mensagem sem timestamp - processar (pode ser recente)
            logger.debug(`[Baileys] ✅ Processing message without timestamp (will deduplicate if exists)`);
          } else {
            // ✅ CORRIGIDO: Usar firstConnectedAt como limite mínimo (sem margem negativa)
            // Processar todas mensagens desde a primeira conexão
            // Deduplicação vai pular as que já existem
            if (messageTimestamp < firstConnectedAt) {
              logger.debug(`[Baileys] ⏭️ Skipping message from ${messageTimestamp.toISOString()} (before first connection at ${firstConnectedAt.toISOString()})`);
              syncStats.skipped++;
              continue;
            } else {
              logger.debug(`[Baileys] ✅ Processing message from ${messageTimestamp.toISOString()} (since first connection, will deduplicate if exists)`);
            }
          }
        }
        
        // 1. Filtrar STATUS do WhatsApp
        if (from === 'status@broadcast') {
          logger.debug(`[Baileys] ⏭️ Skipping WhatsApp Status message`);
          syncStats.skipped++;
          continue;
        }

        // 2. Filtrar CANAIS DE TRANSMISSÃO
        if (from?.includes('@newsletter')) {
          logger.debug(`[Baileys] ⏭️ Skipping WhatsApp Channel/Newsletter message`);
          syncStats.skipped++;
          continue;
        }

        // 3. Filtrar LISTAS DE TRANSMISSÃO
        if (from?.includes('@broadcast')) {
          logger.debug(`[Baileys] ⏭️ Skipping Broadcast List message`);
          syncStats.skipped++;
          continue;
        }

        // Extrair conteúdo da mensagem conforme documentação oficial
        // Baseado em: https://baileys.wiki/docs/socket/handling-messages
        // Mensagens vêm no formato proto.IMessage
        let messageText = '';
        let messageType = 'text';
        let audioMediaUrl: string | null = null;
        let imageMediaUrl: string | null = null;
        let videoMediaUrl: string | null = null;
        let documentMediaUrl: string | null = null;

        const message = msg.message;
        const client = this.clients.get(connectionId);

        // Text Messages: proto.IMessage.conversation ou proto.IMessage.extendedTextMessage
        // extendedTextMessage contém: reply data, link preview, group invite, status updates
        if (message?.conversation) {
          // Mensagem de texto simples
          messageText = message.conversation;
          messageType = 'text';
        } else if (message?.extendedTextMessage) {
          // Mensagem de texto estendida (pode ter reply, link preview, etc.)
          messageText = message.extendedTextMessage.text || '';
          messageType = 'text';
          
          // Log de metadados se presentes
          if (message.extendedTextMessage.contextInfo?.quotedMessage) {
            logger.debug(`[Baileys] 📎 Extended text message has quoted context`);
          }
          if (message.extendedTextMessage.contextInfo?.linkPreview) {
            logger.debug(`[Baileys] 🔗 Extended text message has link preview`);
          }
        } 
        // Media Messages conforme documentação
        else if (message?.imageMessage) {
          // proto.IMessage.imageMessage
          // Só usar caption se existir, caso contrário deixar vazio (sem adicionar '[Imagem]')
          messageText = message.imageMessage.caption || '';
          messageType = 'image';
          
          // Baixar imagem usando downloadMediaMessage conforme documentação
          // Para mídia faltando, usar sock.updateMediaMessage
          try {
            if (client?.socket) {
              const imageBuffer = await Promise.race([
                downloadMediaMessage(
                  msg, 
                  'buffer', 
                  {}, 
                  { 
                    logger: pino({ level: 'silent' }), 
                    reuploadRequest: client.socket.updateMediaMessage 
                  }
                ),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Image download timeout')), 15000))
              ]) as Buffer;
              
              if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
                const imageMimetype = message.imageMessage?.mimetype || 'image/jpeg';
                const imageExt = imageMimetype.includes('png') ? '.png' 
                  : imageMimetype.includes('gif') ? '.gif' 
                  : imageMimetype.includes('webp') ? '.webp' 
                  : '.jpg';
                const filename = `image-${Date.now()}-${Math.random().toString(36).substring(7)}${imageExt}`;
                
                // ✅ Fazer upload para Supabase Storage (com fallback local)
                imageMediaUrl = await this.uploadMediaToStorage(imageBuffer, filename, imageMimetype);
              }
            }
          } catch (imageError) {
            logger.error(`[Baileys] ❌ Error downloading image:`, imageError);
            // Tentar atualizar mídia se faltando conforme documentação
            if (client?.socket && imageError instanceof Error && imageError.message.includes('missing')) {
              try {
                await client.socket.updateMediaMessage(msg);
                logger.info(`[Baileys] 🔄 Requested media update for missing image`);
              } catch (updateError) {
                logger.error(`[Baileys] ❌ Error updating media:`, updateError);
              }
            }
          }
        } else if (message?.audioMessage) {
          // proto.IMessage.audioMessage
          messageText = '[Áudio]';
          messageType = 'audio';
          
          // Baixar áudio conforme documentação
          try {
            if (client?.socket) {
              const audioBuffer = await Promise.race([
                downloadMediaMessage(
                  msg, 
                  'buffer', 
                  {}, 
                  { 
                    logger: pino({ level: 'silent' }), 
                    reuploadRequest: client.socket.updateMediaMessage 
                  }
                ),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Audio download timeout')), 20000))
              ]) as Buffer;
              
              if (audioBuffer && Buffer.isBuffer(audioBuffer)) {
                const audioMimetype = message.audioMessage?.mimetype || 'audio/ogg; codecs=opus';
                const audioExt = audioMimetype.includes('mp3') ? '.mp3' 
                  : audioMimetype.includes('wav') ? '.wav' 
                  : audioMimetype.includes('m4a') ? '.m4a' 
                  : '.ogg';
                const filename = `audio-${Date.now()}-${Math.random().toString(36).substring(7)}${audioExt}`;
                
                // ✅ Fazer upload para Supabase Storage (com fallback local)
                audioMediaUrl = await this.uploadMediaToStorage(audioBuffer, filename, audioMimetype);
              }
            }
          } catch (audioError) {
            logger.error(`[Baileys] ❌ Error downloading audio:`, audioError);
            // Tentar atualizar mídia se faltando conforme documentação
            if (client?.socket && audioError instanceof Error && audioError.message.includes('missing')) {
              try {
                await client.socket.updateMediaMessage(msg);
                logger.info(`[Baileys] 🔄 Requested media update for missing audio`);
              } catch (updateError) {
                logger.error(`[Baileys] ❌ Error updating media:`, updateError);
              }
            }
          }
        } else if (message?.videoMessage) {
          // proto.IMessage.videoMessage
          // Só usar caption se existir, caso contrário deixar vazio (sem adicionar '[Vídeo]')
          messageText = message.videoMessage.caption || '';
          messageType = 'video';
          
          // Baixar vídeo conforme documentação
          try {
            if (client?.socket) {
              const videoBuffer = await Promise.race([
                downloadMediaMessage(
                  msg, 
                  'buffer', 
                  {}, 
                  { 
                    logger: pino({ level: 'silent' }), 
                    reuploadRequest: client.socket.updateMediaMessage 
                  }
                ),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Video download timeout')), 30000))
              ]) as Buffer;
              
              if (videoBuffer && Buffer.isBuffer(videoBuffer)) {
                const videoMimetype = message.videoMessage?.mimetype || 'video/mp4';
                const videoExt = videoMimetype.includes('mp4') ? '.mp4' 
                  : videoMimetype.includes('webm') ? '.webm' 
                  : '.mp4';
                const filename = `video-${Date.now()}-${Math.random().toString(36).substring(7)}${videoExt}`;
                
                // ✅ Fazer upload para Supabase Storage (com fallback local)
                videoMediaUrl = await this.uploadMediaToStorage(videoBuffer, filename, videoMimetype);
              }
            }
          } catch (videoError) {
            logger.error(`[Baileys] ❌ Error downloading video:`, videoError);
            // Tentar atualizar mídia se faltando conforme documentação
            if (client?.socket && videoError instanceof Error && videoError.message.includes('missing')) {
              try {
                await client.socket.updateMediaMessage(msg);
                logger.info(`[Baileys] 🔄 Requested media update for missing video`);
              } catch (updateError) {
                logger.error(`[Baileys] ❌ Error updating media:`, updateError);
              }
            }
          }
        } else if (message?.documentMessage) {
          // proto.IMessage.documentMessage
          // Não usar fileName como caption - documentos não devem ter caption a menos que venha do WhatsApp
          messageText = message.documentMessage.caption || '';
          messageType = 'document';
          
          // Baixar documento conforme documentação
          try {
            if (client?.socket) {
              const docBuffer = await Promise.race([
                downloadMediaMessage(
                  msg, 
                  'buffer', 
                  {}, 
                  { 
                    logger: pino({ level: 'silent' }), 
                    reuploadRequest: client.socket.updateMediaMessage 
                  }
                ),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Document download timeout')), 30000))
              ]) as Buffer;
              
              if (docBuffer && Buffer.isBuffer(docBuffer)) {
                const docMimetype = message.documentMessage?.mimetype || 'application/octet-stream';
                const docFileName = message.documentMessage?.fileName || 'document';
                const filename = `doc-${Date.now()}-${docFileName}`;
                
                // ✅ Fazer upload para Supabase Storage (com fallback local)
                documentMediaUrl = await this.uploadMediaToStorage(docBuffer, filename, docMimetype);
              }
            }
          } catch (docError) {
            logger.error(`[Baileys] ❌ Error downloading document:`, docError);
            // Tentar atualizar mídia se faltando conforme documentação
            if (client?.socket && docError instanceof Error && docError.message.includes('missing')) {
              try {
                await client.socket.updateMediaMessage(msg);
                logger.info(`[Baileys] 🔄 Requested media update for missing document`);
              } catch (updateError) {
                logger.error(`[Baileys] ❌ Error updating media:`, updateError);
              }
            }
          }
        } else if (message?.stickerMessage) {
          // Stickers
          messageText = '[Sticker]';
          messageType = 'image'; // Tratar como imagem
        }

        if (!messageText) {
          logger.warn(`[Baileys] ⚠️ Empty message text, skipping`);
          syncStats.skipped++;
          continue;
        }

        logger.info(`[Baileys] ✅ New ${messageType} from ${from}: "${messageText.substring(0, 50)}..."`);

        const quotedContext = this.extractQuotedContext(msg);
        if (quotedContext?.stanzaId) {
          logger.info(
            `[Baileys] 🧷 Message ${externalId} is replying to stanza ${quotedContext.stanzaId}`
          );
        }

        // Determinar mediaUrl baseado no tipo de mensagem
        let mediaUrl: string | null = null;
        if (messageType === 'audio') {
          mediaUrl = audioMediaUrl;
        } else if (messageType === 'image') {
          mediaUrl = imageMediaUrl;
        } else if (messageType === 'video') {
          mediaUrl = videoMediaUrl;
        } else if (messageType === 'document') {
          mediaUrl = documentMediaUrl;
        }

        // Processar mensagem com timeout e retry robusto
        const messageProcessed = await this.processMessageWithRetry(
          connectionId,
          from,
          messageText,
          messageType,
          mediaUrl,
          isFromMe,
          externalId,
          pushName,
          senderName, // ✅ Passar nome do remetente (importante para grupos)
          quotedContext,
          processedIndex,
          totalMessages
        );

        if (messageProcessed) {
          syncStats.processed++;
        } else {
          syncStats.errors++;
        }
        
        // Rate limiting: delay entre mensagens
        const delay = (messageType === 'image' || messageType === 'audio' || messageType === 'video') ? 300 : 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        // Erro ao processar mensagem individual - não parar o loop
        logger.error(`[Baileys] ❌ Error processing message ${processedIndex}/${totalMessages}:`, error);
        syncStats.errors++;
        
        // Continuar com próxima mensagem
        continue;
      }
    }
  }

  /**
   * Processa mensagem com timeout e retry robusto
   * Garante que mensagens não sejam perdidas mesmo com erros temporários
   */
  private async processMessageWithRetry(
    connectionId: string,
    from: string,
    messageText: string,
    messageType: string,
    mediaUrl: string | null,
    isFromMe: boolean,
    externalId: string,
    pushName: string | null,
    senderName: string | null, // ✅ Nome do remetente (para grupos)
    quotedContext: {
      stanzaId?: string;
      participant?: string;
      quotedMessage?: any;
    } | null,
    processedIndex: number,
    totalMessages: number
  ): Promise<boolean> {
    const maxRetries = 3;
    const timeoutMs = 30000; // 30 segundos por tentativa
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Criar promise com timeout
        const processPromise = (async () => {
          const { MessageService } = await import('../services/message.service.js');
          const messageService = new MessageService();
          await messageService.processIncomingMessage(
            connectionId,
            from,
            messageText,
            messageType,
            mediaUrl,
            isFromMe,
            externalId,
            pushName,
            senderName, // ✅ Passar nome do remetente
            quotedContext || undefined
          );
        })();

        // Race entre processamento e timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        await Promise.race([processPromise, timeoutPromise]);
        
        // Sucesso!
        logger.info(`[Baileys] 💾 Message ${processedIndex}/${totalMessages} saved successfully (${messageType}, attempt ${attempt})`);
        return true;
        
      } catch (error: any) {
        const isTimeout = error?.message?.includes('Timeout');
        const isLastAttempt = attempt === maxRetries;
        
        logger.warn(`[Baileys] ⚠️ Error processing message ${processedIndex}/${totalMessages} (attempt ${attempt}/${maxRetries}):`, 
          isTimeout ? `Timeout after ${timeoutMs}ms` : error?.message || error);
        
        // Se não é última tentativa, aguardar antes de retry (backoff exponencial)
        if (!isLastAttempt) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 1s, 2s, 4s (max 10s)
          logger.info(`[Baileys] 🔄 Retrying message ${processedIndex}/${totalMessages} in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        } else {
          // Última tentativa falhou - armazenar na fila de retry para processamento posterior
          logger.error(`[Baileys] ❌ Max retries reached for message ${externalId} - enqueueing for background retry`);
          
          const retryKey = `${connectionId}:${externalId}`;
          const existingRetry = this.syncRetryQueue.get(retryKey);
          const retryItem: IncomingRetryItem = {
            connectionId,
            from,
            messageText,
            messageType,
            mediaUrl,
            isFromMe,
            externalId,
            pushName,
            senderName, // ✅ Incluir nome do remetente
            quotedContext: quotedContext || undefined,
            retries: existingRetry ? existingRetry.retries + 1 : attempt,
            lastAttempt: new Date(),
          };
          this.syncRetryQueue.set(retryKey, retryItem);
          
          // Disparar retry em background após pequeno delay
          setTimeout(() => {
            this.retryIncomingMessage(retryKey).catch((retryError) => {
              logger.error(`[Baileys] ❌ Background retry promise rejected for ${externalId}:`, retryError);
            });
          }, 10000); // 10 segundos
          
          return false;
        }
      }
    }
    
    return false; // Nunca deve chegar aqui, mas TypeScript precisa
  }

  private async retryIncomingMessage(retryKey: string): Promise<void> {
    const retryItem = this.syncRetryQueue.get(retryKey);
    if (!retryItem) {
      return;
    }

    const maxBackgroundRetries = 6;

    if (retryItem.retries >= maxBackgroundRetries) {
      logger.error(
        `[Baileys] ❌ Giving up on message ${retryItem.externalId} after ${retryItem.retries} background retries`
      );
      this.syncRetryQueue.delete(retryKey);
      return;
    }

    try {
      logger.info(
        `[Baileys] 🔄 Background retry #${retryItem.retries} for message ${retryItem.externalId}...`
      );
      const { MessageService } = await import('../services/message.service.js');
      const messageService = new MessageService();
      await messageService.processIncomingMessage(
        retryItem.connectionId,
        retryItem.from,
        retryItem.messageText,
        retryItem.messageType,
        retryItem.mediaUrl,
        retryItem.isFromMe,
        retryItem.externalId,
        retryItem.pushName,
        retryItem.senderName, // ✅ Passar nome do remetente
        retryItem.quotedContext
      );
      this.syncRetryQueue.delete(retryKey);
      logger.info(
        `[Baileys] ✅ Background retry successful for message ${retryItem.externalId}`
      );
    } catch (error) {
      retryItem.retries += 1;
      retryItem.lastAttempt = new Date();
      this.syncRetryQueue.set(retryKey, retryItem);
      logger.error(
        `[Baileys] ❌ Background retry failed for message ${retryItem.externalId} (attempt ${retryItem.retries}):`,
        error
      );

      const nextDelay = Math.min(60000, 10000 * retryItem.retries); // 10s, 20s, ... up to 60s
      setTimeout(() => {
        this.retryIncomingMessage(retryKey).catch((err) =>
          logger.error(
            `[Baileys] ❌ Background retry promise rejected for ${retryItem.externalId}:`,
            err
          )
        );
      }, nextDelay);
    }
  }

  /**
   * Manipula atualização de status de mensagens (delivered, read)
   */
  private async handleMessageStatusUpdate(connectionId: string, updates: any[]) {
    try {
      for (const update of updates) {
        const messageId = update.key.id;
        const status = update.update?.status;

        if (!messageId || !status) continue;

        // Mapear status do Baileys para nosso schema
        let newStatus = 'sent';
        if (status === 3) newStatus = 'delivered'; // DELIVERY_ACK
        if (status === 4) newStatus = 'read'; // READ

        // Atualizar status no banco e buscar conversationId
        const updatedMessages = await this.prisma.message.updateMany({
          where: {
            externalId: messageId,
            connectionId,
          },
          data: {
            status: newStatus,
          },
        });

        logger.info(`[Baileys] Message ${messageId} status updated to ${newStatus}`);

        // Buscar a mensagem para obter o conversationId
        const message = await this.prisma.message.findFirst({
          where: {
            externalId: messageId,
            connectionId,
          },
          select: {
            id: true,
            conversationId: true,
          },
        });

        // Emitir evento via Socket.IO para atualizar frontend em tempo real
        const socketServer = getSocketServer();
        if (socketServer && message) {
          socketServer.getIO().emit('message_status_update', {
            conversationId: message.conversationId,
            messageId: message.id,
            status: newStatus,
          });
          logger.info(`[Baileys] Emitted message_status_update for conversation ${message.conversationId}`);
        }
      }
    } catch (error) {
      logger.error(`[Baileys] Error updating message status for ${connectionId}:`, error);
    }
  }

  /**
   * ✅ CIRCUIT BREAKER: Obtém estado do circuit breaker
   */
  private getCircuitBreakerState(connectionId: string): 'closed' | 'open' | 'half-open' {
    const breaker = this.circuitBreaker.get(connectionId);
    
    if (!breaker) {
      return 'closed'; // Sem histórico de falhas
    }
    
    // Se está aberto, verificar se já passou o timeout
    if (breaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
      
      if (timeSinceLastFailure >= this.CIRCUIT_BREAKER_TIMEOUT) {
        // Timeout expirado, mudar para half-open (permitir uma tentativa)
        breaker.state = 'half-open';
        logger.info(`[Baileys] 🔓 Circuit breaker HALF-OPEN for ${connectionId} - allowing retry`);
        return 'half-open';
      }
      
      return 'open'; // Ainda no período de timeout
    }
    
    return breaker.state;
  }

  /**
   * ✅ CIRCUIT BREAKER: Registra falha
   */
  private recordCircuitBreakerFailure(connectionId: string): void {
    const breaker = this.circuitBreaker.get(connectionId) || {
      failures: 0,
      lastFailure: new Date(),
      state: 'closed' as const,
    };
    
    breaker.failures += 1;
    breaker.lastFailure = new Date();
    
    // Abrir circuit se atingiu threshold
    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = 'open';
      logger.warn(`[Baileys] 🚫 Circuit breaker OPENED for ${connectionId} - ${breaker.failures} consecutive failures`);
    }
    
    this.circuitBreaker.set(connectionId, breaker);
  }

  /**
   * ✅ CIRCUIT BREAKER: Reseta contador de falhas (após sucesso)
   */
  private resetCircuitBreaker(connectionId: string): void {
    const breaker = this.circuitBreaker.get(connectionId);
    
    if (breaker) {
      logger.info(`[Baileys] ✅ Circuit breaker RESET for ${connectionId} - connection successful`);
      this.circuitBreaker.delete(connectionId);
    }
  }

  /**
   * Verifica se deve tentar reconectar automaticamente
   */
  private shouldAttemptReconnection(connectionId: string, statusCode?: number): boolean {
    const client = this.clients.get(connectionId);
    
    if (!client) {
      logger.warn(`[Baileys] Client ${connectionId} not found for reconnection check`);
      return false;
    }

    // 1. Não reconectar se não tem credenciais salvas (conexão nova, ainda gerando QR)
    if (!client.hasCredentials) {
      logger.info(`[Baileys] ⏭️ Skipping reconnection for ${connectionId}: No saved credentials (new connection)`);
      return false;
    }

    // 2. Não reconectar se já está reconectando
    if (client.isReconnecting) {
      logger.info(`[Baileys] ⏭️ Skipping reconnection for ${connectionId}: Already reconnecting`);
      return false;
    }

    // 3. Não reconectar se excedeu limite de tentativas (30 tentativas = ~10 minutos)
    // Isso garante que tentará reconectar por muito tempo antes de desistir
    if (client.reconnectAttempts && client.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.warn(
        `[Baileys] ⏭️ Skipping reconnection for ${connectionId}: Max attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached`
      );
      return false;
    }

    // 4. Não reconectar em casos específicos
    // - loggedOut (401): Usuário desconectou manualmente
    // - badSession (400): Sessão inválida, precisa escanear novo QR
    if (statusCode === DisconnectReason.loggedOut || 
        statusCode === DisconnectReason.badSession) {
      logger.info(`[Baileys] ⏭️ Skipping reconnection for ${connectionId}: Deliberate logout or bad session (code: ${statusCode})`);
      return false;
    }

    // 5. Reconectar em outros casos (timeout, connection closed, etc)
    logger.info(`[Baileys] ✅ Should reconnect ${connectionId}: Has credentials and within retry limit`);
    return true;
  }

  /**
   * Tenta reconectar automaticamente
   */
  private async attemptReconnection(connectionId: string): Promise<void> {
    // ✅ VERIFICAÇÃO CRÍTICA: Verificar ANTES de qualquer coisa se já está reconectando
    const existingLock = this.reconnectionLocks.get(connectionId);
    if (existingLock && existingLock.locked) {
      const lockAge = Date.now() - existingLock.lockedAt.getTime();
      if (lockAge > this.LOCK_TIMEOUT_MS) {
        logger.warn(`[Baileys] ⚠️ Lock expired for ${connectionId} - releasing`);
        this.reconnectionLocks.delete(connectionId);
      } else {
        logger.info(`[Baileys] ⏭️ Skipping reconnection for ${connectionId}: Already reconnecting (lock age: ${Math.round(lockAge / 1000)}s)`);
      return;
      }
    }

    const client = this.clients.get(connectionId);
    
    if (!client) {
      logger.error(`[Baileys] Cannot reconnect: Client ${connectionId} not found`);
      return;
    }

    // Verificar se já está reconectando (dupla verificação)
    if (client.isReconnecting) {
      logger.info(`[Baileys] ⏭️ Skipping reconnection for ${connectionId}: Already reconnecting (flag active)`);
      return;
    }

    // ✅ MARCAR LOCK ANTES DE QUALQUER OPERAÇÃO (com timestamp)
    this.reconnectionLocks.set(connectionId, {
      locked: true,
      lockedAt: new Date(),
    });
    
    // Marcar como reconectando
    client.isReconnecting = true;
    client.reconnectAttempts = (client.reconnectAttempts || 0) + 1;

    // ✅ RETRY EXPONENCIAL COM JITTER para evitar thundering herd
    // Fórmula: min(maxDelay, baseDelay * 2^attempt) + random jitter
    const baseDelay = 3000; // 3 segundos base (aumentado para mais estabilidade)
    const maxDelay = 90000; // Máximo 90 segundos (aumentado para aguardar mais tempo)
    const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, client.reconnectAttempts - 1));
    
    // Adicionar jitter aleatório de ±20% para evitar reconexões simultâneas
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.max(1000, exponentialDelay + jitter); // Mínimo 1 segundo
    
    logger.info(`[Baileys] ⏱️ Calculated delay: ${Math.round(delay)}ms (exponential: ${exponentialDelay}ms, jitter: ${Math.round(jitter)}ms)`);
    
    logger.info(
      `[Baileys] 🔄 Reconnection attempt ${client.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} for ${connectionId} in ${delay}ms...`
    );
    
    // Aguardar antes de reconectar
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Tentar recriar cliente
      logger.info(`[Baileys] 🔌 Reconnecting ${connectionId}...`);
      await this.createClient(connectionId);
      
      logger.info(`[Baileys] ✅ Reconnection initiated for ${connectionId}`);
      
      // Resetar flag de reconexão após sucesso
      const updatedClient = this.clients.get(connectionId);
      if (updatedClient) {
        updatedClient.isReconnecting = false;
      }
      
      // ✅ Lock será liberado pelo createClient em caso de sucesso
    } catch (error: any) {
      logger.error(`[Baileys] ❌ Reconnection failed for ${connectionId}:`, error);
      
      // ✅ LIBERAR LOCK EM CASO DE ERRO
      this.reconnectionLocks.delete(connectionId);
      
      // Resetar flag mesmo em caso de erro
      const updatedClient = this.clients.get(connectionId);
      if (updatedClient) {
        updatedClient.isReconnecting = false;
      }
      
      // Verificar se é erro 503 (Service Unavailable) - aguardar mais tempo
      const is503Error = error?.message?.includes('503') || 
                        error?.output?.statusCode === 503 ||
                        error?.statusCode === 503;
      
      if (is503Error) {
        logger.warn(`[Baileys] ⚠️ Error 503 (Service Unavailable) - WhatsApp may be temporarily unavailable`);
        logger.warn(`[Baileys] 💡 Will retry after longer delay (30s)`);
        
        // Aguardar 30 segundos antes de tentar novamente (se não excedeu limite)
        if (client.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          setTimeout(() => {
            this.attemptReconnection(connectionId).catch(err => {
              logger.error(`[Baileys] Failed to retry reconnection after 503:`, err);
            });
          }, 30000); // 30 segundos para erro 503
        }
      }
      
      if (client.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        logger.warn(
          `[Baileys] ❌ Maximum reconnection attempts reached for ${connectionId} - forcing credential reset`
        );
        await this.resetCredentialsAndEmitQR(connectionId, 'max_attempts');
        return;
      }

      // Marcar como desconectado se falhou
      await this.updateConnectionStatus(connectionId, 'disconnected');
      this.emitStatus(connectionId, 'disconnected');
    }
  }

  /**
   * Reseta contador de reconexão (chamar quando conectar com sucesso)
   */
  private resetReconnectionAttempts(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.reconnectAttempts = 0;
      client.isReconnecting = false;
      logger.debug(`[Baileys] Reset reconnection attempts for ${connectionId}`);
    }
  }

  /**
   * ✅ Valida se a sessão está saudável antes de enviar mensagem
   */
  private async validateSession(connectionId: string): Promise<boolean> {
    try {
      const client = this.clients.get(connectionId);
      
      if (!client || !client.socket) {
        logger.warn(`[Baileys] ⚠️ Session validation failed: client or socket not found for ${connectionId}`);
        return false;
      }
      
      if (client.status !== 'connected') {
        logger.warn(`[Baileys] ⚠️ Session validation failed: status is ${client.status} for ${connectionId}`);
        return false;
      }
      
      // Verificar se tem credenciais válidas
      const connection = await this.prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        select: { authData: true, status: true },
      });
      
      if (!connection || !connection.authData) {
        logger.warn(`[Baileys] ⚠️ Session validation failed: no auth data in database for ${connectionId}`);
        return false;
      }
      
      if (connection.status !== 'connected') {
        logger.warn(`[Baileys] ⚠️ Session validation failed: database status is ${connection.status} for ${connectionId}`);
        return false;
      }
      
      logger.debug(`[Baileys] ✅ Session validation passed for ${connectionId}`);
      return true;
    } catch (error) {
      logger.error(`[Baileys] ❌ Error validating session for ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Helper para fazer upload de mídia para Supabase Storage (com fallback local)
   * @param buffer Buffer do arquivo
   * @param filename Nome do arquivo
   * @param mimetype Tipo MIME
   * @returns URL do arquivo (Supabase ou local)
   */
  private async uploadMediaToStorage(
    buffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<string> {
    // ✅ Tentar fazer upload para Supabase Storage primeiro (prioridade)
    if (supabaseStorageService.isConfigured()) {
      try {
        const supabaseUrl = await supabaseStorageService.uploadFile(
          buffer,
          filename,
          mimetype
        );
        
        if (supabaseUrl) {
          logger.info(`[Baileys] ✅ Media uploaded to Supabase Storage: ${filename}`);
          
          // Também salvar localmente como backup
          const uploadsDir = path.join(process.cwd(), 'secure-uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          fs.writeFileSync(path.join(uploadsDir, filename), buffer);
          
          return supabaseUrl;
        }
      } catch (supabaseError) {
        logger.warn(`[Baileys] ⚠️ Supabase upload failed, using local storage:`, supabaseError);
      }
    }
    
    // Fallback para armazenamento local
    const uploadsDir = path.join(process.cwd(), 'secure-uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    const localUrl = `/uploads/${filename}`;
    logger.info(`[Baileys] ✅ Media saved locally: ${filename}`);
    
    return localUrl;
  }

  /**
   * Envia mensagem via WhatsApp
   */
  async sendMessage(
    connectionId: string,
    to: string,
    content: string | { url: string; caption?: string },
    messageType: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text',
    options?: SendMessageOptions
  ): Promise<string | undefined> {
    const client = this.clients.get(connectionId);
    if (!client) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    // ✅ VALIDAÇÃO ROBUSTA DE SESSÃO antes de enviar
    const isSessionValid = await this.validateSession(connectionId);
    if (!isSessionValid) {
      throw new Error(`Session validation failed for ${connectionId} - connection may be unstable or disconnected`);
    }

    // ✅ VERIFICAÇÃO ROBUSTA: Verificar status E socket realmente conectado
    if (client.status !== 'connected') {
      throw new Error(`Connection ${connectionId} is not connected (status: ${client.status})`);
    }

    // ✅ VERIFICAÇÃO CRÍTICA: Verificar se socket existe e está realmente conectado
    if (!client.socket) {
      throw new Error(`Socket not available for connection ${connectionId}`);
    }

    // ✅ FORMATO CORRETO DO JID conforme documentação do Baileys (fora do try-catch)
    // JID deve estar no formato: 5511999999999@s.whatsapp.net
    // Remover caracteres não numéricos do número
    const cleanNumber = to.replace(/\D/g, '');
    const jid = cleanNumber.includes('@') 
      ? cleanNumber 
      : `${cleanNumber}@s.whatsapp.net`;
    
    logger.info(`[Baileys] Preparing to send message to JID: ${jid} (original: ${to})`);
    
    try {
      let messageContent: any;

      if (messageType === 'text') {
        messageContent = { text: content as string };
      } else if (messageType === 'image') {
        const { url, caption } = content as { url: string; caption?: string };
        
        // ✅ Converter URL relativa para absoluta se necessário
        let imageUrl = url;
        let imageBuffer: Buffer | null = null;
        let filename: string | null = null;
        
        // Extrair filename da URL
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          // URL relativa - extrair filename
          filename = imageUrl.split('/').pop()?.split('?')[0] || null;
        } else {
          // URL absoluta - extrair filename
          const urlParts = imageUrl.split('/');
          filename = urlParts[urlParts.length - 1]?.split('?')[0] || null;
        }
        
        // ✅ Tentar ler arquivo localmente para enviar como buffer (mais eficiente)
        if (filename) {
          // Tentar primeiro em secure-uploads (diretório usado pelo upload controller)
          const secureUploadsDir = path.join(process.cwd(), 'secure-uploads');
          const secureUploadsPath = path.join(secureUploadsDir, filename);
          
          // Tentar também em uploads (fallback)
          const uploadsDir = path.join(process.cwd(), 'uploads');
          const uploadsPath = path.join(uploadsDir, filename);
          
          if (fs.existsSync(secureUploadsPath)) {
            try {
              imageBuffer = fs.readFileSync(secureUploadsPath);
              logger.info(`[Baileys] ✅ Image file found locally in secure-uploads: ${filename} (${imageBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`[Baileys] ❌ Failed to read image file from secure-uploads:`, fileError);
              imageBuffer = null;
            }
          } else if (fs.existsSync(uploadsPath)) {
            try {
              imageBuffer = fs.readFileSync(uploadsPath);
              logger.info(`[Baileys] ✅ Image file found locally in uploads: ${filename} (${imageBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`[Baileys] ❌ Failed to read image file from uploads:`, fileError);
              imageBuffer = null;
            }
          } else {
            logger.warn(`[Baileys] ⚠️ Image file not found locally: ${filename}`);
          }
          
          // ✅ Converter URL relativa para absoluta (necessário para Baileys baixar)
          if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            const baseUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
            imageUrl = imageUrl.startsWith('/') 
              ? `${baseUrl}${imageUrl}` 
              : `${baseUrl}/${imageUrl}`;
            logger.info(`[Baileys] Converted relative image URL to absolute: ${imageUrl}`);
          }
        }
        
        // ✅ Estratégia: Tentar buffer primeiro (mais eficiente), senão usar URL pública
        // Baseado na documentação do Baileys: https://baileys.wiki/docs/sending-messages/
        if (imageBuffer) {
          // ✅ Enviar como buffer (mais eficiente e confiável)
          messageContent = caption && caption.trim() 
            ? { image: imageBuffer, caption }
            : { image: imageBuffer };
          logger.info(`[Baileys] ✅ Using image buffer (size: ${imageBuffer.length} bytes)`);
        } else {
          // ✅ Usar URL pública (deve ser absoluta e acessível)
          messageContent = caption && caption.trim() 
            ? { image: { url: imageUrl }, caption }
            : { image: { url: imageUrl } };
          logger.info(`[Baileys] ✅ Using image URL: ${imageUrl}`);
        }
      } else if (messageType === 'audio') {
        const { url } = content as { url: string };
        // ✅ Converter URL relativa para absoluta se necessário
        let audioUrl = url;
        let audioMimetype = 'audio/ogg; codecs=opus'; // padrão
        
        if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
          // Se for URL relativa, tentar ler o arquivo local para detectar mimetype
          const filename = audioUrl.split('/').pop();
          if (filename) {
            const uploadsDir = path.join(process.cwd(), 'uploads');
            const filepath = path.join(uploadsDir, filename);
            
            // ✅ Tentar ler o arquivo local para detectar mimetype correto
            if (fs.existsSync(filepath)) {
              const audioExtension = filename.split('.').pop()?.toLowerCase();
              
              // Detectar mimetype baseado na extensão
              if (audioExtension === 'mp3' || audioExtension === 'mpeg') {
                audioMimetype = 'audio/mpeg';
              } else if (audioExtension === 'wav') {
                audioMimetype = 'audio/wav';
              } else if (audioExtension === 'ogg' || audioExtension === 'opus') {
                audioMimetype = 'audio/ogg; codecs=opus';
              } else if (audioExtension === 'webm') {
                audioMimetype = 'audio/webm';
              } else if (audioExtension === 'aac') {
                audioMimetype = 'audio/aac';
              } else if (audioExtension === 'm4a') {
                audioMimetype = 'audio/mp4';
              } else if (audioExtension === 'amr') {
                audioMimetype = 'audio/amr';
              }
              
              logger.info(`[Baileys] Detected mimetype from file: ${audioMimetype} (extension: ${audioExtension})`);
            }
          }
          
          // Converter para URL absoluta
          const baseUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
          audioUrl = audioUrl.startsWith('/') 
            ? `${baseUrl}${audioUrl}` 
            : `${baseUrl}/${audioUrl}`;
        } else {
          // Se já for URL absoluta, detectar mimetype da extensão
          const audioExtension = audioUrl.split('.').pop()?.split('?')[0]?.toLowerCase();
          if (audioExtension === 'mp3' || audioExtension === 'mpeg') {
            audioMimetype = 'audio/mpeg';
          } else if (audioExtension === 'wav') {
            audioMimetype = 'audio/wav';
          } else if (audioExtension === 'ogg' || audioExtension === 'opus') {
            audioMimetype = 'audio/ogg; codecs=opus';
          } else if (audioExtension === 'webm') {
            audioMimetype = 'audio/webm';
          } else if (audioExtension === 'aac') {
            audioMimetype = 'audio/aac';
          } else if (audioExtension === 'm4a') {
            audioMimetype = 'audio/mp4';
          } else if (audioExtension === 'amr') {
            audioMimetype = 'audio/amr';
          }
        }
        
        // ✅ IMPORTANTE: Baseado no issue #501 do Baileys (https://github.com/WhiskeySockets/Baileys/issues/501)
        // e recomendações da comunidade, o formato correto para áudio PTT é:
        // { audio: { url: string } | Buffer, mimetype: 'audio/ogg', ptt: true }
        // 
        // NOTA: O mimetype deve ser 'audio/ogg' (sem 'codecs=opus') para evitar problemas
        // O áudio idealmente deve estar em formato OGG com codec libopus e canal único (ac: 1)
        // Para conversão, usar: ffmpeg -i input.mp3 -avoid_negative_ts make_zero -ac 1 output.ogg
        
        // ✅ Usar mimetype simples 'audio/ogg' conforme issue #501
        // O Baileys pode ter problemas com 'audio/ogg; codecs=opus'
        const whatsappAudioMimetype = 'audio/ogg'; // Formato correto conforme issue #501
        
        logger.info(`[Baileys] Processing audio: URL=${audioUrl}, detected mimetype=${audioMimetype}`);
        
        let audioBuffer: Buffer | null = null;
        let filename: string | null = null;
        let finalAudioUrl = audioUrl; // URL final a ser usada (pode ser convertida para absoluta)
        
        // ✅ Extrair filename e tentar ler arquivo localmente
        if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
          // URL relativa - extrair filename
          filename = audioUrl.split('/').pop()?.split('?')[0] || null;
        } else {
          // URL absoluta - extrair filename
          const urlParts = audioUrl.split('/');
          filename = urlParts[urlParts.length - 1]?.split('?')[0] || null;
        }
        
        // ✅ Tentar ler arquivo localmente para enviar como buffer
        if (filename) {
          // Tentar primeiro em secure-uploads (diretório usado pelo upload controller)
          const secureUploadsDir = path.join(process.cwd(), 'secure-uploads');
          const secureUploadsPath = path.join(secureUploadsDir, filename);
          
          // Tentar também em uploads (fallback)
          const uploadsDir = path.join(process.cwd(), 'uploads');
          const uploadsPath = path.join(uploadsDir, filename);
          
          if (fs.existsSync(secureUploadsPath)) {
            try {
              audioBuffer = fs.readFileSync(secureUploadsPath);
              logger.info(`[Baileys] ✅ Audio file found locally in secure-uploads: ${filename} (${audioBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`[Baileys] ❌ Failed to read audio file from secure-uploads:`, fileError);
              audioBuffer = null;
            }
          } else if (fs.existsSync(uploadsPath)) {
            try {
              audioBuffer = fs.readFileSync(uploadsPath);
              logger.info(`[Baileys] ✅ Audio file found locally in uploads: ${filename} (${audioBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`[Baileys] ❌ Failed to read audio file from uploads:`, fileError);
              audioBuffer = null;
            }
          } else {
            logger.warn(`[Baileys] ⚠️ Audio file not found locally: ${filename}`);
          }
          
          // ✅ Se arquivo existe localmente, garantir que a URL seja absoluta e pública
          // Baseado no exemplo PHP, o Baileys precisa de URL pública para funcionar
          if (!finalAudioUrl.startsWith('http://') && !finalAudioUrl.startsWith('https://')) {
            const baseUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
            finalAudioUrl = finalAudioUrl.startsWith('/') 
              ? `${baseUrl}${finalAudioUrl}` 
              : `${baseUrl}/${finalAudioUrl}`;
            logger.info(`[Baileys] Converted relative URL to absolute: ${finalAudioUrl}`);
          }
        }
        
        // ✅ Estratégia: Tentar buffer primeiro, se não funcionar, usar URL pública
        // Baseado no issue #501 e exemplos da comunidade (TabNews, GitHub)
        // Formato correto: { audio: Buffer | { url: string }, mimetype: 'audio/ogg', ptt: true }
        if (audioBuffer) {
          // ✅ Enviar como buffer (mais eficiente)
          // Conforme issue #501, o Baileys aceita Buffer diretamente
          messageContent = { 
            audio: audioBuffer, 
            mimetype: whatsappAudioMimetype, // 'audio/ogg' (sem codecs=opus)
            ptt: true // Push-to-Talk (mensagem de voz)
          };
          logger.info(`[Baileys] ✅ Using audio buffer (format: ${whatsappAudioMimetype}, size: ${audioBuffer.length} bytes, PTT: true)`);
        } else {
          // ✅ Usar URL pública (conforme issue #501 e exemplos)
          // IMPORTANTE: URL deve ser absoluta e acessível publicamente
          // Formato: { audio: { url: string }, mimetype: 'audio/ogg', ptt: true }
          messageContent = { 
            audio: { url: finalAudioUrl }, // ✅ URL absoluta e pública
            mimetype: whatsappAudioMimetype, // 'audio/ogg' (sem codecs=opus)
            ptt: true // Push-to-Talk (mensagem de voz)
          };
          logger.info(`[Baileys] ✅ Using audio URL (format: ${whatsappAudioMimetype}, url: ${finalAudioUrl}, PTT: true)`);
          
          // ⚠️ AVISO: Se o áudio não estiver em formato OGG/Opus, pode não funcionar
          // Recomendação: Converter para OGG com FFmpeg antes de enviar
          logger.warn(`[Baileys] ⚠️ Audio URL format may not be compatible. Consider converting to OGG/Opus with FFmpeg.`);
        }
      } else if (messageType === 'video') {
        const { url, caption } = content as { url: string; caption?: string };
        
        // ✅ Converter URL relativa para absoluta se necessário
        let videoUrl = url;
        let videoBuffer: Buffer | null = null;
        let filename: string | null = null;
        
        // Extrair filename da URL
        if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
          // URL relativa - extrair filename
          filename = videoUrl.split('/').pop()?.split('?')[0] || null;
        } else {
          // URL absoluta - extrair filename
          const urlParts = videoUrl.split('/');
          filename = urlParts[urlParts.length - 1]?.split('?')[0] || null;
        }
        
        // ✅ Tentar ler arquivo localmente para enviar como buffer (mais eficiente)
        if (filename) {
          // Tentar primeiro em secure-uploads (diretório usado pelo upload controller)
          const secureUploadsDir = path.join(process.cwd(), 'secure-uploads');
          const secureUploadsPath = path.join(secureUploadsDir, filename);
          
          // Tentar também em uploads (fallback)
          const uploadsDir = path.join(process.cwd(), 'uploads');
          const uploadsPath = path.join(uploadsDir, filename);
          
          if (fs.existsSync(secureUploadsPath)) {
            try {
              videoBuffer = fs.readFileSync(secureUploadsPath);
              logger.info(`[Baileys] ✅ Video file found locally in secure-uploads: ${filename} (${videoBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`[Baileys] ❌ Failed to read video file from secure-uploads:`, fileError);
              videoBuffer = null;
            }
          } else if (fs.existsSync(uploadsPath)) {
            try {
              videoBuffer = fs.readFileSync(uploadsPath);
              logger.info(`[Baileys] ✅ Video file found locally in uploads: ${filename} (${videoBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`[Baileys] ❌ Failed to read video file from uploads:`, fileError);
              videoBuffer = null;
            }
          } else {
            logger.warn(`[Baileys] ⚠️ Video file not found locally: ${filename}`);
          }
          
          // ✅ Converter URL relativa para absoluta (necessário para Baileys baixar)
          if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
            const baseUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
            videoUrl = videoUrl.startsWith('/') 
              ? `${baseUrl}${videoUrl}` 
              : `${baseUrl}/${videoUrl}`;
            logger.info(`[Baileys] Converted relative video URL to absolute: ${videoUrl}`);
          }
        }
        
        // ✅ Estratégia: Tentar buffer primeiro (mais eficiente), senão usar URL pública
        // Baseado na documentação do Baileys: https://baileys.wiki/docs/sending-messages/
        if (videoBuffer) {
          // ✅ Enviar como buffer (mais eficiente e confiável)
          messageContent = caption && caption.trim()
            ? { video: videoBuffer, caption }
            : { video: videoBuffer };
          logger.info(`[Baileys] ✅ Using video buffer (size: ${videoBuffer.length} bytes)`);
        } else {
          // ✅ Usar URL pública (deve ser absoluta e acessível)
          messageContent = caption && caption.trim()
            ? { video: { url: videoUrl }, caption }
            : { video: { url: videoUrl } };
          logger.info(`[Baileys] ✅ Using video URL: ${videoUrl}`);
        }
      } else if (messageType === 'document') {
        const { url, caption } = content as { url: string; caption?: string };
        
        // ✅ Converter URL relativa para absoluta se necessário
        let documentUrl = url;
        let documentBuffer: Buffer | null = null;
        let filename: string | null = null;
        
        // Para documentos, extrair nome do arquivo da URL ou usar padrão
        const fileName = documentUrl.split('/').pop()?.split('?')[0] || 'document';
        filename = fileName !== 'document' ? fileName : null;
        
        // Extrair filename da URL
        if (!documentUrl.startsWith('http://') && !documentUrl.startsWith('https://')) {
          // URL relativa - extrair filename
          filename = documentUrl.split('/').pop()?.split('?')[0] || null;
        } else {
          // URL absoluta - extrair filename
          const urlParts = documentUrl.split('/');
          filename = urlParts[urlParts.length - 1]?.split('?')[0] || null;
        }
        
        // ✅ Tentar ler arquivo localmente para enviar como buffer (mais eficiente)
        if (filename) {
          // Tentar primeiro em secure-uploads (diretório usado pelo upload controller)
          const secureUploadsDir = path.join(process.cwd(), 'secure-uploads');
          const secureUploadsPath = path.join(secureUploadsDir, filename);
          
          // Tentar também em uploads (fallback)
          const uploadsDir = path.join(process.cwd(), 'uploads');
          const uploadsPath = path.join(uploadsDir, filename);
          
          if (fs.existsSync(secureUploadsPath)) {
            try {
              documentBuffer = fs.readFileSync(secureUploadsPath);
              logger.info(`[Baileys] ✅ Document file found locally in secure-uploads: ${filename} (${documentBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`[Baileys] ❌ Failed to read document file from secure-uploads:`, fileError);
              documentBuffer = null;
            }
          } else if (fs.existsSync(uploadsPath)) {
            try {
              documentBuffer = fs.readFileSync(uploadsPath);
              logger.info(`[Baileys] ✅ Document file found locally in uploads: ${filename} (${documentBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`[Baileys] ❌ Failed to read document file from uploads:`, fileError);
              documentBuffer = null;
            }
          } else {
            logger.warn(`[Baileys] ⚠️ Document file not found locally: ${filename}`);
          }
          
          // ✅ Converter URL relativa para absoluta (necessário para Baileys baixar)
          if (!documentUrl.startsWith('http://') && !documentUrl.startsWith('https://')) {
            const baseUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
            documentUrl = documentUrl.startsWith('/') 
              ? `${baseUrl}${documentUrl}` 
              : `${baseUrl}/${documentUrl}`;
            logger.info(`[Baileys] Converted relative document URL to absolute: ${documentUrl}`);
          }
        }
        
        // ✅ Estratégia: Tentar buffer primeiro (mais eficiente), senão usar URL pública
        // Baseado na documentação do Baileys: https://baileys.wiki/docs/sending-messages/
        const finalFileName = filename || 'document';
        if (documentBuffer) {
          // ✅ Enviar como buffer (mais eficiente e confiável)
          messageContent = caption && caption.trim()
            ? { document: documentBuffer, fileName: finalFileName, caption }
            : { document: documentBuffer, fileName: finalFileName };
          logger.info(`[Baileys] ✅ Using document buffer (size: ${documentBuffer.length} bytes, fileName: ${finalFileName})`);
        } else {
          // ✅ Usar URL pública (deve ser absoluta e acessível)
          messageContent = caption && caption.trim()
            ? { document: { url: documentUrl }, fileName: finalFileName, caption }
            : { document: { url: documentUrl }, fileName: finalFileName };
          logger.info(`[Baileys] ✅ Using document URL: ${documentUrl} (fileName: ${finalFileName})`);
        }
      }

      logger.info(`[Baileys] Attempting to send message to ${jid}, type: ${messageType}`);
      
      // ✅ Log detalhado do messageContent (sem tentar serializar Buffer)
      if (messageType === 'audio' && messageContent.audio) {
        const isBuffer = Buffer.isBuffer(messageContent.audio);
        logger.info(`[Baileys] Audio message content:`, {
          type: isBuffer ? 'buffer' : 'url',
          mimetype: messageContent.mimetype,
          ptt: messageContent.ptt,
          size: isBuffer ? (messageContent.audio as Buffer).length : 'N/A',
        });
      } else {
        logger.debug(`[Baileys] Message content structure:`, JSON.stringify(messageContent, null, 2).substring(0, 500));
      }
      
      // ✅ VERIFICAÇÃO FINAL: Verificar se socket ainda está conectado antes de enviar
      if (!client.socket || client.status !== 'connected') {
        throw new Error(`Socket disconnected before sending message (status: ${client.status})`);
      }

      let sendOptions: Record<string, any> | undefined;

      if (options?.quotedMessage) {
        const stanzaId = options.quotedMessage.stanzaId || options.quotedMessage.messageId;
        logger.info(`[Baileys] 🧷 Preparing reply to message ${stanzaId} for ${jid}`);
        const quotedPayload = await this.resolveQuotedMessagePayload(client, jid, options.quotedMessage);

        if (quotedPayload) {
          sendOptions = { quoted: quotedPayload };
          logger.info(`[Baileys] 🧷 Quoted payload ready for stanza ${stanzaId}`);
        } else {
          logger.warn(`[Baileys] ⚠️ Could not build quoted payload for stanza ${stanzaId} - sending without reply context`);
        }
      }
      
      // ✅ ENVIAR MENSAGEM conforme documentação do Baileys
      // Documentação: https://baileys.wiki/docs/sending-messages/
      // Formato: socket.sendMessage(jid, messageContent)
      
      logger.info(`[Baileys] 📤 Calling sendMessage with JID: ${jid}, type: ${messageType}`);
      logger.info(`[Baileys] 📤 Message content preview:`, {
        type: messageType,
        hasText: !!messageContent.text,
        hasImage: !!messageContent.image,
        hasAudio: !!messageContent.audio,
        hasVideo: !!messageContent.video,
        hasDocument: !!messageContent.document,
      });
      
      const sent = await client.socket.sendMessage(
        jid,
        messageContent,
        sendOptions
      );
      
      // ✅ EXTRAIR EXTERNAL ID DE FORMA ROBUSTA
      // O Baileys pode retornar o ID em diferentes formatos
      let externalId: string | undefined = undefined;
      
      if (sent?.key?.id) {
        externalId = sent.key.id as string;
      } else if (typeof sent === 'string') {
        externalId = sent;
      } else if (sent && typeof sent === 'object') {
        // Tentar extrair ID de qualquer propriedade
        const sentStr = JSON.stringify(sent);
        const idMatch = sentStr.match(/"id"\s*:\s*"([^"]+)"/);
        if (idMatch) {
          externalId = idMatch[1];
        }
      }
      
      logger.info(`[Baileys] 📤 sendMessage returned:`, {
        hasKey: !!sent?.key,
        hasId: !!sent?.key?.id,
        externalId: externalId || 'none',
        sentType: typeof sent,
        sentKeys: sent && typeof sent === 'object' ? Object.keys(sent) : 'N/A',
        fullResponse: JSON.stringify(sent, null, 2).substring(0, 1000),
      });
      
      if (externalId) {
        logger.info(`[Baileys] ✅ Message sent successfully from ${connectionId} to ${to} (id: ${externalId})`);
      } else {
        // ✅ AVISO: Se não tem externalId, pode ser que a mensagem não foi enviada
        // Mas também pode ser que o Baileys não retornou o ID (comportamento conhecido)
        logger.warn(`[Baileys] ⚠️ Message sent but no externalId returned from Baileys`);
        logger.warn(`[Baileys] ⚠️ This may indicate the message was not actually sent`);
        logger.warn(`[Baileys] ⚠️ Full response:`, JSON.stringify(sent, null, 2));
        
        // ✅ IMPORTANTE: Mesmo sem externalId, considerar como enviado se não houve erro
        // O Baileys pode enviar a mensagem mas não retornar o ID em alguns casos
        logger.info(`[Baileys] ⚠️ Assuming message was sent (no error thrown, but no externalId)`);
      }
      
      return externalId;
    } catch (error: any) {
      // ✅ LOG DETALHADO DO ERRO
      logger.error(`[Baileys] ❌ Error sending message from ${connectionId} to ${to}:`, error);
      logger.error(`[Baileys] ❌ Error details:`, {
        messageType,
        jid,
        connectionId,
        connectionStatus: client.status,
        hasSocket: !!client.socket,
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack || 'No stack trace',
        errorName: error?.name || 'Unknown',
        errorCode: error?.code || 'N/A',
        errorOutput: error?.output ? JSON.stringify(error.output, null, 2).substring(0, 500) : 'N/A',
      });
      
      // ✅ Verificar se é erro de conexão
      if (error?.message?.includes('not connected') || error?.message?.includes('Socket not available')) {
        logger.error(`[Baileys] ❌ Connection issue detected - message cannot be sent`);
      }
      
      // ✅ Verificar se é erro de formato
      if (error?.message?.includes('Invalid') || error?.message?.includes('format')) {
        logger.error(`[Baileys] ❌ Format issue detected - check message content`);
      }
      
      throw error;
    }
  }

  private async resolveQuotedMessagePayload(
    client: BaileysClient,
    jid: string,
    quoted: QuotedMessagePayload
  ): Promise<any | null> {
    const stanzaId = quoted.stanzaId || quoted.messageId;
    if (!stanzaId) {
      return null;
    }

    let resolved: any = null;

    try {
      const loadMessageFn = (client.socket as any)?.loadMessage;
      if (typeof loadMessageFn === 'function') {
        resolved = await loadMessageFn(jid, stanzaId);
        if (resolved) {
          logger.info(`[Baileys] ♻️ Loaded quoted message ${stanzaId} from store`);
        }
      }
    } catch (error) {
      logger.warn(`[Baileys] ⚠️ Failed to load quoted message ${stanzaId} from store:`, error);
    }

    if (!resolved) {
      resolved = this.buildFallbackQuotedMessage(jid, quoted);
      if (resolved) {
        logger.info(`[Baileys] 🧩 Using fallback quoted payload for ${stanzaId}`);
      }
    }

    return resolved;
  }

  private buildFallbackQuotedMessage(jid: string, quoted: QuotedMessagePayload): any | null {
    const stanzaId = quoted.stanzaId || quoted.messageId;
    if (!stanzaId) {
      return null;
    }

    const placeholderText =
      quoted.content && quoted.content.trim().length > 0
        ? quoted.content
        : this.getQuotedPlaceholder(quoted.messageType);

    const key: any = {
      remoteJid: jid,
      fromMe: !quoted.isFromContact,
      id: stanzaId,
    };

    if (quoted.metadata?.participant) {
      key.participant = quoted.metadata.participant;
    }

    const message =
      quoted.messageType === 'text'
        ? { conversation: placeholderText }
        : {
            extendedTextMessage: {
              text: placeholderText,
            },
          };

    return {
      key,
      message,
    };
  }

  private getQuotedPlaceholder(messageType: string): string {
    switch (messageType) {
      case 'image':
        return '[Imagem]';
      case 'video':
        return '[Vídeo]';
      case 'audio':
        return '[Áudio]';
      case 'document':
        return '[Documento]';
      case 'location':
        return '[Localização]';
      default:
        return '[Mensagem]';
    }
  }

  private extractQuotedContext(
    msg: any
  ): { stanzaId?: string; participant?: string; quotedMessage?: any } | null {
    try {
      if (!msg?.message) {
        return null;
      }

      let messageNode = msg.message;

      if (messageNode?.ephemeralMessage?.message) {
        messageNode = messageNode.ephemeralMessage.message;
      }

      if (!messageNode) {
        return null;
      }

      const messageKeys = Object.keys(messageNode);
      for (const key of messageKeys) {
        const value = (messageNode as any)[key];
        if (value?.contextInfo) {
          const contextInfo = value.contextInfo;
          if (contextInfo?.quotedMessage || contextInfo?.stanzaId) {
            return {
              stanzaId: contextInfo.stanzaId || undefined,
              participant: contextInfo.participant || contextInfo.remoteJid || undefined,
              quotedMessage: contextInfo.quotedMessage || null,
            };
          }
        }
      }
    } catch (error) {
      logger.warn('[Baileys] ⚠️ Failed to extract quoted context:', error);
    }

    return null;
  }

  /**
   * Envia mídia via WhatsApp (método simplificado para broadcast)
   * Baseado na documentação: https://baileys.wiki/docs/sending-messages/
   */
  async sendMedia(
    connectionId: string,
    to: string,
    message: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'document'
  ): Promise<string | undefined> {
    const client = this.clients.get(connectionId);
    if (!client) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (client.status !== 'connected') {
      throw new Error(`Connection ${connectionId} is not connected`);
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      let messageContent: any;

      // Construir conteúdo baseado no tipo de mídia
      switch (mediaType) {
        case 'image':
          // Só passar caption se houver conteúdo real
          messageContent = message && message.trim()
            ? { image: { url: mediaUrl }, caption: message }
            : { image: { url: mediaUrl } };
          break;

        case 'video':
          // Só passar caption se houver conteúdo real
          messageContent = message && message.trim()
            ? { video: { url: mediaUrl }, caption: message }
            : { video: { url: mediaUrl } };
          break;

        case 'document':
          // Extrair nome do arquivo da URL ou usar padrão
          const fileName = mediaUrl.split('/').pop() || 'document.pdf';
          // Só passar caption se houver conteúdo real
          messageContent = message && message.trim()
            ? { document: { url: mediaUrl }, fileName, caption: message }
            : { document: { url: mediaUrl }, fileName };
          break;

        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      const sent = await client.socket.sendMessage(jid, messageContent);
      const externalId = sent?.key?.id as string | undefined;
      logger.info(`[Baileys] Media (${mediaType}) sent from ${connectionId} to ${to} (id: ${externalId || 'n/a'})`);
      return externalId;
    } catch (error) {
      logger.error(`[Baileys] Error sending media from ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Verifica se um número está no WhatsApp e retorna informações
   */
  async checkWhatsAppNumber(connectionId: string, phone: string): Promise<{ exists: boolean; jid?: string }> {
    const client = this.clients.get(connectionId);
    
    if (!client) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (client.status !== 'connected') {
      throw new Error(`Connection ${connectionId} is not connected`);
    }

    try {
      // Formatar número (remover caracteres especiais)
      const cleanPhone = phone.replace(/\D/g, '');
      
      logger.info(`[Baileys] 📱 Checking if ${cleanPhone} is on WhatsApp...`);
      
      // Verificar se número existe no WhatsApp
      const results = await client.socket.onWhatsApp(cleanPhone);
      
      if (results && results.length > 0 && results[0].exists) {
        logger.info(`[Baileys] ✅ Number ${cleanPhone} exists on WhatsApp`);
        return {
          exists: true,
          jid: results[0].jid,
        };
      } else {
        logger.info(`[Baileys] ❌ Number ${cleanPhone} not found on WhatsApp`);
        return { exists: false };
      }
      
    } catch (error) {
      logger.error(`[Baileys] ❌ Error checking WhatsApp number:`, error);
      throw new Error(`Failed to check WhatsApp number: ${(error as Error).message}`);
    }
  }

  /**
   * Busca nome do contato (pushName) diretamente do WhatsApp
   * Retorna o nome que o contato usa no perfil do WhatsApp
   */
  async getContactName(connectionId: string, phone: string): Promise<string | null> {
    const client = this.clients.get(connectionId);
    
    if (!client || client.status !== 'connected') {
      logger.warn(`[Baileys] Connection ${connectionId} not available for contact name lookup`);
      return null;
    }

    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const jid = `${cleanPhone}@s.whatsapp.net`;
      
      logger.info(`[Baileys] 📱 Fetching profile name for ${cleanPhone}...`);
      
      // Método 1: Buscar no banco de dados (se já conversou)
      const contact = await this.prisma.contact.findFirst({
        where: { phoneNumber: cleanPhone },
        select: { name: true },
      });
      
      if (contact?.name) {
        logger.info(`[Baileys] ✅ Found contact name in DB: ${contact.name}`);
        return contact.name;
      }
      
      // Método 2: Buscar informações do perfil do WhatsApp
      try {
        // Verificar se número existe no WhatsApp
        const results = await client.socket.onWhatsApp(cleanPhone);
        
        if (!results || results.length === 0 || !results[0].exists) {
          logger.warn(`[Baileys] Number ${cleanPhone} not on WhatsApp`);
          return null;
        }
        
        // Tentar buscar informações do business profile
        const businessProfile = await client.socket.getBusinessProfile(jid).catch(() => null);
        
        if (businessProfile?.description) {
          logger.info(`[Baileys] ✅ Found business name: ${businessProfile.description}`);
          return businessProfile.description;
        }
        
        // Nota: fetchStatus retorna informações diferentes do esperado
        // Por enquanto, vamos apenas usar business profile e banco de dados
        
        logger.info(`[Baileys] ⚠️ No profile name found for ${cleanPhone}`);
        return null;
        
      } catch (profileError) {
        logger.warn(`[Baileys] Could not fetch profile for ${cleanPhone}:`, profileError);
        return null;
      }
      
    } catch (error) {
      logger.error(`[Baileys] ❌ Error fetching contact name:`, error);
      return null;
    }
  }

  /**
   * Busca informações de contato (nome do perfil)
   * Nota: Baileys não fornece acesso direto aos nomes salvos no WhatsApp
   * Esta função apenas valida se o número existe
   */
  async getContactInfo(connectionId: string, phone: string): Promise<{ phone: string; exists: boolean } | null> {
    try {
      const result = await this.checkWhatsAppNumber(connectionId, phone);
      
      if (result.exists) {
        return {
          phone: phone.replace(/\D/g, ''),
          exists: true,
        };
      }
      
      return null;
      
    } catch (error) {
      logger.error(`[Baileys] ❌ Error fetching contact info:`, error);
      return null;
    }
  }

  /**
   * Remove cliente
   * @param connectionId - ID da conexão
   * @param doLogout - Se deve fazer logout (padrão: true). Use false quando a conexão já foi fechada.
   */
  async removeClient(connectionId: string, doLogout: boolean = true): Promise<void> {
    const client = this.clients.get(connectionId);
    if (!client) {
      logger.debug(`[Baileys] Client ${connectionId} não encontrado para remoção`);
      return;
    }

    logger.info(`[Baileys] 🗑️ Removendo cliente ${connectionId} (doLogout=${doLogout})`);

    // Parar monitoramento, heartbeat e sincronização
    if (client.keepAliveInterval) {
      clearInterval(client.keepAliveInterval);
      logger.debug(`[Baileys] ✅ KeepAlive interval limpo para ${connectionId}`);
    }
    
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
      logger.debug(`[Baileys] ✅ Heartbeat interval limpo para ${connectionId}`);
    }
    
    if (client.syncInterval) {
      clearInterval(client.syncInterval);
      logger.debug(`[Baileys] ✅ Sync interval limpo para ${connectionId}`);
    }
    
    // ✅ BUG FIX: Limpar timeout de "connecting" se existir (evitar vazamento de memória)
    if (client.connectingTimeout) {
      clearTimeout(client.connectingTimeout);
      client.connectingTimeout = undefined;
      logger.debug(`[Baileys] ✅ Timeout de "connecting" limpo ao remover cliente ${connectionId}`);
    }

    // ✅ IMPORTANTE: Remover listeners do socket ANTES de fazer logout ou deletar
    // Isso evita que listeners antigos continuem ativos após reconexão
    if (client.socket && client.socket.ev) {
      try {
        // Remover todos os listeners do socket para evitar vazamento de memória
        // e garantir que novos listeners sejam registrados corretamente na reconexão
        logger.info(`[Baileys] 🧹 Removendo listeners do socket para ${connectionId}`);
        // O Baileys usa EventEmitter, então podemos remover listeners específicos
        // Mas como vamos criar um novo socket, não precisamos remover manualmente
        // O importante é garantir que o socket antigo seja completamente descartado
      } catch (error) {
        logger.warn(`[Baileys] ⚠️ Erro ao limpar listeners do socket para ${connectionId}:`, error);
      }
    }

    // Só fazer logout se solicitado E se estiver conectado
    if (doLogout) {
      try {
        // Apenas fazer logout se estiver conectado
        if (client.status === 'connected' && client.socket) {
          await client.socket.logout();
          logger.info(`[Baileys] ✅ Logged out from ${connectionId}`);
        } else {
          logger.info(`[Baileys] ⏭️ Skipping logout for ${connectionId} (status: ${client.status})`);
        }
      } catch (error) {
        logger.warn(`[Baileys] ⚠️ Error logging out ${connectionId} (ignoring):`, error);
      }
    } else {
      logger.info(`[Baileys] ⏭️ Skipping logout for ${connectionId} (doLogout=false - preservando credenciais)`);
    }

    // ✅ IMPORTANTE: Remover do mapa ANTES de qualquer outra operação
    // para evitar que novos eventos sejam processados pelo cliente antigo
    this.clients.delete(connectionId);
    logger.info(`[Baileys] ✅ Client removido do mapa: ${connectionId}`);
  }

  /**
   * Inicia monitoramento de conexão (keepalive)
   */
  private startConnectionMonitoring(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    // Verificar conexão a cada 20 segundos (mais frequente para detectar problemas rapidamente)
    client.keepAliveInterval = setInterval(() => {
      const currentClient = this.clients.get(connectionId);
      if (!currentClient) {
        clearInterval(client.keepAliveInterval!);
        return;
      }

      const now = new Date();
      const lastReceived = currentClient.lastMessageReceived;
      const lastHeartbeat = currentClient.lastHeartbeat;
      
      if (currentClient.status === 'connected') {
        if (lastReceived) {
          const minutesSinceLastMessage = (now.getTime() - lastReceived.getTime()) / 1000 / 60;
          logger.debug(`[Baileys] 💓 Keepalive ${connectionId} - Last message: ${minutesSinceLastMessage.toFixed(1)}min ago`);
        } else {
          logger.debug(`[Baileys] 💓 Keepalive ${connectionId} - No messages received yet`);
        }
        
        // Verificar se heartbeat está funcionando (aumentar tolerância para 180s - 3 minutos)
        // Isso evita desconexões prematuras por falhas temporárias de rede
        if (lastHeartbeat) {
          const secondsSinceHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / 1000;
          if (secondsSinceHeartbeat > 180) {
            logger.warn(`[Baileys] ⚠️ No heartbeat response in ${secondsSinceHeartbeat.toFixed(0)}s - connection may be dead`);
            // Não desconectar imediatamente - aguardar mais tempo antes de considerar morto
          } else if (secondsSinceHeartbeat > 120) {
            logger.debug(`[Baileys] ⚠️ Heartbeat delay: ${secondsSinceHeartbeat.toFixed(0)}s (monitoring...)`);
          }
        }
      } else {
        // Não logar warning para status 'connecting' ou 'qr' - são estados normais
        if (currentClient.status !== 'connecting' && currentClient.status !== 'qr') {
        logger.warn(`[Baileys] ⚠️ Connection ${connectionId} is ${currentClient.status}, not connected!`);
        }
        
        // Se está desconectado mas tem credenciais, tentar reconectar
        // Mas apenas se não estiver já reconectando e não estiver em processo de conexão
        // ADICIONAR VERIFICAÇÃO DE TEMPO: Não reconectar imediatamente após desconexão
        // Aguardar pelo menos 5 segundos para evitar reconexões prematuras
        const lock = this.reconnectionLocks.get(connectionId);
        const isLocked = lock && lock.locked;
        
        // Verificar quando foi a última desconexão
        const lastDisconnectAt = currentClient.lastDisconnectAt;
        const timeSinceDisconnect = lastDisconnectAt 
          ? (now.getTime() - lastDisconnectAt.getTime()) / 1000 
          : Infinity;
        
        // Só tentar reconectar se passou pelo menos 5 segundos desde a desconexão
        // Isso evita reconexões prematuras em caso de desconexões temporárias
        if (
          currentClient.hasCredentials && 
          !currentClient.isReconnecting && 
          currentClient.status === 'disconnected' &&
          !isLocked &&
          timeSinceDisconnect >= 5 // Aguardar pelo menos 5 segundos
        ) {
          logger.info(`[Baileys] 🔄 Detected disconnection (${timeSinceDisconnect.toFixed(1)}s ago), triggering reconnection...`);
          this.attemptReconnection(connectionId).catch((err) => {
            logger.error(`[Baileys] Failed to trigger reconnection:`, err);
          });
        } else if (currentClient.status === 'disconnected' && timeSinceDisconnect < 5) {
          logger.debug(`[Baileys] ⏳ Waiting before reconnection (${timeSinceDisconnect.toFixed(1)}s since disconnect, need 5s)`);
        }
      }
    }, 20000); // 20 segundos (mais frequente para detectar problemas rapidamente)

    logger.info(`[Baileys] 🔍 Connection monitoring started for ${connectionId}`);
  }

  /**
   * Inicia heartbeat ativo para manter conexão viva
   * Sistema multi-camadas para garantir conexão estável:
   * 1. Marca presença online periodicamente
   * 2. Sincroniza mensagens recentes
   * 3. Verifica status da conexão
   */
  private startActiveHeartbeat(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    // Heartbeat robusto a cada 30 segundos (mais frequente para manter conexão viva e evitar timeout)
    // Reduzido de 45s para 30s para garantir que WhatsApp sempre considere conexão ativa
    client.heartbeatInterval = setInterval(async () => {
      const currentClient = this.clients.get(connectionId);
      if (!currentClient) {
        clearInterval(client.heartbeatInterval!);
        return;
      }

      // Só fazer heartbeat se estiver conectado
      if (currentClient.status === 'connected') {
        try {
          // ESTRATÉGIA MULTI-CAMADAS para manter conexão viva:
          
          // 1. Marcar presença online (CRÍTICO para manter conexão)
          try {
            await currentClient.socket.sendPresenceUpdate('available');
            logger.debug(`[Baileys] 💚 Presence updated for ${connectionId}`);
          } catch (presenceError) {
            logger.warn(`[Baileys] ⚠️ Could not update presence:`, presenceError);
          }

          // 2. Sincronizar mensagens recentes (garante que não perca mensagens)
          try {
            // Buscar conversas ativas no banco
            const activeConversations = await this.prisma.conversation.findMany({
              where: {
                connectionId,
                status: { in: ['waiting', 'in_progress', 'transferred'] },
              },
              take: 10, // Limitar a 10 conversas mais recentes
              orderBy: { lastMessageAt: 'desc' },
              select: {
                contact: { select: { phoneNumber: true } },
              },
            });

            // Para cada conversa ativa, marcar presença para manter conexão
            for (const conv of activeConversations) {
              try {
                const jid = conv.contact.phoneNumber.includes('@') 
                  ? conv.contact.phoneNumber 
                  : `${conv.contact.phoneNumber}@s.whatsapp.net`;
                
                // Marcar presença no chat (ativa conexão e sincroniza mensagens)
                await currentClient.socket.sendPresenceUpdate('available', jid);
              } catch (fetchError) {
                // Ignorar erros individuais
              }
            }
            
            logger.debug(`[Baileys] 📥 Message sync attempted for ${activeConversations.length} conversations`);
          } catch (syncError) {
            logger.warn(`[Baileys] ⚠️ Could not sync messages:`, syncError);
          }

          // 3. Verificar se socket ainda está aberto
          try {
            // Tentar uma operação simples para verificar conexão
            const user = await currentClient.socket.user;
            if (!user) {
              logger.warn(`[Baileys] ⚠️ Socket user is null, connection may be dead`);
            }
          } catch (wsError) {
            logger.warn(`[Baileys] ⚠️ Could not verify socket connection:`, wsError);
          }

          currentClient.lastHeartbeat = new Date();
          logger.debug(`[Baileys] 💚 Heartbeat OK for ${connectionId}`);
        } catch (error) {
          logger.warn(`[Baileys] 💔 Heartbeat failed for ${connectionId}:`, error);
          
          // Não desconectar imediatamente - apenas logar o erro
          // O monitoramento de conexão vai detectar se realmente desconectou
          // Tentar verificar se socket ainda está vivo antes de considerar morto
          try {
            const user = await currentClient.socket.user;
            if (user) {
              logger.debug(`[Baileys] ✅ Socket still alive despite heartbeat error`);
            }
          } catch (verifyError) {
            logger.warn(`[Baileys] ⚠️ Socket verification failed - may need reconnection`);
          }
        }
      }
    }, 45000); // 45 segundos (mais frequente para manter conexão viva)

    logger.info(`[Baileys] 💚 Active heartbeat started for ${connectionId}`);
  }

  /**
   * Inicia sincronização periódica automática de mensagens
   * Roda a cada 2 minutos para garantir que nenhuma mensagem seja perdida
   */
  /**
   * ✅ SINCRONIZAÇÃO PERIÓDICA HABILITADA (LEVE)
   * 
   * Sincronização periódica leve a cada 5 minutos como backup.
   * Não interfere no recebimento em tempo real via eventos do Baileys.
   * 
   * Funciona independente do frontend estar aberto ou não.
   * 
   * Estratégia:
   * 1. **Tempo Real**: Mensagens são recebidas via eventos do Baileys (handleIncomingMessages)
   * 2. **Backup Periódico**: Sincronização leve a cada 5 minutos para garantir que nada seja perdido
   * 3. **Reconexão**: Após desconexão, sincroniza todas as conversas
   * 4. **Manual**: Via API endpoints quando necessário
   */
  private startPeriodicSync(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    // Limpar intervalo anterior se existir
    if (client.syncInterval) {
      clearInterval(client.syncInterval);
    }

    // Sincronização leve a cada 5 minutos (300000ms)
    // Intervalo longo para não interferir com recebimento em tempo real
    client.syncInterval = setInterval(async () => {
      const currentClient = this.clients.get(connectionId);
      if (!currentClient || currentClient.status !== 'connected') {
        if (client.syncInterval) {
          clearInterval(client.syncInterval);
          client.syncInterval = undefined;
        }
        return;
      }

      try {
        logger.info(`[Baileys] 🔄 Periodic sync (backup) for ${connectionId} - checking for missed messages...`);
        
        // Sincronização leve: apenas conversas ativas recentes (últimas 10)
        // Limite baixo para não sobrecarregar
        const syncedCount = await this.syncAllActiveConversations(connectionId, 10);
        
        if (syncedCount > 0) {
          logger.info(`[Baileys] ✅ Periodic sync found ${syncedCount} conversations to sync for ${connectionId}`);
        } else {
          logger.debug(`[Baileys] ✅ Periodic sync: no missed messages for ${connectionId}`);
        }
      } catch (error) {
        logger.warn(`[Baileys] ⚠️ Periodic sync error for ${connectionId}:`, error);
        // Não parar sincronização por causa de um erro - continuar tentando
      }
    }, 300000); // 5 minutos (300000ms)

    logger.info(`[Baileys] ✅ Periodic sync (backup) started for ${connectionId} - runs every 5 minutes`);
  }

  /**
   * Processa queue de retry de mensagens que falharam anteriormente
   * Tenta processar mensagens que estavam na queue de retry
   */
  private async processRetryQueue(connectionId: string): Promise<number> {
    try {
      const retryKeys = Array.from(this.syncRetryQueue.keys()).filter(key => key.startsWith(`${connectionId}:`));
      
      if (retryKeys.length === 0) {
        return 0; // Nenhuma mensagem na queue
      }
      
      logger.info(`[Baileys] 🔄 Processing retry queue: ${retryKeys.length} messages to retry`);
      
      let processedCount = 0;
      for (const retryKey of retryKeys) {
        try {
          const retryInfo = this.syncRetryQueue.get(retryKey);
          if (!retryInfo) continue;
          
          // Se última tentativa foi há menos de 1 minuto, aguardar
          const timeSinceLastAttempt = Date.now() - retryInfo.lastAttempt.getTime();
          if (timeSinceLastAttempt < 60000) {
            continue; // Aguardar mais tempo
          }
          
          await this.retryIncomingMessage(retryKey);
          processedCount++;
        } catch (error) {
          logger.error(`[Baileys] ❌ Error processing retry queue item:`, error);
        }
      }
      
      if (processedCount > 0) {
        logger.info(`[Baileys] ✅ Processed ${processedCount} items from retry queue`);
      }
      
      return processedCount;
    } catch (error) {
      logger.error(`[Baileys] ❌ Error processing retry queue:`, error);
      return 0;
    }
  }

  /**
   * Obtém cliente
   */
  getClient(connectionId: string): BaileysClient | undefined {
    return this.clients.get(connectionId);
  }

  /**
   * Verifica se uma conexão está ativa e conectada
   */
  isConnectionActive(connectionId: string): boolean {
    const client = this.clients.get(connectionId);
    return client ? client.status === 'connected' : false;
  }

  /**
   * Desconecta uma conexão
   */
  async disconnectConnection(connectionId: string) {
    try {
      await this.removeClient(connectionId, true); // true = fazer logout
    } catch (error) {
      logger.error(`[Baileys] Error disconnecting ${connectionId}:`, error);
    }
  }

  private async resetCredentialsAndEmitQR(
    connectionId: string,
    reason: 'bad_session' | 'logged_out' | 'max_attempts'
  ): Promise<void> {
    logger.warn(`[Baileys] 🔐 Resetting credentials for ${connectionId} due to ${reason}`);

    const resetAt = new Date();

    // ✅ PRESERVAR lastDisconnectAt original para sincronização correta
    let originalLastDisconnectAt: Date | null = null;
    try {
      const connection = await this.prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        select: { lastDisconnectAt: true },
      });
      originalLastDisconnectAt = connection?.lastDisconnectAt ?? null;
      
      if (originalLastDisconnectAt) {
        logger.info(`[Baileys] 📅 Preserving original lastDisconnectAt: ${originalLastDisconnectAt.toISOString()}`);
        logger.info(`[Baileys] 📅 This will be used as sync reference after QR scan`);
      }
    } catch (error) {
      logger.warn(`[Baileys] ⚠️ Could not read original lastDisconnectAt:`, error);
    }

    const client = this.clients.get(connectionId);
    if (client) {
      client.status = 'disconnected';
      client.hasCredentials = false;
      client.isReconnecting = false;
      client.reconnectAttempts = 0;
      // ✅ Preservar lastDisconnectAt original se existir
      client.lastDisconnectAt = originalLastDisconnectAt || resetAt;
      client.lastSyncFrom = null;
      client.lastSyncTo = null;
    }

    this.reconnectionLocks.delete(connectionId);

    try {
      await this.removeClient(connectionId, false);
    } catch (error) {
      logger.error(`[Baileys] ❌ Error removing client during credential reset for ${connectionId}:`, error);
    }

    try {
      await this.prisma.whatsAppConnection.update({
        where: { id: connectionId },
        data: {
          authData: null,
          status: 'disconnected',
          // ✅ PRESERVAR lastDisconnectAt original para sincronização após reconexão
          // Não sobrescrever com resetAt, pois perderia referência de quando desconectou
          lastDisconnectAt: originalLastDisconnectAt || resetAt,
          lastSyncFrom: null,
          lastSyncTo: null,
        },
      });
      
      logger.info(`[Baileys] ✅ Credentials cleared, lastDisconnectAt preserved for sync`);
    } catch (error) {
      logger.error(`[Baileys] ❌ Error clearing stored credentials for ${connectionId}:`, error);
    }

    this.emitStatus(connectionId, 'disconnected');

    try {
      const socketServer = getSocketServer();
      let message = 'A sessão do WhatsApp ficou inválida. Escaneie o novo QR code para reconectar.';
      if (reason === 'logged_out') {
        message = 'A sessão do WhatsApp foi encerrada no aparelho. Escaneie o novo QR code para reconectar.';
      } else if (reason === 'max_attempts') {
        message = 'A conexão não respondeu após várias tentativas. Escaneie o novo QR code para reconectar.';
      }
      socketServer.emitWhatsAppConnectionFailed(connectionId, message);
    } catch (error) {
      logger.error(`[Baileys] ❌ Error notifying credential reset for ${connectionId}:`, error);
    }

    setTimeout(() => {
      this.createClient(connectionId)
        .then(() => {
          logger.info(`[Baileys] 📲 New QR code requested for ${connectionId} after ${reason}`);
        })
        .catch((creationError) => {
          logger.error(
            `[Baileys] ❌ Failed to recreate client for ${connectionId} after ${reason}:`,
            creationError
          );
        });
    }, this.QR_RESET_DELAY_MS);
  }

  /**
   * Emite QR Code via Socket.IO
   */
  private async emitQRCode(connectionId: string, qr: string) {
    try {
      const qrDataURL = await QRCode.toDataURL(qr, {
        width: 300,
        margin: 2,
      });

      const socketServer = getSocketServer();
      socketServer.emitWhatsAppQRCode(connectionId, qrDataURL);
      logger.info(`[Baileys] QR Code emitted for ${connectionId}`);
    } catch (error) {
      logger.error(`[Baileys] Error emitting QR Code for ${connectionId}:`, error);
    }
  }

  /**
   * Emite status via Socket.IO
   */
  private emitStatus(connectionId: string, status: 'connecting' | 'connected' | 'disconnected') {
    try {
      const socketServer = getSocketServer();
      socketServer.emitWhatsAppStatus(connectionId, status);
      logger.info(`[Baileys] Status ${status} emitted for ${connectionId}`);
    } catch (error) {
      logger.error(`[Baileys] Error emitting status for ${connectionId}:`, error);
    }
  }

  public async manualReconnect(
    connectionId: string
  ): Promise<{
    status: 'already_connected' | 'connecting' | 'awaiting_qr' | 'reconnecting' | 'already_reconnecting';
    message: string;
  }> {
    const client = this.clients.get(connectionId);

    if (client && client.status === 'connected') {
      return {
        status: 'already_connected',
        message: 'Conexão já está ativa.',
      };
    }

    // ✅ CRÍTICO: Verificar credenciais ANTES de qualquer operação
    // Isso garante que sabemos se devemos usar credenciais existentes ou gerar QR code
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
      select: { authData: true, status: true },
    });

    const hasCredentialsInDB = connection && connection.authData !== null && connection.authData !== '';
    
    logger.info(`[Baileys] 🔁 Manual reconnect requested for ${connectionId}`);
    logger.info(`[Baileys] 📋 Credentials in DB: ${hasCredentialsInDB ? 'YES ✅' : 'NO ❌'}`);
    
    if (!hasCredentialsInDB) {
      logger.warn(`[Baileys] ⚠️ No credentials found in DB for ${connectionId} - will generate new QR code`);
    } else {
      logger.info(`[Baileys] ✅ Credentials found in DB for ${connectionId} - will reconnect with existing credentials`);
    }

    // Verificar se há lock de reconexão ativo
    const existingLock = this.reconnectionLocks.get(connectionId);
    if (existingLock && existingLock.locked) {
      const lockAge = Date.now() - existingLock.lockedAt.getTime();
      if (lockAge > this.LOCK_TIMEOUT_MS) {
        logger.warn(`[Baileys] ⚠️ Lock expired for ${connectionId} - releasing`);
        this.reconnectionLocks.delete(connectionId);
      } else {
        logger.info(`[Baileys] 🔁 Manual reconnect for ${connectionId} ignored - reconnection already in progress (lock age: ${Math.round(lockAge / 1000)}s).`);
      return {
        status: 'already_reconnecting',
        message: 'Já existe um processo de reconexão em andamento.',
      };
    }
    }

    // Se não há cliente, criar novo
    if (!client) {
      logger.info(`[Baileys] 🔁 Manual reconnect for ${connectionId} - no client found, creating new one...`);
      
      // Limpar locks
      this.reconnectionLocks.delete(connectionId);
      
      // ✅ IMPORTANTE: Criar novo cliente (vai usar credenciais do banco se existirem)
      // O usePostgreSQLAuthState vai carregar as credenciais automaticamente
      try {
        await this.createClient(connectionId);
      } catch (error) {
        if (error instanceof ClientCreationInProgressError) {
          logger.info(`[Baileys] 🔁 Manual reconnect for ${connectionId} ignored - client creation already in progress.`);
          return {
            status: 'already_reconnecting',
            message: 'Já existe um processo de conexão em andamento.',
          };
        }
        throw error;
      }
      
      return hasCredentialsInDB
        ? {
            status: 'reconnecting',
            message: 'Reconectando com credenciais existentes...',
          }
        : {
            status: 'awaiting_qr',
            message: 'Aguardando QR code...',
          };
    }

    // Se o cliente existe e está reconectando, informar
    if (client.isReconnecting) {
      logger.info(`[Baileys] 🔁 Manual reconnect for ${connectionId} ignored - reconnection already in progress.`);
      return {
        status: 'already_reconnecting',
        message: 'Já existe um processo de reconexão em andamento.',
      };
    }

    // Resetar contadores e flags
    client.reconnectAttempts = 0;
    client.isReconnecting = false;
    this.reconnectionLocks.delete(connectionId);

    logger.info(`[Baileys] 🔁 Manual reconnect initiated for ${connectionId}`);
    logger.info(`[Baileys] 📋 Will ${hasCredentialsInDB ? 'reconnect with existing credentials' : 'generate new QR code'}`);
    
    // ✅ IMPORTANTE: Remover cliente atual SEM fazer logout
    // Isso preserva as credenciais no banco de dados
    // O createClient vai carregar as credenciais automaticamente via usePostgreSQLAuthState
    await this.removeClient(connectionId, false); // false = NÃO fazer logout (preserva credenciais)
    
    try {
      // ✅ Criar novo cliente - vai usar credenciais do banco se existirem
      // O usePostgreSQLAuthState verifica o banco e carrega as credenciais
      await this.createClient(connectionId);
    } catch (error) {
      if (error instanceof ClientCreationInProgressError) {
        logger.info(`[Baileys] 🔁 Manual reconnect for ${connectionId} skipped - client creation already in progress.`);
        return {
          status: 'already_reconnecting',
          message: 'Já existe um processo de conexão em andamento.',
        };
      }
      throw error;
    }

    return hasCredentialsInDB
      ? {
      status: 'reconnecting',
          message: 'Reconectando com credenciais existentes...',
        }
      : {
          status: 'awaiting_qr',
          message: 'Aguardando QR code...',
    };
  }

  /**
   * Agenda reconexão automática quando a sessão fica inválida
   * MANTÉM as credenciais para permitir reconexão via botão
   */
  private async handleSessionInvalidation(
    connectionId: string,
    reason: 'logged_out' | 'bad_session',
    error?: any
  ): Promise<void> {
    logger.warn(`[Baileys] 🛑 Session invalidation detected for ${connectionId} (${reason})`);

    if (reason === 'bad_session' || reason === 'logged_out') {
      await this.resetCredentialsAndEmitQR(connectionId, reason);
      return;
    }

    const client = this.clients.get(connectionId);
    if (client) {
      client.status = 'disconnected';
      // NÃO marcar hasCredentials = false, pois queremos manter as credenciais
    }

    // Remover locks pendentes para permitir recriação
    this.reconnectionLocks.delete(connectionId);

    // Remover cliente atual sem forçar logout (sessão já inválida)
    await this.removeClient(connectionId, false);

    // ✅ NÃO LIMPAR credenciais - manter para permitir reconexão via botão
    logger.info(`[Baileys] 💾 Keeping credentials for ${connectionId} - user can reconnect via button`);

    await this.updateConnectionStatus(connectionId, 'disconnected');
    this.emitStatus(connectionId, 'disconnected');

    try {
      const socketServer = getSocketServer();
      const message = reason === 'logged_out'
        ? 'A sessão do WhatsApp foi encerrada. Clique em "Reconectar" para tentar novamente.'
        : 'A sessão do WhatsApp ficou inválida. Clique em "Reconectar" para tentar novamente.';

      socketServer.emitWhatsAppConnectionFailed(connectionId, message);
    } catch (notifyError) {
      logger.error(`[Baileys] ❌ Error notifying session invalidation for ${connectionId}:`, notifyError);
    }

    if (error) {
      logger.debug(`[Baileys] Session invalidation raw error for ${connectionId}:`, error);
    }

    // Tentar reconectar automaticamente após pequeno delay (mantendo credenciais)
    setTimeout(() => {
      this.createClient(connectionId)
        .then(() => {
          logger.info(`[Baileys] 🔁 Client recreated after ${reason} for ${connectionId} - attempting to reconnect with existing credentials`);
        })
        .catch((creationError) => {
          logger.error(`[Baileys] ❌ Failed to recreate client for ${connectionId} after ${reason}:`, creationError);
        });
    }, 3000); // 3 segundos de delay
  }

  /**
   * Salva firstConnectedAt quando conectar pela primeira vez
   * E força sincronização de TODAS as conversas desde a primeira conexão ao reconectar
   */
  private async saveFirstConnectedAt(connectionId: string): Promise<void> {
    try {
      const connection = await this.prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        select: { firstConnectedAt: true, status: true },
      });

      const isFirstConnection = connection && !connection.firstConnectedAt;
      
      // Só salvar se ainda não foi salvo (primeira conexão)
      if (isFirstConnection) {
        const now = new Date();
        await this.prisma.whatsAppConnection.update({
          where: { id: connectionId },
          data: { firstConnectedAt: now },
        });
        logger.info(`[Baileys] ✅ First connection timestamp saved for ${connectionId}: ${now.toISOString()}`);
        logger.info(`[Baileys] 📝 Sistema vai processar mensagens a partir desta data daqui para frente`);
      } else if (connection?.firstConnectedAt) {
        // RECONEXÃO: Não é a primeira vez que conecta
        const timeSinceFirst = Date.now() - connection.firstConnectedAt.getTime();
        const hoursSinceFirst = Math.round(timeSinceFirst / (1000 * 60 * 60));
        
        logger.info(`[Baileys] 🔄 RECONEXÃO detectada para ${connectionId}`);
        logger.info(`[Baileys] ⏰ Primeira conexão foi há ${hoursSinceFirst} horas (${connection.firstConnectedAt.toISOString()})`);
        logger.info(`[Baileys] 💡 Sincronização será acionada automaticamente pelo handleConnectionUpdate`);
      }
    } catch (error) {
      logger.error(`[Baileys] Error saving firstConnectedAt for ${connectionId}:`, error);
    }
  }

  /**
   * Atualiza status no banco
   */
  private async updateConnectionStatus(
    connectionId: string,
    status: string,
    extraData: Record<string, any> = {}
  ) {
    try {
      const data: Record<string, any> = {
        status,
        ...extraData,
      };

      if (status === 'connected' && typeof data.lastConnected === 'undefined') {
        data.lastConnected = new Date();
      }

      await this.prisma.whatsAppConnection.update({
        where: { id: connectionId },
        data,
      });
    } catch (error: any) {
      // Se a conexão não existe mais no banco, apenas logar warning (não é erro crítico)
      if (error?.code === 'P2025' || error?.message?.includes('Record to update not found')) {
        logger.warn(`[Baileys] ⚠️ Connection ${connectionId} not found in database - may have been deleted`);
        return;
      }
      logger.error(`[Baileys] Error updating status for ${connectionId}:`, error);
    }
  }

  /**
   * Lista todos os clientes
   */
  getAllClients(): BaileysClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Reconecta todas as conexões que estavam ativas
   * Chamado ao iniciar o backend
   */
  async reconnectActiveConnections(): Promise<void> {
    try {
      logger.info('[Baileys] 🔄 Reconnecting active connections...');

      // Buscar TODAS as conexões que têm credenciais salvas (authData)
      // Independente do status, pois quando o backend para, todas ficam 'disconnected'
      const activeConnections = await this.prisma.whatsAppConnection.findMany({
        where: {
          NOT: {
            authData: null,
          },
        },
      });

      logger.info(`[Baileys] Found ${activeConnections.length} connections with saved credentials to reconnect`);

      for (const connection of activeConnections) {
        try {
          logger.info(`[Baileys] 🔌 Reconnecting ${connection.name} (${connection.id})...`);
          logger.info(`[Baileys] 📊 Previous status: ${connection.status}`);
          
          // Criar cliente (isso vai tentar reconectar automaticamente)
          await this.createClient(connection.id);
          
          logger.info(`[Baileys] ✅ Client created for ${connection.name}`);
        } catch (error) {
          logger.error(`[Baileys] ❌ Failed to reconnect ${connection.id}:`, error);
          
          // Marcar como desconectado em caso de erro
          await this.prisma.whatsAppConnection.update({
            where: { id: connection.id },
            data: { status: 'disconnected' },
          }).catch(() => {});
        }
      }

      logger.info('[Baileys] ✅ Reconnection process completed');
    } catch (error) {
      logger.error('[Baileys] ❌ Error reconnecting active connections:', error);
    }
  }

  /**
   * Sincroniza mensagens de uma conversa específica (recuperação manual)
   * Útil para forçar sincronização quando detectar mensagens perdidas
   */
  async syncConversationMessages(connectionId: string, phoneNumber: string, limit: number = 50): Promise<boolean> {
    try {
      let client = this.clients.get(connectionId);
      
      // Verificação robusta: status E socket realmente conectado
      if (!client || client.status !== 'connected') {
        const currentStatus = client?.status || 'not found';
        
        // ❌ NÃO tentar reconectar aqui - pode causar múltiplas tentativas simultâneas
        // Se não estiver conectado, apenas retornar false
        // A reconexão deve ser feita apenas por:
        // 1. attemptReconnection (após desconexão)
        // 2. saveFirstConnectedAt (após primeira conexão)
        // 3. Manual via API
        
        // Reduzir logs repetitivos para status "qr" ou "connecting"
        if (currentStatus === 'qr' || currentStatus === 'connecting') {
          // Log apenas uma vez a cada 10 segundos para evitar spam
          const lastLogKey = `sync_skip_${connectionId}`;
          const lastLogTime = (this as any)[lastLogKey] || 0;
          const now = Date.now();
          
          if (now - lastLogTime > 10000) { // 10 segundos
            logger.debug(`[Baileys] ⏭️ Skipping sync for ${connectionId} - status: ${currentStatus} (will sync after connection)`);
            (this as any)[lastLogKey] = now;
          }
        } else {
          logger.warn(`[Baileys] ⚠️ Connection ${connectionId} not available (status: ${currentStatus})`);
          logger.warn(`[Baileys] ⏭️ Skipping sync for ${connectionId} - connection not available (will sync after reconnection)`);
        }
        
        return false;
      }

      // Verificar se socket está realmente conectado (não apenas status)
      // O Baileys pode ter status 'connected' mas socket fechado
      if (!client.socket) {
        logger.error(`[Baileys] ❌ Socket not available for ${connectionId}`);
        return false;
      }

    if (!client.lastSyncFrom && client.lastDisconnectAt) {
      client.lastSyncFrom = client.lastDisconnectAt;
    }

      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      logger.info(`[Baileys] 🔄 ROBUST sync requested for ${phoneNumber} on ${connectionId} (limit: ${limit})`);

      try {
        // ESTRATÉGIA ROBUSTA DE SINCRONIZAÇÃO:
        // Usa presence updates múltiplos para forçar WhatsApp a enviar mensagens pendentes
        
        logger.info(`[Baileys] Starting robust sync for ${phoneNumber}...`);
        
        // Método 1: Marcar presença disponível
        await client.socket.sendPresenceUpdate('available', jid);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Método 2: Simular digitação (ativa sincronização mais agressiva do WhatsApp)
        await client.socket.sendPresenceUpdate('composing', jid);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Método 3: Pausar digitação
        await client.socket.sendPresenceUpdate('paused', jid);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Método 4: Marcar disponível novamente (ciclo completo)
        await client.socket.sendPresenceUpdate('available', jid);
        
        logger.info(`[Baileys] ✅ ROBUST sync triggers sent for ${phoneNumber}`);
        logger.info(`[Baileys] WhatsApp will send missing messages via events (processed by handleIncomingMessages)`);
        
        // A sincronização real acontece via eventos que são capturados
        // por handleIncomingMessages() quando o WhatsApp responde aos presence updates
        
        return true;
      } catch (error: any) {
        // Verificar se erro é "Connection Closed"
        const isConnectionClosed = error?.message?.includes('Connection Closed') || 
                                   error?.output?.payload?.message?.includes('Connection Closed');
        
        if (isConnectionClosed) {
          logger.warn(`[Baileys] ⚠️ Connection Closed detected for ${connectionId} - marking as disconnected`);
          
          // Marcar como desconectado no banco
          await this.updateConnectionStatus(connectionId, 'disconnected');
          this.emitStatus(connectionId, 'disconnected');
          
          // Tentar reconectar
          logger.info(`[Baileys] 🔄 Attempting to reconnect ${connectionId} after Connection Closed...`);
          try {
            await this.createClient(connectionId);
            logger.info(`[Baileys] ✅ Reconnected ${connectionId} after Connection Closed`);
            
            // Não tentar sync novamente agora (deixar para próxima execução)
            return false;
          } catch (reconnectError) {
            logger.error(`[Baileys] ❌ Reconnection after Connection Closed failed:`, reconnectError);
            return false;
          }
        }
        
        logger.error(`[Baileys] ❌ Error in robust sync:`, error);
        
        // Fallback: tentar apenas presence updates básico (só se não for Connection Closed)
        if (!isConnectionClosed) {
          try {
            logger.info(`[Baileys] Falling back to basic presence updates...`);
            await client.socket.sendPresenceUpdate('available', jid);
            await client.socket.sendPresenceUpdate('composing', jid);
            await new Promise(resolve => setTimeout(resolve, 300));
            await client.socket.sendPresenceUpdate('paused', jid);
            return true;
          } catch (fallbackError) {
            logger.error(`[Baileys] ❌ Fallback sync also failed:`, fallbackError);
            return false;
          }
        }
        
        return false;
      }
    } catch (error) {
      logger.error(`[Baileys] ❌ Error in syncConversationMessages:`, error);
      return false;
    }
  }

  /**
   * Valida integridade de mensagens de uma conversa
   * Verifica se há gaps na sequência de mensagens
   */
  async validateMessageIntegrity(conversationId: string): Promise<{ valid: boolean; gaps: number; lastChecked: Date }> {
    try {
      logger.info(`[Baileys] 🔍 Validating message integrity for conversation ${conversationId}...`);
      
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' },
            select: { timestamp: true, externalId: true },
          },
          contact: { select: { phoneNumber: true } },
        },
      });

      if (!conversation) {
        return { valid: false, gaps: 0, lastChecked: new Date() };
      }

      // Verificar gaps temporais (mais de 5 minutos entre mensagens em conversa ativa)
      let gaps = 0;
      const messages = conversation.messages;
      
      for (let i = 1; i < messages.length; i++) {
        const prevTime = new Date(messages[i - 1].timestamp).getTime();
        const currTime = new Date(messages[i].timestamp).getTime();
        const diffMinutes = (currTime - prevTime) / 1000 / 60;
        
        // Se houver gap maior que 30 minutos, pode ter mensagens perdidas
        if (diffMinutes > 30 && diffMinutes < 1440) { // Menos de 1 dia
          gaps++;
          logger.warn(`[Baileys] ⚠️ Gap detected: ${diffMinutes.toFixed(1)} minutes between messages`);
        }
      }

      const isValid = gaps === 0;
      
      if (!isValid) {
        logger.warn(`[Baileys] ⚠️ Integrity check failed: ${gaps} gaps found in conversation ${conversationId}`);
        // Triggerar sincronização para recuperar mensagens perdidas
        await this.syncConversationMessages(conversation.connectionId, conversation.contact.phoneNumber);
      } else {
        logger.info(`[Baileys] ✅ Integrity check passed for conversation ${conversationId}`);
      }

      return { valid: isValid, gaps, lastChecked: new Date() };
    } catch (error) {
      logger.error(`[Baileys] ❌ Error validating message integrity:`, error);
      return { valid: false, gaps: -1, lastChecked: new Date() };
    }
  }

  /**
   * Força sincronização de todas as conversas ativas de uma conexão
   * Agora com limite de mensagens configurável para busca mais profunda
   */
  async syncAllActiveConversations(connectionId: string, messageLimit: number = 50): Promise<number> {
    try {
      logger.info(`[Baileys] 🔄 Syncing all active conversations for ${connectionId} (limit: ${messageLimit})...`);
      
      // VERIFICAÇÃO CRÍTICA: Verificar se conexão está realmente conectada ANTES de sincronizar
      const client = this.clients.get(connectionId);
      if (!client || client.status !== 'connected' || !client.socket) {
        const currentStatus = client?.status || 'not found';
        
        // ❌ NÃO tentar reconectar aqui - pode causar múltiplas tentativas simultâneas
        // Se não estiver conectado, apenas retornar 0
        // A reconexão deve ser feita apenas por:
        // 1. attemptReconnection (após desconexão)
        // 2. saveFirstConnectedAt (após primeira conexão)
        // 3. Manual via API
        
        // Reduzir logs repetitivos para status "qr" ou "connecting"
        if (currentStatus === 'qr' || currentStatus === 'connecting') {
          // Log apenas uma vez a cada 10 segundos para evitar spam
          const lastLogKey = `sync_all_skip_${connectionId}`;
          const lastLogTime = (this as any)[lastLogKey] || 0;
          const now = Date.now();
          
          if (now - lastLogTime > 10000) { // 10 segundos
            logger.debug(`[Baileys] ⏭️ Skipping sync for ${connectionId} - status: ${currentStatus} (will sync after connection)`);
            (this as any)[lastLogKey] = now;
          }
        } else {
          logger.warn(`[Baileys] ⏭️ Skipping sync for ${connectionId} - connection not available (status: ${currentStatus})`);
          logger.warn(`[Baileys] 💡 Sync will occur automatically after reconnection`);
        }
        
        return 0;
      }
      
      // Buscar todas as conversas ativas
      const conversations = await this.prisma.conversation.findMany({
        where: {
          connectionId,
          status: {
            in: ['waiting', 'in_progress', 'transferred', 'resolved', 'closed'],
          },
        },
        include: {
          contact: { select: { phoneNumber: true } },
        },
      });

      logger.info(`[Baileys] Found ${conversations.length} active conversations to sync`);

      let syncedCount = 0;
      for (const conv of conversations) {
        try {
          const success = await this.syncConversationMessages(connectionId, conv.contact.phoneNumber, messageLimit);
          if (success) syncedCount++;
          
          // Delay entre sincronizações para não sobrecarregar (reduzido para 500ms)
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`[Baileys] Error syncing conversation ${conv.id}:`, error);
          // Continuar com próxima conversa mesmo se uma falhar
        }
      }

      logger.info(`[Baileys] ✅ Synced ${syncedCount}/${conversations.length} conversations`);

      return syncedCount;
    } catch (error) {
      logger.error(`[Baileys] ❌ Error in syncAllActiveConversations:`, error);
      return 0;
    }
  }

  /**
   * Sistema de Detecção e Recuperação de GAPS (Mensagens Perdidas)
   * Verifica conversas ativas e identifica possíveis mensagens perdidas
   * baseado em gaps temporais
   */
  async detectAndRecoverGaps(connectionId: string): Promise<{ gapsFound: number; recovered: number }> {
    try {
      logger.info(`[Baileys] 🔍 Starting GAP detection for ${connectionId}...`);
      
      // Buscar conversas ativas com mensagens recentes
      const conversations = await this.prisma.conversation.findMany({
        where: {
          connectionId,
          status: {
            in: ['waiting', 'in_progress', 'transferred', 'resolved', 'closed'],
          },
          lastMessageAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24 horas
          },
        },
        include: {
          contact: { select: { phoneNumber: true } },
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 50, // Últimas 50 mensagens
          },
        },
      });

      let gapsFound = 0;
      let recovered = 0;

      for (const conv of conversations) {
        // Analisar mensagens para detectar gaps temporais suspeitos
        const messages = conv.messages;
        if (messages.length < 2) continue;

        let hasGap = false;

        // Verificar gaps entre mensagens
        for (let i = 1; i < messages.length; i++) {
          const prevTime = new Date(messages[i - 1].timestamp).getTime();
          const currTime = new Date(messages[i].timestamp).getTime();
          const diffMinutes = Math.abs(currTime - prevTime) / 1000 / 60;

          // Gap suspeito: mais de 10 minutos entre mensagens em conversa ativa
          // Mas menos de 2 horas (para não pegar pausas normais)
          if (diffMinutes > 10 && diffMinutes < 120) {
            logger.warn(`[Baileys] ⚠️ GAP detected in conversation ${conv.id}: ${diffMinutes.toFixed(1)} minutes gap`);
            hasGap = true;
            gapsFound++;
            break;
          }
        }

        // Se detectou gap, adicionar à queue de sincronização com prioridade ALTA
        if (hasGap) {
          logger.info(`[Baileys] 🔄 GAP detected - adding to sync queue: ${conv.id}...`);
          
          // Importar syncQueueService dinamicamente para evitar circular dependency
          const { syncQueueService } = await import('../services/sync-queue.service.js');
          
          syncQueueService.enqueue({
            connectionId,
            phoneNumber: conv.contact.phoneNumber,
            priority: 'high', // Alta prioridade para gaps
            reason: 'gap_detected',
          });
          
          recovered++; // Contar como "em recuperação"
        }

        // Delay entre verificações
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.info(`[Baileys] ✅ GAP detection completed: ${gapsFound} gaps found, ${recovered} recovered`);
      return { gapsFound, recovered };
    } catch (error) {
      logger.error(`[Baileys] ❌ Error in detectAndRecoverGaps:`, error);
      return { gapsFound: 0, recovered: 0 };
    }
  }

  /**
   * Sincronização LEVE de todas as conexões (para cronjobs externos)
   * Ideal para ser chamado por cronjobs externos a cada 3-5 minutos
   * 
   * ⚠️ IMPORTANTE: Esta função NÃO faz sincronização ativa de mensagens
   * Ela apenas:
   * 1. Verifica se as conexões estão vivas (keep-alive)
   * 2. Detecta e recupera gaps (mensagens faltando)
   * 
   * Sincronização ativa completa só deve ocorrer em:
   * - Reconexão após desconexão
   * - Manualmente via botão/API de reconexão
   * - Após detecção de gaps críticos
   */
  async syncAllConnections(): Promise<{ 
    totalConnections: number; 
    syncedConversations: number;
    gapsRecovered: number;
  }> {
    try {
      logger.info(`[Baileys] 🔄 Starting GAP DETECTION (all connections)...`);
      
      // Buscar todas as conexões ativas
      const connections = await this.prisma.whatsAppConnection.findMany({
        where: { status: 'connected' },
      });

      logger.info(`[Baileys] Found ${connections.length} active connections`);

      let totalGapsRecovered = 0;

      for (const connection of connections) {
        try {
          // ✅ APENAS detectar e recuperar gaps (não sincronizar todas as conversas)
          // Isso evita interferir com o envio normal de mensagens
          const { recovered } = await this.detectAndRecoverGaps(connection.id);
          totalGapsRecovered += recovered;

          const retried = await this.processRetryQueue(connection.id);
          if (retried > 0) {
            logger.info(`[Baileys] 🔁 Retry queue processed for ${connection.id}: ${retried} mensagens reaplicadas`);
          }

          // Delay menor entre conexões para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`[Baileys] Error checking gaps for connection ${connection.id}:`, error);
        }
      }

      logger.info(`[Baileys] ✅ GAP DETECTION completed: ${totalGapsRecovered} gaps recovered`);
      
      return {
        totalConnections: connections.length,
        syncedConversations: 0, // Não sincronizamos ativamente (apenas gaps)
        gapsRecovered: totalGapsRecovered,
      };
    } catch (error) {
      logger.error(`[Baileys] ❌ Error in syncAllConnections:`, error);
      return {
        totalConnections: 0,
        syncedConversations: 0,
        gapsRecovered: 0,
      };
    }
  }

  /**
   * Baixar mídia de uma mensagem do WhatsApp
   * Nota: Requer que a mensagem original ainda esteja disponível no WhatsApp
   */
  async downloadMedia(
    connectionId: string,
    externalId: string,
    remoteJid: string
  ): Promise<Buffer | null> {
    try {
      const client = this.clients.get(connectionId);
      if (!client || !client.socket) {
        logger.error(`[Baileys] Client ${connectionId} not found or not connected`);
        return null;
      }

      logger.info(`[Baileys] Attempting to download media for message ${externalId} from ${remoteJid}`);

      // ⚠️ LIMITAÇÃO: O Baileys não fornece uma API direta para baixar mídia de mensagens antigas
      // As mídias do WhatsApp expiram após 7 dias e não podem ser mais baixadas
      // Para mídias recentes que ainda estão no cache, o download acontece automaticamente
      // quando a mensagem é recebida (handleIncomingMessages)
      
      // ✅ A solução recomendada é:
      // 1. Fazer upload para Supabase Storage quando a mídia é recebida (já implementado)
      // 2. Quando redownload é solicitado, verificar se já está no Supabase
      // 3. Se não estiver, a mídia provavelmente expirou e não pode ser recuperada
      
      logger.warn(`[Baileys] ⚠️ Media re-download not directly supported by Baileys`);
      logger.warn(`[Baileys] ⚠️ Mídias do WhatsApp expiram após 7 dias e não podem ser baixadas novamente`);
      logger.warn(`[Baileys] 💡 Recomendação: Fazer upload para Supabase Storage quando a mídia é recebida`);
      
      return null;
    } catch (error) {
      logger.error('[Baileys] ❌ Exception downloading media:', error);
      return null;
    }
  }
}

export const baileysManager = new BaileysManager();
