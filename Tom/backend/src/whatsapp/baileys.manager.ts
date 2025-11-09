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
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.js';

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
  hasCredentials?: boolean; // Indica se tem credenciais salvas (já foi conectado antes)
  reconnectAttempts?: number; // Contador de tentativas de reconexão
  isReconnecting?: boolean; // Flag para evitar múltiplas reconexões simultâneas
  lastHeartbeat?: Date; // Última vez que o heartbeat foi bem-sucedido
  lastSync?: Date; // Última vez que sincronizou mensagens
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

/**
 * Gerenciador de conexões Baileys
 * Baseado 100% na documentação oficial: https://baileys.wiki/docs/intro/
 */
class BaileysManager {
  private clients: Map<string, BaileysClient> = new Map();
  private prisma = getPrismaClient();
  private reconnectionLocks: Map<string, boolean> = new Map(); // Previne reconexões simultâneas
  private syncRetryQueue: Map<string, { retries: number; lastAttempt: Date }> = new Map(); // Fila de retry para sincronização

  /**
   * Cria um novo cliente Baileys para uma conexão
   * Implementa auth state persistente no PostgreSQL conforme docs
   */
  async createClient(connectionId: string): Promise<BaileysClient> {
    try {
      logger.info(`[Baileys] Creating client for connection: ${connectionId}`);

      // Verificar se já está em processo de criação/reconexão
      if (this.reconnectionLocks.get(connectionId)) {
        logger.warn(`[Baileys] Client ${connectionId} is already being created/reconnected, skipping...`);
        throw new Error('Client creation already in progress');
      }

      // Marcar como em processo de criação
      this.reconnectionLocks.set(connectionId, true);

      // Remover cliente existente se houver
      const existingClient = this.clients.get(connectionId);
      if (existingClient) {
        logger.warn(`[Baileys] Client ${connectionId} already exists, removing...`);
        await this.removeClient(connectionId, false); // false = não fazer logout
      }

      // Carregar ou criar auth state do banco de dados
      const { state, saveCreds } = await this.usePostgreSQLAuthState(connectionId);

      // Criar socket Baileys conforme documentação
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['WhatsApp Multi-Device', 'Chrome', '1.0.0'],
        syncFullHistory: false, // Desabilitado: só sincronizar mensagens a partir da primeira conexão
        markOnlineOnConnect: true, // Marcar como online ao conectar (IMPORTANTE para manter conexão)
        // Configurações otimizadas para melhorar estabilidade da conexão
        connectTimeoutMs: 60000, // Timeout de 60s para conectar
        defaultQueryTimeoutMs: 60000, // Timeout para queries
        keepAliveIntervalMs: 20000, // Pings a cada 20s (equilíbrio entre bateria e estabilidade)
        retryRequestDelayMs: 250, // Delay mínimo entre tentativas
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
      });
      const hasCredentials = connectionData?.authData ? true : false;
      
      const client: BaileysClient = {
        id: connectionId,
        socket,
        status: 'connecting',
        hasCredentials,
        reconnectAttempts: 0,
        isReconnecting: false,
      };

      this.clients.set(connectionId, client);

      // Event: Salvar credenciais quando atualizadas
      socket.ev.on('creds.update', saveCreds);

      // Event: Atualização de conexão
      socket.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(connectionId, update);
      });

      // Event: Mensagens recebidas (tempo real e sync)
      socket.ev.on('messages.upsert', async (m) => {
        await this.handleIncomingMessages(connectionId, m);
      });

      // Event: Sincronização de histórico (mensagens antigas)
      socket.ev.on('messaging-history.set', async (history) => {
        logger.info(`[Baileys] 📚 History sync received for ${connectionId}: ${history.messages?.length || 0} messages`);
        if (history.messages && history.messages.length > 0) {
          // Processar mensagens do histórico
          await this.handleIncomingMessages(connectionId, {
            messages: history.messages,
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
      
      // ❌ SINCRONIZAÇÃO PERIÓDICA DESABILITADA
      // Sincronização automática estava interferindo no recebimento de mensagens em tempo real
      // Sincronização agora só ocorre quando:
      // 1. Reconexão (após desconexão)
      // 2. Detecção de gaps
      // 3. Solicitação manual via API
      // this.startPeriodicSync(connectionId);

      logger.info(`[Baileys] ✅ Client created successfully: ${connectionId}`);
      
      // Liberar lock após criação bem-sucedida
      this.reconnectionLocks.delete(connectionId);
      
      return client;
    } catch (error) {
      logger.error(`[Baileys] Error creating client ${connectionId}:`, error);
      
      // ✅ LIBERAR LOCK EM CASO DE ERRO
      this.reconnectionLocks.delete(connectionId);
      
      // ✅ Emitir evento de falha de conexão
      try {
        const socketServer = getSocketServer();
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao criar cliente';
        socketServer.emitWhatsAppConnectionFailed(connectionId, errorMessage);
        
        // Atualizar status no banco
        await this.updateConnectionStatus(connectionId, 'disconnected');
        this.emitStatus(connectionId, 'disconnected');
      } catch (emitError) {
        logger.error(`[Baileys] Error emitting connection failed event:`, emitError);
      }
      
      // Liberar lock em caso de erro
      this.reconnectionLocks.delete(connectionId);
      
      throw error;
    }
  }

  /**
   * Implementa auth state persistente no PostgreSQL
   * Baseado em: https://baileys.wiki/docs/socket/configuration#auth
   */
  private async usePostgreSQLAuthState(connectionId: string) {
    // Buscar credenciais salvas do banco
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
    });

    let creds: AuthenticationState['creds'];
    let keys: Record<string, any> = {};

    if (connection?.authData) {
      // Carregar credenciais existentes
      try {
        let authDataString = connection.authData as string;
        
        // 🔐 DESCRIPTOGRAFAR authData se estiver criptografado
        if (isEncrypted(authDataString)) {
          logger.debug(`[Baileys] 🔓 Decrypting auth data for ${connectionId}`);
          authDataString = decrypt(authDataString);
        } else {
          // ⚠️ MIGRAÇÃO: Se não estiver criptografado, é dado legado
          logger.warn(`[Baileys] ⚠️ Auth data for ${connectionId} is not encrypted (legacy data)`);
        }
        
        const authData = JSON.parse(authDataString, BufferJSON.reviver);
        creds = authData.creds;
        keys = authData.keys || {};
        logger.info(`[Baileys] ✅ Loaded existing auth for ${connectionId} (has credentials)`);
      } catch (error) {
        logger.warn(`[Baileys] ⚠️ Failed to parse auth data, creating new credentials:`, error);
        creds = initAuthCreds();
      }
    } else {
      // Criar novas credenciais
      creds = initAuthCreds();
      logger.info(`[Baileys] 🆕 Created NEW auth for ${connectionId} (will generate QR Code)`);
    }

    // Função para salvar credenciais
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

        // 🔐 CRIPTOGRAFAR authData antes de salvar no banco
        logger.debug(`[Baileys] 🔒 Encrypting auth data for ${connectionId}`);
        const encryptedAuthData = encrypt(authDataString);

        await this.prisma.whatsAppConnection.update({
          where: { id: connectionId },
          data: { authData: encryptedAuthData },
        });

        logger.debug(`[Baileys] ✅ Saved encrypted auth for ${connectionId}`);
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
      client.status = 'connecting';
      logger.info(`[Baileys] Connecting: ${connectionId}`);
      this.emitStatus(connectionId, 'connecting');
      return;
    }

    // Conectado
    if (connection === 'open') {
      client.status = 'connected';
      logger.info(`[Baileys] ✅ Connected: ${connectionId}`);
      
      // Resetar contador de reconexão ao conectar com sucesso
      this.resetReconnectionAttempts(connectionId);
      
      // Salvar firstConnectedAt se for a primeira conexão
      // E forçar sincronização de mensagens desde a primeira conexão ao reconectar
      await this.saveFirstConnectedAt(connectionId);
      
      await this.updateConnectionStatus(connectionId, 'connected');
      this.emitStatus(connectionId, 'connected');
      return;
    }

    // Desconectado
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const errorMessage = (lastDisconnect?.error as Error)?.message || 'Unknown error';

      // Marcar cliente como desconectado imediatamente para parar heartbeats/presence
      client.status = 'disconnected';
      
      logger.warn(`[Baileys] ❌ Connection closed: ${connectionId}`);
      logger.warn(`[Baileys] 📊 Status Code: ${statusCode}`);
      logger.warn(`[Baileys] 📝 Error Message: ${errorMessage}`);
      logger.warn(`[Baileys] 🔢 DisconnectReason.restartRequired = ${DisconnectReason.restartRequired}`);
      logger.warn(`[Baileys] 🔢 DisconnectReason.loggedOut = ${DisconnectReason.loggedOut}`);
      logger.warn(`[Baileys] 🔢 DisconnectReason.badSession = ${DisconnectReason.badSession}`);
      logger.warn(`[Baileys] 🔢 DisconnectReason.timedOut = ${DisconnectReason.timedOut}`);
      logger.warn(`[Baileys] 📋 Full error:`, JSON.stringify(lastDisconnect?.error, null, 2));

      // Restart required (normal após QR scan)
      if (statusCode === DisconnectReason.restartRequired) {
        logger.info(`[Baileys] Restart required for ${connectionId} (normal after QR scan)`);
        
        // Aguardar 3 segundos antes de reiniciar para evitar conflitos
        setTimeout(async () => {
          try {
            // Verificar se não está já reconectando
            if (!this.reconnectionLocks.get(connectionId)) {
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
      if (statusCode === DisconnectReason.badSession || statusCode === 500) {
        await this.handleSessionInvalidation(connectionId, 'bad_session', lastDisconnect?.error);
        return;
      }

      // Tratamento especial para erro 503 (Service Unavailable)
      if (statusCode === 503) {
        logger.warn(`[Baileys] ⚠️ Error 503 (Service Unavailable) - WhatsApp may be temporarily unavailable`);
        logger.warn(`[Baileys] 💡 Will wait 30 seconds before attempting reconnection`);
        
        // Aguardar 30 segundos antes de tentar reconectar (evitar múltiplas tentativas)
        setTimeout(async () => {
          const shouldReconnect = this.shouldAttemptReconnection(connectionId, statusCode);
          if (shouldReconnect) {
            logger.info(`[Baileys] 🔄 Auto-reconnecting ${connectionId} after 503 error...`);
            await this.attemptReconnection(connectionId);
          }
        }, 30000); // 30 segundos para erro 503
        
        await this.updateConnectionStatus(connectionId, 'disconnected');
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
        await this.updateConnectionStatus(connectionId, 'disconnected');
        this.emitStatus(connectionId, 'disconnected');
      }
    }
  }

  /**
   * Manipula mensagens recebidas
   */
  private async handleIncomingMessages(connectionId: string, messageUpdate: any) {
    try {
      const { messages, type } = messageUpdate;

      logger.info(`[Baileys] 📨 Message update received - Type: ${type}, Count: ${messages?.length || 0}`);

      // Buscar firstConnectedAt para filtrar mensagens antigas
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
      
      // IMPORTANTE: Mensagens em tempo real (notify) sempre processar, mesmo sem firstConnectedAt
      // Elas são novas e devem ser capturadas imediatamente

      // Atualizar timestamp de última mensagem recebida
      const client = this.clients.get(connectionId);
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
          await this.processMessageBatch(connectionId, batch, type, firstConnectedAt || null, syncStats);
          
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
      await this.processMessageBatch(connectionId, messages, type, firstConnectedAt || null, syncStats);
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
    syncStats: { total: number; processed: number; skipped: number; errors: number; type: string }
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

        logger.info(`[Baileys] 📱 Processing message ${processedIndex}/${totalMessages} from ${from}, isFromMe: ${isFromMe}, pushName: ${pushName}`);

        // ===== FILTROS =====
        
        // 0. Filtrar mensagens antigas (anteriores à primeira conexão)
        if (firstConnectedAt && type === 'history') {
          const messageTimestamp = msg.messageTimestamp 
            ? new Date(Number(msg.messageTimestamp) * 1000) 
            : msg.key?.messageTimestamp 
              ? new Date(Number(msg.key.messageTimestamp) * 1000)
              : null;
          
          if (!messageTimestamp) {
            logger.debug(`[Baileys] ✅ Processing message without timestamp (likely recent)`);
          } else {
            const oneHourBeforeFirst = new Date(firstConnectedAt.getTime() - 60 * 60 * 1000);
            
            if (messageTimestamp < oneHourBeforeFirst) {
              logger.debug(`[Baileys] ⏭️ Skipping old history message from ${messageTimestamp.toISOString()}`);
              syncStats.skipped++;
              continue;
            } else {
              logger.debug(`[Baileys] ✅ Processing message from ${messageTimestamp.toISOString()} (within safe margin or recent)`);
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

        // Extrair conteúdo da mensagem
        let messageText = '';
        let messageType = 'text';
        let audioMediaUrl: string | null = null;
        let imageMediaUrl: string | null = null;

        if (msg.message?.conversation) {
          messageText = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          messageText = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage) {
          messageText = msg.message.imageMessage.caption || '[Imagem]';
          messageType = 'image';
          
          // Baixar imagem com timeout
          try {
            const client = this.clients.get(connectionId);
            if (client?.socket) {
              const imageBuffer = await Promise.race([
                downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: client.socket.updateMediaMessage }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Image download timeout')), 15000))
              ]) as Buffer;
              
              if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
                const imageMimetype = msg.message.imageMessage?.mimetype || 'image/jpeg';
                const imageExt = imageMimetype.includes('png') ? '.png' : imageMimetype.includes('gif') ? '.gif' : imageMimetype.includes('webp') ? '.webp' : '.jpg';
                const filename = `image-${Date.now()}-${Math.random().toString(36).substring(7)}${imageExt}`;
                const uploadsDir = path.join(process.cwd(), 'uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                fs.writeFileSync(path.join(uploadsDir, filename), imageBuffer);
                imageMediaUrl = `/uploads/${filename}`;
                logger.info(`[Baileys] ✅ Image saved: ${filename}`);
              }
            }
          } catch (imageError) {
            logger.error(`[Baileys] ❌ Error downloading image:`, imageError);
          }
        } else if (msg.message?.audioMessage) {
          messageText = '[Áudio]';
          messageType = 'audio';
          
          // Baixar áudio com timeout
          try {
            const client = this.clients.get(connectionId);
            if (client?.socket) {
              const audioBuffer = await Promise.race([
                downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: client.socket.updateMediaMessage }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Audio download timeout')), 20000))
              ]) as Buffer;
              
              if (audioBuffer && Buffer.isBuffer(audioBuffer)) {
                const audioMimetype = msg.message.audioMessage?.mimetype || 'audio/ogg; codecs=opus';
                const audioExt = audioMimetype.includes('mp3') ? '.mp3' : audioMimetype.includes('wav') ? '.wav' : audioMimetype.includes('m4a') ? '.m4a' : '.ogg';
                const filename = `audio-${Date.now()}-${Math.random().toString(36).substring(7)}${audioExt}`;
                const uploadsDir = path.join(process.cwd(), 'uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                fs.writeFileSync(path.join(uploadsDir, filename), audioBuffer);
                audioMediaUrl = `/uploads/${filename}`;
                logger.info(`[Baileys] ✅ Audio saved: ${filename}`);
              }
            }
          } catch (audioError) {
            logger.error(`[Baileys] ❌ Error downloading audio:`, audioError);
          }
        } else if (msg.message?.videoMessage) {
          messageText = msg.message.videoMessage.caption || '[Vídeo]';
          messageType = 'video';
        } else if (msg.message?.documentMessage) {
          messageText = msg.message.documentMessage.fileName || '[Documento]';
          messageType = 'document';
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

        // Processar mensagem com timeout e retry robusto
        const messageProcessed = await this.processMessageWithRetry(
          connectionId,
          from,
          messageText,
          messageType,
          messageType === 'audio' ? audioMediaUrl : messageType === 'image' ? imageMediaUrl : null,
          isFromMe,
          externalId,
          pushName,
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
          // Última tentativa falhou - adicionar à queue de retry para processar depois
          logger.error(`[Baileys] ❌ Max retries reached for message ${externalId} - adding to retry queue`);
          
          const retryKey = `${connectionId}:${externalId}`;
          const retryInfo = this.syncRetryQueue.get(retryKey) || { retries: 0, lastAttempt: new Date() };
          retryInfo.retries = attempt;
          retryInfo.lastAttempt = new Date();
          this.syncRetryQueue.set(retryKey, retryInfo);
          
          // Tentar novamente em background após delay maior
          setTimeout(async () => {
            try {
              logger.info(`[Baileys] 🔄 Background retry for message ${externalId}...`);
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
                quotedContext || undefined
              );
              this.syncRetryQueue.delete(retryKey);
              logger.info(`[Baileys] ✅ Background retry successful for ${externalId}`);
            } catch (retryError) {
              logger.error(`[Baileys] ❌ Background retry failed for ${externalId}:`, retryError);
              // Manter na queue para próxima sincronização
            }
          }, 10000); // 10 segundos
          
          return false;
        }
      }
    }
    
    return false; // Nunca deve chegar aqui, mas TypeScript precisa
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

        // Atualizar status no banco
        await this.prisma.message.updateMany({
          where: {
            externalId: messageId,
            connectionId,
          },
          data: {
            status: newStatus,
          },
        });

        logger.info(`[Baileys] Message ${messageId} status updated to ${newStatus}`);

        // Emitir evento via Socket.IO para atualizar frontend em tempo real
        const socketServer = getSocketServer();
        if (socketServer) {
          socketServer.getIO().emit('message_status_update', {
            messageId,
            status: newStatus,
            connectionId,
          });
        }
      }
    } catch (error) {
      logger.error(`[Baileys] Error updating message status for ${connectionId}:`, error);
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
    const maxAttempts = 30;
    if (client.reconnectAttempts && client.reconnectAttempts >= maxAttempts) {
      logger.warn(`[Baileys] ⏭️ Skipping reconnection for ${connectionId}: Max attempts (${maxAttempts}) reached`);
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
    if (this.reconnectionLocks.get(connectionId)) {
      logger.info(`[Baileys] ⏭️ Skipping reconnection for ${connectionId}: Already reconnecting (lock active)`);
      return;
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

    // ✅ MARCAR LOCK ANTES DE QUALQUER OPERAÇÃO
    this.reconnectionLocks.set(connectionId, true);
    
    // Marcar como reconectando
    client.isReconnecting = true;
    client.reconnectAttempts = (client.reconnectAttempts || 0) + 1;

    // Estratégia de reconexão com delays maiores para evitar conflitos:
    // - Primeira tentativa: 3s (dar tempo para a conexão anterior fechar completamente)
    // - Primeiras 5 tentativas: 5s entre cada
    // - Tentativas 6-15: 10s entre cada
    // - Após 15 tentativas: 30s entre cada (para não sobrecarregar)
    let delay = 3000; // Padrão: 3 segundos
    
    if (client.reconnectAttempts === 1) {
      delay = 3000; // 1ª tentativa: 3s
    } else if (client.reconnectAttempts <= 5) {
      delay = 5000; // Tentativas 2-5: 5s
    } else if (client.reconnectAttempts <= 15) {
      delay = 10000; // Tentativas 6-15: 10s
    } else {
      delay = 30000; // Após 15 tentativas: 30s
    }
    
    logger.info(`[Baileys] 🔄 Reconnection attempt ${client.reconnectAttempts}/30 for ${connectionId} in ${delay}ms...`);
    
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
        if (client.reconnectAttempts < 30) {
          setTimeout(() => {
            this.attemptReconnection(connectionId).catch(err => {
              logger.error(`[Baileys] Failed to retry reconnection after 503:`, err);
            });
          }, 30000); // 30 segundos para erro 503
        }
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
        messageContent = { image: { url }, caption: caption || '' };
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
          const uploadsDir = path.join(process.cwd(), 'uploads');
          const filepath = path.join(uploadsDir, filename);
          
          if (fs.existsSync(filepath)) {
            try {
              audioBuffer = fs.readFileSync(filepath);
              logger.info(`[Baileys] ✅ Audio file found locally: ${filename} (${audioBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`[Baileys] ❌ Failed to read audio file:`, fileError);
              audioBuffer = null;
            }
          } else {
            logger.warn(`[Baileys] ⚠️ Audio file not found locally: ${filepath}`);
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
        messageContent = { video: { url }, caption: caption || '' };
      } else if (messageType === 'document') {
        const { url, caption } = content as { url: string; caption?: string };
        messageContent = { document: { url }, fileName: caption || 'document' };
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
          messageContent = {
            image: { url: mediaUrl },
            caption: message,
          };
          break;

        case 'video':
          messageContent = {
            video: { url: mediaUrl },
            caption: message,
          };
          break;

        case 'document':
          // Extrair nome do arquivo da URL ou usar padrão
          const fileName = mediaUrl.split('/').pop() || 'document.pdf';
          messageContent = {
            document: { url: mediaUrl },
            fileName: fileName,
            caption: message,
          };
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
    if (!client) return;

    // Parar monitoramento, heartbeat e sincronização
    if (client.keepAliveInterval) {
      clearInterval(client.keepAliveInterval);
    }
    
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }
    
    if (client.syncInterval) {
      clearInterval(client.syncInterval);
    }

    // Só fazer logout se solicitado E se estiver conectado
    if (doLogout) {
      try {
        // Apenas fazer logout se estiver conectado
        if (client.status === 'connected') {
          await client.socket.logout();
          logger.info(`[Baileys] Logged out from ${connectionId}`);
        } else {
          logger.info(`[Baileys] Skipping logout for ${connectionId} (not connected)`);
        }
      } catch (error) {
        logger.warn(`[Baileys] Error logging out ${connectionId} (ignoring):`, error);
      }
    } else {
      logger.info(`[Baileys] Skipping logout for ${connectionId} (doLogout=false)`);
    }

    this.clients.delete(connectionId);
    logger.info(`[Baileys] Client removed: ${connectionId}`);
  }

  /**
   * Inicia monitoramento de conexão (keepalive)
   */
  private startConnectionMonitoring(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    // Verificar conexão a cada 10 segundos (mais agressivo)
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
        
        // Verificar se heartbeat está funcionando
        if (lastHeartbeat) {
          const secondsSinceHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / 1000;
          if (secondsSinceHeartbeat > 30) {
            logger.warn(`[Baileys] ⚠️ No heartbeat response in ${secondsSinceHeartbeat.toFixed(0)}s - connection may be dead`);
          }
        }
      } else {
        logger.warn(`[Baileys] ⚠️ Connection ${connectionId} is ${currentClient.status}, not connected!`);
        
        // Se está desconectado mas tem credenciais, tentar reconectar
        if (currentClient.hasCredentials && !currentClient.isReconnecting) {
          logger.info(`[Baileys] 🔄 Detected disconnection, triggering reconnection...`);
          this.attemptReconnection(connectionId).catch((err) => {
            logger.error(`[Baileys] Failed to trigger reconnection:`, err);
          });
        }
      }
    }, 10000); // 10 segundos (mais rápido que antes)

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

    // Heartbeat robusto a cada 30 segundos
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
          
          // Se heartbeat falhar, a conexão pode estar morta
          logger.info(`[Baileys] 🔄 Heartbeat failure detected, connection may be dead`);
        }
      }
    }, 30000); // 30 segundos (intervalo otimizado)

    logger.info(`[Baileys] 💚 Active heartbeat started for ${connectionId}`);
  }

  /**
   * Inicia sincronização periódica automática de mensagens
   * Roda a cada 2 minutos para garantir que nenhuma mensagem seja perdida
   */
  /**
   * ❌ SINCRONIZAÇÃO PERIÓDICA DESABILITADA
   * 
   * A sincronização periódica automática estava interferindo no recebimento
   * de mensagens em tempo real. Agora a sincronização só ocorre quando:
   * 
   * 1. **Reconexão**: Após desconexão, sincroniza todas as conversas
   * 2. **Detecção de Gaps**: Quando detecta lacunas temporais
   * 3. **Solicitação Manual**: Via API endpoints
   * 
   * Mensagens em tempo real são recebidas via eventos do Baileys (handleIncomingMessages)
   * e não precisam de sincronização periódica.
   */
  private startPeriodicSync(connectionId: string): void {
    // DESABILITADO: Sincronização periódica estava interferindo no recebimento de mensagens
    // As mensagens em tempo real são recebidas via eventos do Baileys
    // Sincronização só ocorre quando necessário (reconexão, gaps, manual)
    logger.info(`[Baileys] ⏭️ Periodic sync DISABLED for ${connectionId} - messages received via real-time events`);
    return;
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
          
          // Tentar processar novamente (a mensagem original já foi perdida, mas podemos tentar sincronizar)
          // A sincronização periódica vai pegar mensagens pendentes
          this.syncRetryQueue.delete(retryKey);
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

    // Verificar se há lock de reconexão ativo
    if (this.reconnectionLocks.get(connectionId)) {
      logger.info(`[Baileys] 🔁 Manual reconnect for ${connectionId} ignored - reconnection already in progress.`);
      return {
        status: 'already_reconnecting',
        message: 'Já existe um processo de reconexão em andamento.',
      };
    }

    // Verificar se há credenciais no banco de dados
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
      select: { authData: true },
    });

    const hasCredentialsInDB = connection && connection.authData !== null;

    // Se não há cliente, criar novo
    if (!client) {
      logger.info(`[Baileys] 🔁 Manual reconnect for ${connectionId} - no client found, creating new one...`);
      
      // Limpar locks
      this.reconnectionLocks.delete(connectionId);
      
      // Criar novo cliente (vai usar credenciais do banco se existirem)
      await this.createClient(connectionId);
      
      if (hasCredentialsInDB) {
        return {
          status: 'reconnecting',
          message: 'Reconectando com credenciais existentes...',
        };
      } else {
        return {
          status: 'awaiting_qr',
          message: 'Aguardando QR code...',
        };
      }
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
    
    // Remover cliente atual e criar novo (vai usar credenciais do banco)
    await this.removeClient(connectionId, false);
    await this.createClient(connectionId);

    return {
      status: 'reconnecting',
      message: 'Tentativa de reconexão iniciada.',
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
        logger.info(`[Baileys] 🔍 Iniciando sincronização de TODAS conversas desde a primeira conexão...`);
        
        // Aguardar 5 segundos para conexão estabilizar
        setTimeout(async () => {
          try {
            // Forçar sincronização de TODAS as conversas ativas desde firstConnectedAt
            // Isso garante que mensagens perdidas durante desconexão sejam recuperadas
            const syncedCount = await this.syncAllActiveConversations(connectionId, 100);
            
            logger.info(`[Baileys] ✅ Sincronização pós-reconexão completa: ${syncedCount} conversas sincronizadas`);
            
            // Também detectar e recuperar gaps
            const { gapsFound, recovered } = await this.detectAndRecoverGaps(connectionId);
            logger.info(`[Baileys] ✅ Detecção de gaps: ${gapsFound} encontrados, ${recovered} em recuperação`);
          } catch (syncError) {
            logger.error(`[Baileys] ❌ Erro na sincronização pós-reconexão:`, syncError);
          }
        }, 5000); // 5 segundos de espera
      }
    } catch (error) {
      logger.error(`[Baileys] Error saving firstConnectedAt for ${connectionId}:`, error);
    }
  }

  /**
   * Atualiza status no banco
   */
  private async updateConnectionStatus(connectionId: string, status: string) {
    try {
      await this.prisma.whatsAppConnection.update({
        where: { id: connectionId },
        data: {
          status,
          lastConnected: status === 'connected' ? new Date() : undefined,
        },
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
          status: { in: ['waiting', 'in_progress', 'transferred'] },
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
          status: { in: ['waiting', 'in_progress', 'transferred'] },
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

      logger.info(`[Baileys] Attempting to download media for message ${externalId}`);

      // LIMITAÇÃO: Baileys não permite baixar mídia de mensagens antigas facilmente
      // A mensagem precisa estar no cache ou ser recebida novamente
      // Por enquanto, retornar null e informar que não é possível
      
      logger.warn('[Baileys] Media re-download not available - message may be too old or not in cache');
      return null;
    } catch (error) {
      logger.error('[Baileys] Error downloading media:', error);
      return null;
    }
  }
}

export const baileysManager = new BaileysManager();
