/**
 * Servidor WebSocket Unificado
 * Combina funcionalidades do servidor padrão com o aprimorado
 * Evita conflito de portas usando uma única instância
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { getPrismaClient } from '../config/database.js';
import { ConversationResponse, MessageResponse, UserResponse, DepartmentResponse } from '../models/types.js';

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
  departmentId?: string;
  connectionId?: string;
}

interface ConnectionInfo {
  userId: string;
  socketId: string;
  departmentId: string | null;
  connectionId: string | null;
  userRoles: string[];
  connectedAt: Date;
}

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

export class UnifiedSocketServer {
  private io: SocketIOServer;
  private prisma = getPrismaClient();
  
  // 🔑 Mapas de conexões
  private connectionMap: Map<string, ConnectionInfo> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();
  private whatsappConnectionOwners: Map<string, string> = new Map();
  private connectedUsers: Map<string, Set<string>> = new Map();

  constructor(httpServer: HTTPServer) {
    const allowedOrigins = config.security.corsOrigin;
    
    logger.info(`🔌 Initializing Unified WebSocket Server`);
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
    
    logger.info('✅ Unified WebSocket Server initialized');
  }

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
          
          // Buscar informações adicionais
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
            } as any,
          }) as any;

          if (user) {
            socket.departmentId = user.departments?.[0]?.departmentId || null;
            socket.connectionId = user.whatsappConnections?.[0]?.id || null;
          }
          
          logger.info(`✅ Socket authenticated: User ${socket.userId}, Dept ${socket.departmentId}`);
        } catch (error) {
          logger.warn('Invalid token, allowing connection for public events');
        }

        next();
      } catch (error) {
        logger.error('Socket middleware error:', error);
        next(error as Error);
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId || 'anonymous';
      const departmentId = socket.departmentId || null;
      const connectionId = socket.connectionId || null;
      
      logger.info(`👤 User ${userId} connected via socket ${socket.id}`);

      // Armazenar conexão
      const connectionInfo: ConnectionInfo = {
        userId,
        socketId: socket.id,
        departmentId,
        connectionId,
        userRoles: socket.userRoles || [],
        connectedAt: new Date(),
      };
      this.connectionMap.set(socket.id, connectionInfo);

      // Atualizar mapas
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      if (connectionId && userId !== 'anonymous') {
        this.whatsappConnectionOwners.set(connectionId, userId);
      }

      logger.info(`📊 Active connections: ${this.connectionMap.size}`);

      // Entrar em sala
      socket.on(SocketEvent.JOIN_ROOM, (conversationId: string) => {
        socket.join(`conversation:${conversationId}`);
        logger.debug(`User ${userId} joined conversation ${conversationId}`);
      });

      // Sair de sala
      socket.on(SocketEvent.LEAVE_ROOM, (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`);
        logger.debug(`User ${userId} left conversation ${conversationId}`);
      });

      // 🎯 ACEITAR CONVERSA
      socket.on(SocketEvent.ACCEPT_CONVERSATION, async (conversationId: string) => {
        try {
          logger.info(`🎯 User ${userId} accepting conversation ${conversationId}`);
          
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
              // BROADCAST para todos
              this.io.emit(SocketEvent.CONVERSATION_ACCEPTED, {
                conversationId,
                userId,
                departmentId,
                conversation: this.formatConversationResponse(conversation),
              });
              
              logger.info(`✅ Conversation ${conversationId} accepted and broadcasted`);
            }
          } else {
            logger.warn(`⚠️ Conversation ${conversationId} not available`);
            socket.emit('error', { message: 'Conversa não disponível' });
          }
        } catch (error) {
          logger.error('Error accepting conversation:', error);
          socket.emit('error', { message: 'Erro ao aceitar conversa' });
        }
      });

      // Digitação
      socket.on(SocketEvent.TYPING_START, (conversationId: string) => {
        socket.to(`conversation:${conversationId}`).emit(SocketEvent.TYPING_START, {
          userId,
          conversationId,
        });
      });

      socket.on(SocketEvent.TYPING_STOP, (conversationId: string) => {
        socket.to(`conversation:${conversationId}`).emit(SocketEvent.TYPING_STOP, {
          userId,
          conversationId,
        });
      });

      // Desconexão
      socket.on('disconnect', () => {
        logger.info(`👋 User ${userId} disconnected from socket ${socket.id}`);
        
        this.connectionMap.delete(socket.id);
        
        const userSocketSet = this.connectedUsers.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          if (userSocketSet.size === 0) {
            this.connectedUsers.delete(userId);
          }
        }

        const userSocketSet2 = this.userSockets.get(userId);
        if (userSocketSet2) {
          userSocketSet2.delete(socket.id);
          if (userSocketSet2.size === 0) {
            this.userSockets.delete(userId);
          }
        }

        logger.info(`📊 Active connections: ${this.connectionMap.size}`);
      });
    });
  }

  /**
   * 🔥 Processa mensagem recebida do WhatsApp com atribuição automática de setor
   */
  public async handleIncomingMessage(
    connectionId: string,
    conversationId: string,
    message: any
  ): Promise<void> {
    try {
      logger.info(`📨 Processing incoming message for connection ${connectionId}`);
      
      // Identificar dono da conexão
      const ownerId = this.whatsappConnectionOwners.get(connectionId);
      
      if (!ownerId) {
        const connection = await this.prisma.whatsAppConnection.findUnique({
          where: { id: connectionId },
          select: { userId: true },
        });
        
        if (connection?.userId) {
          this.whatsappConnectionOwners.set(connectionId, connection.userId);
        }
      }

      // Buscar departamento do usuário
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
        logger.info(`📂 Department for connection: ${departmentId}`);
      }

      // Atualizar conversa com setor se não tiver
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { departmentId: true, status: true },
      });

      if (conversation && !conversation.departmentId && departmentId) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { departmentId },
        });
        
        logger.info(`✅ Department ${departmentId} auto-assigned to conversation ${conversationId}`);
      }

      // Buscar conversa completa
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
        // BROADCAST mensagem
        this.io.emit(SocketEvent.NEW_MESSAGE, {
          conversationId,
          message,
        });

        // Se é nova conversa, broadcast
        if (conversation?.status === 'waiting') {
          this.io.emit(SocketEvent.NEW_CONVERSATION, 
            this.formatConversationResponse(fullConversation)
          );
        }

        // Sempre broadcast atualização
        this.io.emit(SocketEvent.CONVERSATION_UPDATE, {
          conversationId,
          updates: {
            lastMessageAt: new Date().toISOString(),
            lastMessage: message,
            departmentId,
          },
        });
        
        logger.info(`🔊 Message broadcasted with auto-assigned department`);
      }
    } catch (error) {
      logger.error('Error handling incoming message:', error);
    }
  }

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

  // Métodos compatíveis com servidor antigo
  public emitNewMessage(conversationId: string, message: MessageResponse): void {
    this.io.emit(SocketEvent.NEW_MESSAGE, {
      conversationId,
      message,
    });
  }

  public emitNewConversation(conversation: ConversationResponse): void {
    this.io.emit(SocketEvent.NEW_CONVERSATION, conversation);
  }

  public emitConversationUpdate(conversationId: string, updates: any): void {
    this.io.emit(SocketEvent.CONVERSATION_UPDATE, {
      conversationId,
      updates,
    });
  }

  public emitConversationAssigned(userId: string, conversation: ConversationResponse): void {
    this.io.emit(SocketEvent.CONVERSATION_ASSIGNED, {
      conversationId: conversation.id,
      userId,
      conversation,
    });
  }

  public emitWhatsAppQRCode(connectionId: string, qrCode: string): void {
    this.io.emit(SocketEvent.WHATSAPP_QR_CODE, {
      connectionId,
      qrCode,
      timestamp: new Date(),
    });
  }

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

  public emitWhatsAppConnectionFailed(connectionId: string, error: string): void {
    this.io.emit(SocketEvent.WHATSAPP_CONNECTION_FAILED, {
      connectionId,
      error,
      timestamp: new Date(),
    });
  }

  public emitToUser(userId: string, event: string, data: any): void {
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  public emitToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, data);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public debugState(): void {
    logger.info('=== UNIFIED SOCKET DEBUG ===');
    logger.info(`Connections: ${this.connectionMap.size}`);
    logger.info(`Active Users: ${this.userSockets.size}`);
    logger.info(`WhatsApp Owners: ${this.whatsappConnectionOwners.size}`);
  }
}

// Singleton
let socketServer: UnifiedSocketServer | null = null;

export function initializeSocketServer(httpServer: HTTPServer): UnifiedSocketServer {
  if (!socketServer) {
    socketServer = new UnifiedSocketServer(httpServer);
  }
  return socketServer;
}

export function getSocketServer(): UnifiedSocketServer {
  if (!socketServer) {
    throw new Error('Socket server not initialized');
  }
  return socketServer;
}
