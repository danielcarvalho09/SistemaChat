import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { logger } from '../config/logger.js';
import { SocketEvent } from '../models/types.js';
import { config } from '../config/env.js';

function getCookieToken(cookieHeader?: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((part) => part.trim());
  for (const entry of cookies) {
    const [name, value] = entry.split('=');
    if (name === 'accessToken' && value) {
      try {
        return decodeURIComponent(value);
      } catch (error) {
        logger.warn('Failed to decode accessToken cookie', { error });
        return value;
      }
    }
  }

  return null;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRoles?: string[];
}

export class SocketServer {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(httpServer: HTTPServer) {
    // Configuração robusta de CORS para WebSocket
    const allowedOrigins = config.security.corsOrigin;
    
    logger.info(`🔌 Initializing WebSocket with CORS origins: ${allowedOrigins.join(', ')}`);
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Permitir requisições sem origin (mobile apps, Postman, etc)
          if (!origin) {
            return callback(null, true);
          }
          
          // Verificar se a origin está na lista permitida
          if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
          } else {
            logger.warn(`WebSocket connection rejected from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
      transports: ['websocket', 'polling'],
      // Configurações otimizadas para NUNCA desconectar:
      pingTimeout: 600000, // 10 minutos - tempo que espera por pong antes de desconectar
      pingInterval: 25000, // 25 segundos - frequencia de ping
      upgradeTimeout: 60000, // 60 segundos - tempo para upgrade de transporte
      maxHttpBufferSize: 10e6, // 10MB - buffer maior para mensagens grandes
      allowEIO3: true, // Compatibilidade com versões antigas
      // Configurações adicionais para máxima estabilidade
      connectTimeout: 120000, // 2 minutos para estabelecer conexão
      perMessageDeflate: false, // Desabilitar compressão para melhor performance
      // Configurações extras para persistência
      allowUpgrades: true, // Permitir upgrade de transporte
      httpCompression: false, // Desabilitar compressão HTTP
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Configura middleware de autenticação
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || getCookieToken(socket.handshake.headers.cookie);

        if (!token) {
          logger.warn('Socket connection without token - allowing for public events');
          return next();
        }

        try {
          const decoded = verifyAccessToken(token);
          socket.userId = decoded.userId;
          socket.userRoles = decoded.roles;
          logger.info(`Socket authenticated: ${socket.userId}`);
        } catch (error) {
          logger.warn('Invalid token, allowing connection for public events:', error);
        }

        next();
      } catch (error) {
        logger.error('Socket middleware error:', error);
        next(error as Error);
      }
    });
  }

  /**
   * Configura handlers de eventos
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId || 'anonymous';
      logger.info(`User ${userId} connected via socket ${socket.id}`);

      // Adicionar à lista de usuários conectados
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      // Entrar em sala de conversa
      socket.on(SocketEvent.JOIN_ROOM, (conversationId: string) => {
        socket.join(`conversation:${conversationId}`);
        logger.debug(`User ${userId} joined conversation ${conversationId}`);
      });

      // Sair de sala de conversa
      socket.on(SocketEvent.LEAVE_ROOM, (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`);
        logger.debug(`User ${userId} left conversation ${conversationId}`);
      });

      // Usuário começou a digitar
      socket.on(SocketEvent.TYPING_START, (conversationId: string) => {
        socket.to(`conversation:${conversationId}`).emit(SocketEvent.USER_TYPING, {
          conversationId,
          userId,
          isTyping: true,
        });
      });

      // Usuário parou de digitar
      socket.on(SocketEvent.TYPING_STOP, (conversationId: string) => {
        socket.to(`conversation:${conversationId}`).emit(SocketEvent.USER_TYPING, {
          conversationId,
          userId,
          isTyping: false,
        });
      });

      // Mensagem lida
      socket.on(SocketEvent.MESSAGE_READ, (data: { conversationId: string; messageId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit(SocketEvent.MESSAGE_STATUS_UPDATE, {
          messageId: data.messageId,
          status: 'read',
        });
      });

      // Heartbeat - responder ao ping do cliente
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Desconexão
      socket.on('disconnect', () => {
        logger.info(`User ${userId} disconnected from socket ${socket.id}`);
        
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            this.connectedUsers.delete(userId);
          }
        }
      });
    });
  }

  /**
   * Emite nova mensagem para sala de conversa E globalmente
   */
  emitNewMessage(conversationId: string, message: any): void {
    const payload = { conversationId, message };
    
    // Emitir para sala da conversa (quem está com a conversa aberta)
    this.io.to(`conversation:${conversationId}`).emit(SocketEvent.NEW_MESSAGE, payload);
    
    // Emitir globalmente para todos os usuários (notificação/atualização de lista)
    this.io.emit(SocketEvent.NEW_MESSAGE, payload);
    
    logger.debug(`New message emitted for conversation ${conversationId} (room + global)`);
  }

  /**
   * Emite atualização de conversa
   */
  emitConversationUpdate(conversationId: string, updates: any): void {
    this.io.to(`conversation:${conversationId}`).emit(SocketEvent.CONVERSATION_UPDATE, {
      conversationId,
      updates,
    });
  }

  /**
   * Emite conversa atribuída a um usuário
   */
  emitConversationAssigned(userId: string, conversation: any): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.io.to(socketId).emit(SocketEvent.CONVERSATION_ASSIGNED, conversation);
      });
    }
  }

  /**
   * Emite conversa transferida
   */
  emitConversationTransferred(conversationId: string, fromUserId: string, toUserId: string): void {
    // Notificar usuário que recebeu
    const toUserSockets = this.connectedUsers.get(toUserId);
    if (toUserSockets) {
      toUserSockets.forEach((socketId) => {
        this.io.to(socketId).emit(SocketEvent.CONVERSATION_TRANSFERRED, {
          conversationId,
          fromUserId,
          toUserId,
        });
      });
    }

    // Atualizar sala da conversa
    this.io.to(`conversation:${conversationId}`).emit(SocketEvent.CONVERSATION_UPDATE, {
      conversationId,
      updates: { assignedUserId: toUserId },
    });
  }

  /**
   * Emite mudança de status de conexão WhatsApp
   */
  emitConnectionStatusChange(connectionId: string, status: string): void {
    this.io.emit(SocketEvent.CONNECTION_STATUS_CHANGE, {
      connectionId,
      status,
    });
  }

  /**
   * Emite notificação para usuário específico
   */
  emitNotification(userId: string, notification: any): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.io.to(socketId).emit(SocketEvent.NOTIFICATION, notification);
      });
    }
  }

  /**
   * Verifica se usuário está online
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Obtém lista de usuários online
   */
  getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  /**
   * Obtém instância do Socket.IO
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Emite QR Code para conexão WhatsApp
   */
  emitWhatsAppQRCode(connectionId: string, qrCode: string): void {
    this.io.emit(SocketEvent.WHATSAPP_QR_CODE, {
      connectionId,
      qrCode,
      timestamp: new Date(),
    });
    logger.info(`QR Code emitted for connection ${connectionId}`);
  }

  /**
   * Emite status de conexão WhatsApp
   */
  emitWhatsAppStatus(connectionId: string, status: 'connecting' | 'connected' | 'disconnected'): void {
    let event: string;
    
    switch (status) {
      case 'connecting':
        event = SocketEvent.WHATSAPP_CONNECTING;
        break;
      case 'connected':
        event = SocketEvent.WHATSAPP_CONNECTED;
        break;
      case 'disconnected':
        event = SocketEvent.WHATSAPP_DISCONNECTED;
        break;
    }

    this.io.emit(event, {
      connectionId,
      status,
      timestamp: new Date(),
    });
    logger.info(`WhatsApp status ${status} emitted for connection ${connectionId}`);
  }

  /**
   * Emite evento de falha na conexão WhatsApp
   */
  emitWhatsAppConnectionFailed(connectionId: string, error: string): void {
    this.io.emit(SocketEvent.WHATSAPP_CONNECTION_FAILED, {
      connectionId,
      error,
      timestamp: new Date(),
    });
    logger.error(`WhatsApp connection failed emitted for ${connectionId}: ${error}`);
  }
}

let socketServer: SocketServer;

export const initializeSocketServer = (httpServer: HTTPServer): SocketServer => {
  socketServer = new SocketServer(httpServer);
  logger.info('✅ WebSocket server initialized');
  return socketServer;
};

export const getSocketServer = (): SocketServer => {
  if (!socketServer) {
    throw new Error('Socket server not initialized');
  }
  return socketServer;
};
