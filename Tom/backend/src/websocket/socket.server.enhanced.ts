import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { getPrismaClient } from '../config/database.js';
import { ConversationResponse } from '../models/types.js';

/**
 * Extrai token do cookie
 */
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

/**
 * Socket autenticado com informações do usuário
 */
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRoles?: string[];
  departmentId?: string;
  connectionId?: string; // ID da conexão WhatsApp do usuário
}

/**
 * Informações de conexão armazenadas
 */
interface ConnectionInfo {
  userId: string;
  socketId: string;
  departmentId: string | null;
  connectionId: string | null; // ID da conexão WhatsApp
  userRoles: string[];
  connectedAt: Date;
}

/**
 * Eventos do Socket
 */
export enum SocketEvent {
  // Conexão
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  
  // Salas
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  
  // Conversas
  ACCEPT_CONVERSATION = 'accept_conversation',
  CONVERSATION_ACCEPTED = 'conversation_accepted',
  NEW_CONVERSATION = 'new_conversation',
  CONVERSATION_UPDATE = 'conversation_update',
  CONVERSATION_ASSIGNED = 'conversation_assigned',
  
  // Mensagens
  NEW_MESSAGE = 'new_message',
  MESSAGE_STATUS_UPDATE = 'message_status_update',
  
  // WhatsApp
  WHATSAPP_QR_CODE = 'whatsapp_qr_code',
  WHATSAPP_CONNECTED = 'whatsapp_connected',
  WHATSAPP_DISCONNECTED = 'whatsapp_disconnected',
  WHATSAPP_CONNECTING = 'whatsapp_connecting',
  WHATSAPP_CONNECTION_FAILED = 'whatsapp_connection_failed',
  
  // Digitação
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
}

/**
 * Servidor WebSocket melhorado com mapa de conexões
 */
export class EnhancedSocketServer {
  private io: SocketIOServer;
  private prisma = getPrismaClient();
  
  // 🔑 MAPA CRÍTICO: socket.id -> informações completas da conexão
  private connectionMap: Map<string, ConnectionInfo> = new Map();
  
  // Mapa adicional: userId -> Set<socketId> (um usuário pode ter múltiplas conexões)
  private userSockets: Map<string, Set<string>> = new Map();
  
  // Mapa: connectionId (WhatsApp) -> userId (para rápida associação)
  private whatsappConnectionOwners: Map<string, string> = new Map();

  constructor(httpServer: HTTPServer) {
    // Configuração robusta de CORS
    const allowedOrigins = config.security.corsOrigin;
    
    logger.info(`🔌 Initializing Enhanced WebSocket Server`);
    logger.info(`📍 CORS origins: ${allowedOrigins.join(', ')}`);
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) {
            return callback(null, true);
          }
          
          if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
          } else {
            logger.warn(`CORS: Rejecting origin ${origin}`);
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.loadWhatsAppConnectionOwners();
    
    logger.info('✅ Enhanced WebSocket Server initialized');
  }

  /**
   * Carrega mapeamento de conexões WhatsApp -> userId
   */
  private async loadWhatsAppConnectionOwners(): Promise<void> {
    try {
      const connections = await this.prisma.whatsAppConnection.findMany({
        where: { isActive: true },
        select: { id: true, userId: true },
      });

      for (const conn of connections) {
        if (conn.userId) {
          this.whatsappConnectionOwners.set(conn.id, conn.userId);
        }
      }

      logger.info(`📱 Loaded ${this.whatsappConnectionOwners.size} WhatsApp connection owners`);
    } catch (error) {
      logger.error('Failed to load WhatsApp connection owners:', error);
    }
  }

  /**
   * Middleware de autenticação
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
          
          // Buscar informações adicionais do usuário (com cast para any temporário)
          const user = await this.prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
              departments: {
                include: { department: true },
              },
              whatsappConnections: {
                where: { isActive: true },
                take: 1,
              },
            } as any, // Type assertion temporária
          }) as any;

          if (user) {
            // Pegar o primeiro departamento do usuário (se houver)
            socket.departmentId = user.departments?.[0]?.departmentId || null;
            
            // Pegar a primeira conexão WhatsApp ativa (se houver)
            socket.connectionId = user.whatsappConnections?.[0]?.id || null;
          }
          
          logger.info(`✅ Socket authenticated: User ${socket.userId}, Dept ${socket.departmentId}, Connection ${socket.connectionId}`);
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
   * Handlers de eventos
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId || 'anonymous';
      const departmentId = socket.departmentId || null;
      const connectionId = socket.connectionId || null;
      
      logger.info(`👤 User ${userId} connected via socket ${socket.id}`);
      logger.info(`   Department: ${departmentId}, WhatsApp Connection: ${connectionId}`);

      // 🔑 ARMAZENAR NO MAPA DE CONEXÕES
      const connectionInfo: ConnectionInfo = {
        userId,
        socketId: socket.id,
        departmentId,
        connectionId,
        userRoles: socket.userRoles || [],
        connectedAt: new Date(),
      };
      this.connectionMap.set(socket.id, connectionInfo);

      // Atualizar mapa de sockets do usuário
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Atualizar mapeamento de conexão WhatsApp se necessário
      if (connectionId && userId !== 'anonymous') {
        this.whatsappConnectionOwners.set(connectionId, userId);
      }

      logger.info(`📊 Connection Map Size: ${this.connectionMap.size}`);
      logger.info(`👥 Active Users: ${this.userSockets.size}`);

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

      // 🎯 ACEITAR CONVERSA - EVENTO CRÍTICO
      socket.on(SocketEvent.ACCEPT_CONVERSATION, async (conversationId: string) => {
        try {
          logger.info(`🎯 User ${userId} accepting conversation ${conversationId}`);
          
          // Atualizar no banco
          const updated = await this.prisma.conversation.updateMany({
            where: { 
              id: conversationId,
              status: { in: ['waiting', 'transferred'] },
            },
            data: {
              status: 'in_progress',
              assignedUserId: userId,
              departmentId: departmentId,
              firstResponseAt: new Date(),
            },
          });

          if (updated.count > 0) {
            // Buscar conversa atualizada
            const conversation = await this.prisma.conversation.findUnique({
              where: { id: conversationId },
              include: {
                contact: true,
                connection: true,
                department: true,
                assignedUser: {
                  include: {
                    roles: {
                      include: { role: true },
                    },
                  },
                },
                messages: {
                  orderBy: { timestamp: 'desc' },
                  take: 1,
                },
              },
            });

            if (conversation) {
              // 🔥 BROADCAST PARA TODOS
              this.io.emit(SocketEvent.CONVERSATION_ACCEPTED, {
                conversationId,
                userId,
                departmentId,
                conversation: this.formatConversationResponse(conversation),
              });
              
              logger.info(`✅ Conversation ${conversationId} accepted and broadcasted to all clients`);
            }
          } else {
            logger.warn(`⚠️ Conversation ${conversationId} not found or already accepted`);
            socket.emit('error', { message: 'Conversa já foi aceita ou não está disponível' });
          }
        } catch (error) {
          logger.error('Error accepting conversation:', error);
          socket.emit('error', { message: 'Erro ao aceitar conversa' });
        }
      });

      // Usuário começou a digitar
      socket.on(SocketEvent.TYPING_START, (conversationId: string) => {
        socket.to(`conversation:${conversationId}`).emit(SocketEvent.TYPING_START, {
          userId,
          conversationId,
        });
      });

      // Usuário parou de digitar
      socket.on(SocketEvent.TYPING_STOP, (conversationId: string) => {
        socket.to(`conversation:${conversationId}`).emit(SocketEvent.TYPING_STOP, {
          userId,
          conversationId,
        });
      });

      // Desconexão
      socket.on('disconnect', () => {
        logger.info(`👋 User ${userId} disconnected from socket ${socket.id}`);
        
        // 🔑 REMOVER DO MAPA DE CONEXÕES
        this.connectionMap.delete(socket.id);
        
        // Remover do mapa de sockets do usuário
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }

        logger.info(`📊 Connection Map Size: ${this.connectionMap.size}`);
        logger.info(`👥 Active Users: ${this.userSockets.size}`);
      });
    });
  }

  /**
   * 🔥 MÉTODO CRÍTICO: Processa mensagem recebida do WhatsApp
   * Identifica conexão -> usuário -> setor e atribui automaticamente
   */
  public async handleIncomingMessage(
    connectionId: string,
    conversationId: string,
    message: any
  ): Promise<void> {
    try {
      logger.info(`📨 Processing incoming message for connection ${connectionId}`);
      
      // 1. Identificar dono da conexão WhatsApp
      const ownerId = this.whatsappConnectionOwners.get(connectionId);
      
      if (!ownerId) {
        logger.warn(`⚠️ No owner found for WhatsApp connection ${connectionId}`);
        // Buscar no banco e atualizar cache
        const connection = await this.prisma.whatsAppConnection.findUnique({
          where: { id: connectionId },
          select: { userId: true },
        });
        
        if (connection?.userId) {
          this.whatsappConnectionOwners.set(connectionId, connection.userId);
        }
      }

      // 2. Buscar departamento do usuário
      let departmentId: string | null = null;
      if (ownerId) {
        const user = await this.prisma.user.findUnique({
          where: { id: ownerId },
          include: {
            departments: {
              include: { department: true },
              take: 1,
            },
          } as any,
        }) as any;
        
        departmentId = user?.departments?.[0]?.departmentId || null;
        logger.info(`📂 User ${ownerId} department: ${departmentId}`);
      }

      // 3. Atualizar conversa com setor (se ainda não tiver)
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { departmentId: true, status: true },
      });

      if (conversation && !conversation.departmentId && departmentId) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { departmentId },
        });
        
        logger.info(`✅ Department ${departmentId} assigned to conversation ${conversationId}`);
      }

      // 4. Buscar conversa completa
      const fullConversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          contact: true,
          connection: true,
          department: true,
          assignedUser: {
            include: {
              roles: {
                include: { role: true },
              },
            },
          },
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      if (fullConversation) {
        // 5. BROADCAST nova mensagem para TODOS
        this.io.emit(SocketEvent.NEW_MESSAGE, {
          conversationId,
          message,
        });

        // 6. Se é nova conversa, broadcast conversa
        if (conversation?.status === 'waiting') {
          this.io.emit(SocketEvent.NEW_CONVERSATION, 
            this.formatConversationResponse(fullConversation)
          );
        }

        // 7. Sempre broadcast atualização da conversa
        this.io.emit(SocketEvent.CONVERSATION_UPDATE, {
          conversationId,
          updates: {
            lastMessageAt: new Date().toISOString(),
            lastMessage: message,
            departmentId,
          },
        });
        
        logger.info(`🔊 Message and conversation updates broadcasted to all clients`);
      }
    } catch (error) {
      logger.error('Error handling incoming message:', error);
    }
  }

  /**
   * Formata resposta de conversa
   */
  private formatConversationResponse(conversation: any): ConversationResponse {
    return {
      id: conversation.id,
      contact: {
        id: conversation.contact.id,
        phoneNumber: conversation.contact.phoneNumber,
        name: conversation.contact.name || null,
        pushName: conversation.contact.pushName || null,
        avatar: conversation.contact.avatar || null,
        email: conversation.contact.email || null,
        tags: conversation.contact.tags || [],
        isGroup: (conversation.contact as any).isGroup ?? false,
      },
      connection: {
        id: conversation.connection.id,
        name: conversation.connection.name,
        phoneNumber: conversation.connection.phoneNumber,
        status: conversation.connection.status,
        avatar: conversation.connection.avatar || null,
        lastConnected: conversation.connection.lastConnected?.toISOString() || null,
        isActive: conversation.connection.isActive,
        createdAt: conversation.connection.createdAt.toISOString(),
        updatedAt: conversation.connection.updatedAt.toISOString(),
      },
      department: conversation.department ? {
        id: conversation.department.id,
        name: conversation.department.name,
        description: conversation.department.description || null,
        color: conversation.department.color,
        icon: conversation.department.icon,
        isActive: conversation.department.isActive,
        createdAt: conversation.department.createdAt.toISOString(),
        updatedAt: conversation.department.updatedAt.toISOString(),
      } : null,
      assignedUser: conversation.assignedUser ? {
        id: conversation.assignedUser.id,
        name: conversation.assignedUser.name,
        email: conversation.assignedUser.email,
        avatar: conversation.assignedUser.avatar || null,
        isActive: conversation.assignedUser.isActive,
        roles: conversation.assignedUser.roles?.map((ur: any) => ur.role.name) || [],
        createdAt: conversation.assignedUser.createdAt.toISOString(),
        updatedAt: conversation.assignedUser.updatedAt.toISOString(),
      } as any : null,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      firstResponseAt: conversation.firstResponseAt?.toISOString() || null,
      resolvedAt: conversation.resolvedAt?.toISOString() || null,
      unreadCount: conversation.unreadCount,
      lastMessage: conversation.messages[0] || null,
      internalNotes: conversation.internalNotes || null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  /**
   * Obtém informações de conexão por socket ID
   */
  public getConnectionInfo(socketId: string): ConnectionInfo | undefined {
    return this.connectionMap.get(socketId);
  }

  /**
   * Obtém todos os sockets de um usuário
   */
  public getUserSockets(userId: string): Set<string> | undefined {
    return this.userSockets.get(userId);
  }

  /**
   * Emite evento para usuário específico
   */
  public emitToUser(userId: string, event: string, data: any): void {
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
      logger.debug(`Emitted ${event} to user ${userId} (${socketIds.size} sockets)`);
    }
  }

  /**
   * Broadcast para todos
   */
  public broadcast(event: string, data: any): void {
    this.io.emit(event, data);
    logger.debug(`Broadcasted ${event} to all clients`);
  }

  /**
   * Emite QR Code do WhatsApp
   */
  public emitWhatsAppQRCode(connectionId: string, qrCode: string): void {
    this.io.emit(SocketEvent.WHATSAPP_QR_CODE, {
      connectionId,
      qrCode,
      timestamp: new Date(),
    });
  }

  /**
   * Emite status de conexão WhatsApp
   */
  public emitWhatsAppStatus(connectionId: string, status: 'connecting' | 'connected' | 'disconnected'): void {
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
      default:
        return;
    }

    this.io.emit(event, {
      connectionId,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * Emite falha de conexão WhatsApp
   */
  public emitWhatsAppConnectionFailed(connectionId: string, error: string): void {
    this.io.emit(SocketEvent.WHATSAPP_CONNECTION_FAILED, {
      connectionId,
      error,
      timestamp: new Date(),
    });
  }

  /**
   * Obtém instância do servidor Socket.io
   */
  public getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Debug: Imprime estado atual dos mapas
   */
  public debugState(): void {
    logger.info('=== WEBSOCKET DEBUG STATE ===');
    logger.info(`Connection Map (${this.connectionMap.size} connections):`);
    this.connectionMap.forEach((info, socketId) => {
      logger.info(`  ${socketId}: User=${info.userId}, Dept=${info.departmentId}, Connection=${info.connectionId}`);
    });
    logger.info(`User Sockets (${this.userSockets.size} users):`);
    this.userSockets.forEach((sockets, userId) => {
      logger.info(`  ${userId}: ${sockets.size} sockets`);
    });
    logger.info(`WhatsApp Connection Owners (${this.whatsappConnectionOwners.size} connections):`);
    this.whatsappConnectionOwners.forEach((userId, connId) => {
      logger.info(`  ${connId}: ${userId}`);
    });
    logger.info('=============================');
  }
}

// Singleton
let socketServer: EnhancedSocketServer | null = null;

export function initializeEnhancedSocketServer(httpServer: HTTPServer): EnhancedSocketServer {
  if (!socketServer) {
    socketServer = new EnhancedSocketServer(httpServer);
  }
  return socketServer;
}

export function getEnhancedSocketServer(): EnhancedSocketServer {
  if (!socketServer) {
    throw new Error('Enhanced Socket server not initialized');
  }
  return socketServer;
}
