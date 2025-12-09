// ==================== TIPOS DE AUTENTICAÇÃO ====================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  status: 'online' | 'offline' | 'away';
  isActive: boolean;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

// ==================== TIPOS DE CONEXÃO WHATSAPP ====================

export interface WhatsAppConnection {
  id: string;
  name: string;
  phoneNumber: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  avatar: string | null;
  lastConnected: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QRCodeData {
  connectionId: string;
  qrCode: string;
  expiresAt: string;
}

// ==================== TIPOS DE CONVERSA ====================

export interface Conversation {
  id: string;
  contact: Contact;
  connection: WhatsAppConnection;
  department: Department | null;
  assignedUser: User | null;
  status: 'waiting' | 'transferred' | 'in_progress' | 'resolved' | 'closed';
  lastMessageAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  unreadCount: number;
  lastMessage: Message | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  phoneNumber: string;
  name: string | null;
  pushName?: string | null;
  avatar: string | null;
  email: string | null;
  tags: string[];
}

// ==================== TIPOS DE MENSAGEM ====================

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  sender: User | null;
  content: string;
  messageType: MessageType;
  mediaUrl: string | null;
  status: MessageStatus;
  isFromContact: boolean;
  senderName: string | null; // Nome do remetente (usado em grupos)
  senderPhone?: string | null; // Número de telefone do remetente (usado em grupos)
  timestamp: string;
  createdAt: string;
  quotedMessageId: string | null;
  quotedMessage: QuotedMessage | null;
}

export interface QuotedMessage {
  id: string | null;
  content: string;
  messageType: MessageType;
  mediaUrl: string | null;
  isFromContact: boolean;
  senderName: string | null;
  senderAvatar: string | null;
  senderId: string | null;
  timestamp: string | null;
  status: MessageStatus | null;
}

export interface SendMessageData {
  conversationId: string;
  content: string;
  messageType?: MessageType;
  mediaUrl?: string;
  quotedMessageId?: string;
}

// ==================== TIPOS DE DEPARTAMENTO ====================

export interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  isActive: boolean;
  conversationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

// ==================== TIPOS DE NOTIFICAÇÃO ====================

export interface Notification {
  id: string;
  type: 'new_message' | 'transfer' | 'mention' | 'system';
  title: string;
  content: string;
  data: any;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreference {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  newMessageSound: boolean;
  transferSound: boolean;
  mentionSound: boolean;
  silentHoursStart: string | null;
  silentHoursEnd: string | null;
  notifyOnlyDepartments: string[];
}

// ==================== TIPOS DE MÉTRICAS ====================

export interface DashboardMetrics {
  totalConversations: number;
  conversationsInProgress: number;
  conversationsWaiting: number;
  averageFirstResponseTime: number;
  averageResolutionTime: number;
  satisfactionRate: number;
  conversationsByDepartment: DepartmentMetric[];
  conversationsByHour: HourlyMetric[];
  topPerformers: AgentPerformance[];
}

export interface DepartmentMetric {
  departmentId: string;
  departmentName: string;
  count: number;
  percentage: number;
}

export interface HourlyMetric {
  hour: number;
  count: number;
}

export interface AgentPerformance {
  userId: string;
  userName: string;
  avatar: string | null;
  status: string;
  activeConversations: number;
  resolvedToday: number;
  averageResponseTime: number;
}

// ==================== TIPOS DE PAGINAÇÃO ====================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ==================== TIPOS DE WEBSOCKET ====================

export enum SocketEvent {
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  MESSAGE_READ = 'message_read',
  NEW_MESSAGE = 'new_message',
  MESSAGE_STATUS_UPDATE = 'message_status_update',
  CONVERSATION_UPDATE = 'conversation_update',
  CONVERSATION_ASSIGNED = 'conversation_assigned',
  CONVERSATION_TRANSFERRED = 'conversation_transferred',
  USER_TYPING = 'user_typing',
  CONNECTION_STATUS_CHANGE = 'connection_status_change',
  NOTIFICATION = 'notification',
}

// ==================== TIPOS DE TEMPLATE ====================

export interface MessageTemplate {
  id: string;
  departmentId: string | null;
  name: string;
  content: string;
  shortcut: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==================== TIPOS DE API RESPONSE ====================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: PaginatedResponse<any>['pagination'];
}

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
