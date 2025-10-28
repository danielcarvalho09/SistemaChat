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
import { logger } from '../config/logger.js';
import { getSocketServer } from '../websocket/socket.server.js';
import { getPrismaClient } from '../config/database.js';

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
  hasCredentials?: boolean; // Indica se tem credenciais salvas (já foi conectado antes)
  reconnectAttempts?: number; // Contador de tentativas de reconexão
  isReconnecting?: boolean; // Flag para evitar múltiplas reconexões simultâneas
  lastHeartbeat?: Date; // Última vez que o heartbeat foi bem-sucedido
}

/**
 * Gerenciador de conexões Baileys
 * Baseado 100% na documentação oficial: https://baileys.wiki/docs/intro/
 */
class BaileysManager {
  private clients: Map<string, BaileysClient> = new Map();
  private prisma = getPrismaClient();
  private reconnectionLocks: Map<string, boolean> = new Map(); // Previne reconexões simultâneas

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
        syncFullHistory: true, // habilita sincronização de histórico ao reconectar
        markOnlineOnConnect: false,
        // Configurações para melhorar estabilidade da conexão
        connectTimeoutMs: 60000, // Timeout de 60s para conectar (ao invés do padrão 20s)
        defaultQueryTimeoutMs: 60000, // Timeout para queries
        keepAliveIntervalMs: 10000, // Enviar pings a cada 10s (padrão é 25s)
        retryRequestDelayMs: 250, // Delay mínimo entre tentativas de requisição
        getMessage: async (key) => {
          // Futuro: buscar mensagem do banco pelo externalId (key.id)
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


      // Event: Atualização de status de mensagens (delivered, read)
      socket.ev.on('messages.update', async (updates) => {
        await this.handleMessageStatusUpdate(connectionId, updates);
      });

      // Iniciar monitoramento de conexão
      this.startConnectionMonitoring(connectionId);
      
      // Iniciar heartbeat ativo
      this.startActiveHeartbeat(connectionId);

      logger.info(`[Baileys] ✅ Client created successfully: ${connectionId}`);
      
      // Liberar lock após criação bem-sucedida
      this.reconnectionLocks.delete(connectionId);
      
      return client;
    } catch (error) {
      logger.error(`[Baileys] Error creating client ${connectionId}:`, error);
      
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
        const authData = JSON.parse(connection.authData as string, BufferJSON.reviver);
        creds = authData.creds;
        keys = authData.keys || {};
        logger.info(`[Baileys] ✅ Loaded existing auth for ${connectionId} (has credentials)`);
      } catch (error) {
        logger.warn(`[Baileys] ⚠️ Failed to parse auth data, creating new credentials`);
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
        const authData = JSON.stringify(
          {
            creds,
            keys,
          },
          BufferJSON.replacer
        );

        await this.prisma.whatsAppConnection.update({
          where: { id: connectionId },
          data: { authData },
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

      // Atualizar timestamp de última mensagem recebida
      const client = this.clients.get(connectionId);
      if (client) {
        client.lastMessageReceived = new Date();
      }

      // 📊 Estatísticas de sincronização
      const syncStats = {
        total: messages?.length || 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        type,
      };

      if (type !== 'notify' && type !== 'append') {
        logger.info(`[Baileys] ⏭️ Skipping message type: ${type}`);
        return;
      }

      for (const msg of messages) {
        const from = msg.key.remoteJid;
        const isFromMe = msg.key.fromMe || false;
        const externalId = msg.key.id;
        const pushName = msg.pushName || null; // Capturar pushName do contato

        logger.info(`[Baileys] 📱 Processing message from ${from}, isFromMe: ${isFromMe}, pushName: ${pushName}`);

        // ===== FILTROS =====
        
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

        if (msg.message?.conversation) {
          messageText = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          messageText = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage) {
          messageText = msg.message.imageMessage.caption || '[Imagem]';
          messageType = 'image';
        } else if (msg.message?.audioMessage) {
          messageText = '[Áudio]';
          messageType = 'audio';
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
            null,
            isFromMe,
            externalId,
            pushName // Passar pushName para o service
          );
          logger.info(`[Baileys] 💾 Message saved successfully`);
          syncStats.processed++;
        } catch (error) {
          logger.error(`[Baileys] ❌ Error processing message:`, error);
          syncStats.errors++;
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
        messageContent = { audio: { url }, mimetype: 'audio/ogg; codecs=opus', ptt: true };
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

    // Parar monitoramento e heartbeat
    if (client.keepAliveInterval) {
      clearInterval(client.keepAliveInterval);
    }
    
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
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
   * Envia ping para o WhatsApp a cada 15 segundos
   */
  private startActiveHeartbeat(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    // Heartbeat a cada 15 segundos
    client.heartbeatInterval = setInterval(async () => {
      const currentClient = this.clients.get(connectionId);
      if (!currentClient) {
        clearInterval(client.heartbeatInterval!);
        return;
      }

      // Só fazer heartbeat se estiver conectado
      if (currentClient.status === 'connected') {
        try {
          // Tentar uma operação leve para verificar se a conexão está viva
          // Usando fetchPrivacySettings como "ping" - é uma operação leve
          await currentClient.socket.fetchPrivacySettings();
          currentClient.lastHeartbeat = new Date();
          logger.debug(`[Baileys] 💚 Heartbeat OK for ${connectionId}`);
        } catch (error) {
          logger.warn(`[Baileys] 💔 Heartbeat failed for ${connectionId}:`, error);
          
          // Se heartbeat falhar, a conexão pode estar morta
          // O handler de connection.update deve detectar isso e reconectar
          logger.info(`[Baileys] 🔄 Heartbeat failure detected, connection may be dead`);
        }
      }
    }, 15000); // 15 segundos

    logger.info(`[Baileys] 💚 Active heartbeat started for ${connectionId}`);
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
