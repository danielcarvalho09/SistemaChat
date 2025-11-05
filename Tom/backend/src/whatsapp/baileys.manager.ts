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
      
      // Iniciar sincronização periódica automática
      this.startPeriodicSync(connectionId);

      logger.info(`[Baileys] ✅ Client created successfully: ${connectionId}`);
      
      // Liberar lock após criação bem-sucedida
      this.reconnectionLocks.delete(connectionId);
      
      return client;
    } catch (error) {
      logger.error(`[Baileys] Error creating client ${connectionId}:`, error);
      
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
      await this.saveFirstConnectedAt(connectionId);
      
      await this.updateConnectionStatus(connectionId, 'connected');
      this.emitStatus(connectionId, 'connected');
      return;
    }

    // Desconectado
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const errorMessage = (lastDisconnect?.error as Error)?.message || 'Unknown error';
      
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
        logger.warn(`[Baileys] Logged out: ${connectionId}`);
        await this.removeClient(connectionId, false); // Não fazer logout, já foi deslogado
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
      }

      // 📊 Estatísticas de sincronização
      const syncStats = {
        total: messages?.length || 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        type,
      };

      // IMPORTANTE: Processar mensagens apenas a partir da primeira conexão
      // - notify: mensagens em tempo real (sempre processar)
      // - append: mensagens adicionadas (filtrar por data)
      // - history: mensagens históricas (filtrar por data - mas já foi bloqueado acima)
      logger.info(`[Baileys] 📨 Processing message batch - Type: ${type}, Count: ${messages?.length || 0}`);

      for (const msg of messages) {
        const from = msg.key.remoteJid;
        const isFromMe = msg.key.fromMe || false;
        const externalId = msg.key.id;
        const pushName = msg.pushName || null; // Capturar pushName do contato

        logger.info(`[Baileys] 📱 Processing message from ${from}, isFromMe: ${isFromMe}, pushName: ${pushName}`);

        // ===== FILTROS =====
        
        // 0. Filtrar mensagens antigas (anteriores à primeira conexão)
        // IMPORTANTE: 
        // - Mensagens em tempo real (notify) SEMPRE passam (são novas)
        // - Mensagens sem timestamp SEMPRE passam (podem ser novas)
        // - Só filtrar mensagens de histórico que têm timestamp explícito e anterior à primeira conexão
        if (firstConnectedAt && type === 'history') {
          // Extrair timestamp da mensagem do Baileys
          // msg.messageTimestamp vem em segundos Unix, precisa converter para Date
          const messageTimestamp = msg.messageTimestamp 
            ? new Date(Number(msg.messageTimestamp) * 1000) 
            : msg.key?.messageTimestamp 
              ? new Date(Number(msg.key.messageTimestamp) * 1000)
              : null;
          
          // Só filtrar se tiver timestamp E for claramente anterior à primeira conexão
          // Se não tiver timestamp, processar (pode ser mensagem recente sem timestamp)
          if (messageTimestamp && messageTimestamp < firstConnectedAt) {
            logger.debug(`[Baileys] ⏭️ Skipping old history message from ${messageTimestamp.toISOString()} (before first connection at ${firstConnectedAt.toISOString()})`);
            syncStats.skipped++;
            continue;
          }
        }
        // Para 'append' e outros tipos, sempre processar (são mensagens novas ou recentes)
        
        // 1. Filtrar STATUS do WhatsApp (status@broadcast)
        if (from === 'status@broadcast') {
          logger.debug(`[Baileys] ⏭️ Skipping WhatsApp Status message`);
          syncStats.skipped++;
          continue;
        }

        // 2. Filtrar CANAIS DE TRANSMISSÃO (newsletter)
        if (from?.includes('@newsletter')) {
          logger.debug(`[Baileys] ⏭️ Skipping WhatsApp Channel/Newsletter message`);
          syncStats.skipped++;
          continue;
        }

        // 3. Filtrar LISTAS DE TRANSMISSÃO (broadcast)
        if (from?.includes('@broadcast')) {
          logger.debug(`[Baileys] ⏭️ Skipping Broadcast List message`);
          syncStats.skipped++;
          continue;
        }

        // 4. Capturar mensagens enviadas por VOCÊ em GRUPOS
        // Se a mensagem é de um grupo (@g.us) e foi enviada por você (isFromMe = true)
        const isGroup = from?.endsWith('@g.us');
        
        if (isGroup && isFromMe) {
          logger.info(`[Baileys] ✅ Capturing YOUR message in group ${from}`);
          // Processar normalmente
        }
        // Não pular mensagens 'append' enviadas por você — precisamos sincronizar histórico

        let messageText = '';
        let messageType = 'text';
        let audioMediaUrl: string | null = null; // ✅ Variável para armazenar URL do áudio baixado
        let imageMediaUrl: string | null = null; // ✅ Variável para armazenar URL da imagem baixada

        if (msg.message?.conversation) {
          messageText = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          messageText = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage) {
          messageText = msg.message.imageMessage.caption || '[Imagem]';
          messageType = 'image';
          
          // ✅ Baixar e salvar imagem recebida
          try {
            const client = this.clients.get(connectionId);
            if (client?.socket) {
              logger.info(`[Baileys] 📥 Downloading image message ${externalId}...`);
              
              // Baixar imagem usando downloadMediaMessage do Baileys
              const imageBuffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { logger: pino({ level: 'silent' }), reuploadRequest: client.socket.updateMediaMessage }
              );
              
              if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
                // Detectar extensão baseado no mimetype da imagem
                const imageMimetype = msg.message.imageMessage?.mimetype || 'image/jpeg';
                let imageExt = '.jpg'; // padrão
                
                if (imageMimetype.includes('jpeg') || imageMimetype.includes('jpg')) {
                  imageExt = '.jpg';
                } else if (imageMimetype.includes('png')) {
                  imageExt = '.png';
                } else if (imageMimetype.includes('gif')) {
                  imageExt = '.gif';
                } else if (imageMimetype.includes('webp')) {
                  imageExt = '.webp';
                } else if (imageMimetype.includes('bmp')) {
                  imageExt = '.bmp';
                }
                
                // Salvar arquivo de imagem
                const timestamp = Date.now();
                const randomString = Math.random().toString(36).substring(7);
                const filename = `image-${timestamp}-${randomString}${imageExt}`;
                const uploadsDir = path.join(process.cwd(), 'uploads');
                
                // Criar diretório se não existir
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }
                
                const filepath = path.join(uploadsDir, filename);
                fs.writeFileSync(filepath, imageBuffer);
                
                imageMediaUrl = `/uploads/${filename}`;
                logger.info(`[Baileys] ✅ Image saved: ${filename} (${imageBuffer.length} bytes, mimetype: ${imageMimetype})`);
              } else {
                logger.warn(`[Baileys] ⚠️ Failed to download image, saving without media URL`);
              }
            }
          } catch (imageError) {
            logger.error(`[Baileys] ❌ Error downloading image:`, imageError);
            // Continuar processamento sem URL da imagem
          }
        } else if (msg.message?.audioMessage) {
          messageText = '[Áudio]';
          messageType = 'audio';
          
          // ✅ Baixar e salvar áudio recebido
          try {
            const client = this.clients.get(connectionId);
            if (client?.socket) {
              logger.info(`[Baileys] 📥 Downloading audio message ${externalId}...`);
              
              // Baixar áudio usando downloadMediaMessage do Baileys
              const audioBuffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { logger: pino({ level: 'silent' }), reuploadRequest: client.socket.updateMediaMessage }
              );
              
              if (audioBuffer && Buffer.isBuffer(audioBuffer)) {
                // Detectar extensão baseado no mimetype do áudio
                const audioMimetype = msg.message.audioMessage?.mimetype || 'audio/ogg; codecs=opus';
                let audioExt = '.ogg'; // padrão
                
                if (audioMimetype.includes('mp3') || audioMimetype.includes('mpeg')) {
                  audioExt = '.mp3';
                } else if (audioMimetype.includes('wav')) {
                  audioExt = '.wav';
                } else if (audioMimetype.includes('ogg') || audioMimetype.includes('opus')) {
                  audioExt = '.ogg';
                } else if (audioMimetype.includes('webm')) {
                  audioExt = '.webm';
                } else if (audioMimetype.includes('aac')) {
                  audioExt = '.aac';
                } else if (audioMimetype.includes('mp4') || audioMimetype.includes('m4a')) {
                  audioExt = '.m4a';
                } else if (audioMimetype.includes('amr')) {
                  audioExt = '.amr';
                }
                
                // Salvar arquivo de áudio
                const timestamp = Date.now();
                const randomString = Math.random().toString(36).substring(7);
                const filename = `audio-${timestamp}-${randomString}${audioExt}`;
                const uploadsDir = path.join(process.cwd(), 'uploads');
                
                // Criar diretório se não existir
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }
                
                const filepath = path.join(uploadsDir, filename);
                fs.writeFileSync(filepath, audioBuffer);
                
                audioMediaUrl = `/uploads/${filename}`;
                logger.info(`[Baileys] ✅ Audio saved: ${filename} (${audioBuffer.length} bytes, mimetype: ${audioMimetype})`);
              } else {
                logger.warn(`[Baileys] ⚠️ Failed to download audio, saving without media URL`);
              }
            }
          } catch (audioError) {
            logger.error(`[Baileys] ❌ Error downloading audio:`, audioError);
            // Continuar processamento sem URL do áudio
          }
        } else if (msg.message?.videoMessage) {
          messageText = msg.message.videoMessage.caption || '[Vídeo]';
          messageType = 'video';
        } else if (msg.message?.documentMessage) {
          messageText = msg.message.documentMessage.fileName || '[Documento]';
          messageType = 'document';
        }

        if (!messageText) {
          logger.warn(`[Baileys] ⚠️ Empty message text, skipping. Message object:`, JSON.stringify(msg.message));
          syncStats.skipped++;
          continue;
        }

        logger.info(`[Baileys] ✅ New ${messageType} from ${from} on ${connectionId}: "${messageText.substring(0, 50)}..."`);

        // Processar mensagem (criar contato, conversa e salvar)
        try {
          const { MessageService } = await import('../services/message.service.js');
          const messageService = new MessageService();
          await messageService.processIncomingMessage(
            connectionId,
            from,
            messageText,
            messageType,
            messageType === 'audio' ? audioMediaUrl : messageType === 'image' ? imageMediaUrl : null, // ✅ Passar URL da mídia se foi baixada
            isFromMe,
            externalId,
            pushName // Passar pushName para o service
          );
          logger.info(`[Baileys] 💾 Message saved successfully (${messageType})`);
          syncStats.processed++;
        } catch (error) {
          logger.error(`[Baileys] ❌ Error processing message from ${from}:`, error);
          syncStats.errors++;
          
          // RETRY: Se falhar, adicionar à fila de retry
          const retryKey = `${connectionId}:${externalId}`;
          const retryInfo = this.syncRetryQueue.get(retryKey) || { retries: 0, lastAttempt: new Date() };
          
          if (retryInfo.retries < 3) {
            retryInfo.retries++;
            retryInfo.lastAttempt = new Date();
            this.syncRetryQueue.set(retryKey, retryInfo);
            logger.info(`[Baileys] 🔄 Message added to retry queue (attempt ${retryInfo.retries}/3)`);
            
            // Tentar novamente após 5 segundos
            setTimeout(async () => {
              try {
                const { MessageService } = await import('../services/message.service.js');
                const retryMessageService = new MessageService();
                await retryMessageService.processIncomingMessage(
                  connectionId,
                  from,
                  messageText,
                  messageType,
                  null,
                  isFromMe,
                  externalId,
                  pushName
                );
                this.syncRetryQueue.delete(retryKey);
                logger.info(`[Baileys] ✅ Message retry successful for ${externalId}`);
              } catch (retryError) {
                logger.error(`[Baileys] ❌ Message retry failed for ${externalId}:`, retryError);
              }
            }, 5000);
          } else {
            logger.error(`[Baileys] ❌ Max retries reached for message ${externalId}, giving up`);
            this.syncRetryQueue.delete(retryKey);
          }
        }
      }

      // 📊 Log de estatísticas de sincronização
      logger.info(`[Baileys] 📊 Sync stats for ${connectionId}: Total=${syncStats.total}, Processed=${syncStats.processed}, Skipped=${syncStats.skipped}, Errors=${syncStats.errors}`);
    } catch (error) {
      logger.error(`[Baileys] Error handling messages for ${connectionId}:`, error);
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
    const client = this.clients.get(connectionId);
    
    if (!client) {
      logger.error(`[Baileys] Cannot reconnect: Client ${connectionId} not found`);
      return;
    }

    // Verificar se já está reconectando (dupla verificação)
    if (client.isReconnecting || this.reconnectionLocks.get(connectionId)) {
      logger.info(`[Baileys] ⏭️ Reconnection already in progress for ${connectionId}, skipping...`);
      return;
    }

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
    } catch (error) {
      logger.error(`[Baileys] ❌ Reconnection failed for ${connectionId}:`, error);
      
      // Resetar flag mesmo em caso de erro
      const updatedClient = this.clients.get(connectionId);
      if (updatedClient) {
        updatedClient.isReconnecting = false;
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
    messageType: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text'
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
        
        // ✅ IMPORTANTE: WhatsApp requer formato específico para áudios PTT (Push-to-Talk)
        // O WhatsApp funciona melhor com audio/ogg; codecs=opus para mensagens de voz
        // NOTA: Estamos apenas declarando o mimetype como OGG/Opus, mas o arquivo físico
        // pode estar em outro formato (MP3, WAV, etc.). O Baileys/WhatsApp pode converter
        // automaticamente, mas para garantir 100% de compatibilidade, seria ideal converter
        // o arquivo fisicamente para OGG/Opus antes de enviar (usando FFmpeg).
        // Por enquanto, o Baileys deve aceitar outros formatos e converter automaticamente.
        const whatsappAudioMimetype = 'audio/ogg; codecs=opus';
        
        logger.info(`[Baileys] Sending audio with URL: ${audioUrl}, original mimetype: ${audioMimetype}, WhatsApp mimetype: ${whatsappAudioMimetype}`);
        
        // ✅ CRÍTICO: Sempre tentar enviar como buffer quando possível
        // O WhatsApp não consegue acessar URLs privadas ou relativas
        // Enviar como buffer garante que o áudio seja acessível
        
        let audioBuffer: Buffer | null = null;
        let filename: string | null = null;
        
        // Tentar extrair filename e verificar se existe localmente
        if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
          // URL relativa - tentar ler arquivo local
          // Exemplo: /uploads/audio-123.mp3 -> audio-123.mp3
          filename = audioUrl.split('/').pop() || null;
        } else {
          // URL absoluta - tentar extrair filename
          // Exemplo: https://dominio.com/uploads/audio-123.mp3 -> audio-123.mp3
          const urlParts = audioUrl.split('/');
          filename = urlParts[urlParts.length - 1] || null;
          
          // Se a URL absoluta aponta para nosso próprio servidor, sempre tentar ler localmente
          const baseUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
          const isOurServer = audioUrl.includes(baseUrl) || 
                             audioUrl.includes('localhost') || 
                             audioUrl.includes('127.0.0.1') ||
                             audioUrl.includes('/uploads/'); // Se contém /uploads/, provavelmente é nosso servidor
          
          if (!isOurServer && filename) {
            // Se não é nosso servidor, ainda tentar ler localmente (pode ter sido copiado)
            logger.info(`[Baileys] URL absoluta de servidor externo, mas tentando ler arquivo localmente: ${filename}`);
          }
        }
        
        // ✅ Tentar ler arquivo localmente se tiver filename
        if (filename) {
          const uploadsDir = path.join(process.cwd(), 'uploads');
          const filepath = path.join(uploadsDir, filename);
          
          if (fs.existsSync(filepath)) {
            try {
              // Ler arquivo como buffer
              audioBuffer = fs.readFileSync(filepath);
              logger.info(`[Baileys] ✅ Reading audio file from disk: ${filename} (${audioBuffer.length} bytes)`);
            } catch (fileError) {
              logger.warn(`[Baileys] Failed to read audio file from disk:`, fileError);
              audioBuffer = null;
            }
          } else {
            logger.warn(`[Baileys] Audio file not found locally: ${filepath}`);
          }
        }
        
        // ✅ Sempre preferir enviar como buffer (mais confiável para WhatsApp)
        if (audioBuffer) {
          // Enviar como buffer - WhatsApp pode acessar diretamente
          messageContent = { 
            audio: audioBuffer, 
            mimetype: whatsappAudioMimetype, // ✅ Forçar formato compatível com WhatsApp
            ptt: true // Push-to-Talk (mensagem de voz)
          };
          logger.info(`[Baileys] ✅ Sending audio as buffer (format: ${whatsappAudioMimetype}, PTT: true, size: ${audioBuffer.length} bytes)`);
        } else {
          // Fallback: usar URL apenas se não conseguir ler arquivo localmente
          // ⚠️ AVISO: URLs podem não ser acessíveis pelo WhatsApp se não forem públicas
          logger.warn(`[Baileys] ⚠️ Sending audio via URL (may not be accessible by WhatsApp): ${audioUrl}`);
          messageContent = { 
            audio: { url: audioUrl }, 
            mimetype: whatsappAudioMimetype, // ✅ Forçar formato compatível
            ptt: true 
          };
        }
      } else if (messageType === 'video') {
        const { url, caption } = content as { url: string; caption?: string };
        messageContent = { video: { url }, caption: caption || '' };
      } else if (messageType === 'document') {
        const { url, caption } = content as { url: string; caption?: string };
        messageContent = { document: { url }, fileName: caption || 'document' };
      }

      const sent = await client.socket.sendMessage(jid, messageContent);
      const externalId = sent?.key?.id as string | undefined;
      logger.info(`[Baileys] Message sent from ${connectionId} to ${to} (id: ${externalId || 'n/a'})`);
      return externalId;
    } catch (error) {
      logger.error(`[Baileys] Error sending message from ${connectionId}:`, error);
      throw error;
    }
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
  private startPeriodicSync(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    // Sincronização a cada 2 minutos
    client.syncInterval = setInterval(async () => {
      const currentClient = this.clients.get(connectionId);
      if (!currentClient) {
        clearInterval(client.syncInterval!);
        return;
      }

      // Só sincronizar se estiver conectado
      if (currentClient.status === 'connected') {
        try {
          logger.info(`[Baileys] 🔄 Starting periodic sync for ${connectionId}...`);
          
          // Sincronizar todas as conversas ativas
          const syncedCount = await this.syncAllActiveConversations(connectionId);
          
          currentClient.lastSync = new Date();
          logger.info(`[Baileys] ✅ Periodic sync completed for ${connectionId}: ${syncedCount} conversations synced`);
        } catch (error) {
          logger.error(`[Baileys] ❌ Error in periodic sync for ${connectionId}:`, error);
        }
      }
    }, 120000); // 2 minutos

    logger.info(`[Baileys] 🔄 Periodic sync started for ${connectionId} (every 2 minutes)`);
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

  /**
   * Salva firstConnectedAt quando conectar pela primeira vez
   */
  private async saveFirstConnectedAt(connectionId: string): Promise<void> {
    try {
      const connection = await this.prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        select: { firstConnectedAt: true },
      });

      // Só salvar se ainda não foi salvo
      if (connection && !connection.firstConnectedAt) {
        const now = new Date();
        await this.prisma.whatsAppConnection.update({
          where: { id: connectionId },
          data: { firstConnectedAt: now },
        });
        logger.info(`[Baileys] ✅ First connection timestamp saved for ${connectionId}: ${now.toISOString()}`);
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
    } catch (error) {
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
  async syncConversationMessages(connectionId: string, phoneNumber: string): Promise<boolean> {
    try {
      const client = this.clients.get(connectionId);
      if (!client || client.status !== 'connected') {
        logger.warn(`[Baileys] Cannot sync: connection ${connectionId} not available`);
        return false;
      }

      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      logger.info(`[Baileys] 🔄 Manual sync requested for ${phoneNumber} on ${connectionId}`);

      try {
        // 1. Marcar presença no chat
        await client.socket.sendPresenceUpdate('available', jid);
        
        // 2. Marcar como "composing" e depois "paused" para ativar sincronização
        await client.socket.sendPresenceUpdate('composing', jid);
        await new Promise(resolve => setTimeout(resolve, 500));
        await client.socket.sendPresenceUpdate('paused', jid);
        
        logger.info(`[Baileys] ✅ Sync triggered for ${phoneNumber}`);
        return true;
      } catch (error) {
        logger.error(`[Baileys] ❌ Error syncing conversation:`, error);
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
   */
  async syncAllActiveConversations(connectionId: string): Promise<number> {
    try {
      logger.info(`[Baileys] 🔄 Syncing all active conversations for ${connectionId}...`);
      
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
        const success = await this.syncConversationMessages(connectionId, conv.contact.phoneNumber);
        if (success) syncedCount++;
        
        // Delay entre sincronizações para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info(`[Baileys] ✅ Synced ${syncedCount}/${conversations.length} conversations`);
      return syncedCount;
    } catch (error) {
      logger.error(`[Baileys] ❌ Error in syncAllActiveConversations:`, error);
      return 0;
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
