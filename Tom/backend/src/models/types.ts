// ==================== TIPOS DE AUTENTICAÇÃO ====================

export interface JWTPayload {
  userId: string;
  email: string;
  roles: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenPayload {
  userId: string;
  fingerprint?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ==================== TIPOS DE USUÁRIO ====================

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  status: string;
  isActive: boolean;
  roles: RoleResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface PermissionResponse {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
}

// ==================== TIPOS DE CONEXÃO WHATSAPP ====================

export interface WhatsAppConnectionResponse {
  id: string;
  name: string;
  phoneNumber: string;
  status: ConnectionStatus;
  avatar: string | null;
  lastConnected: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FAILED = 'failed',
}

export interface CreateConnectionRequest {
  name: string;
}

export interface QRCodeResponse {
  connectionId: string;
  qrCode: string;
  expiresAt: Date;
}

// ==================== TIPOS DE CONVERSA ====================

export interface ConversationResponse {
  id: string;
  contact: ContactResponse;
  connection: WhatsAppConnectionResponse;
  department: DepartmentResponse | null;
  assignedUser: UserResponse | null;
  status: ConversationStatus;
  lastMessageAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  unreadCount: number;
  lastMessage: MessageResponse | null;
  internalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum ConversationStatus {
  WAITING = 'waiting',
  TRANSFERRED = 'transferred',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export interface ContactResponse {
  id: string;
  phoneNumber: string;
  name: string | null;
  pushName?: string | null;
  avatar: string | null;
  email: string | null;
  tags: string[];
}

export interface AcceptConversationRequest {
  conversationId: string;
  departmentId?: string;
}

export interface TransferConversationRequest {
  conversationId: string;
  toUserId?: string;
  toDepartmentId?: string;
  reason?: string;
}

export interface UpdateConversationStatusRequest {
  conversationId: string;
  status: ConversationStatus;
}

// ==================== TIPOS DE MENSAGEM ====================

export interface MessageResponse {
  id: string;
  conversationId: string;
  sender: UserResponse | null;
  content: string;
  messageType: MessageType;
  mediaUrl: string | null;
  status: MessageStatus;
  isFromContact: boolean;
  timestamp: Date;
  createdAt: Date;
  quotedMessageId: string | null;
  quotedMessage: QuotedMessageResponse | null;
}

export interface QuotedMessageResponse {
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

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  LOCATION = 'location',
}

export enum MessageStatus {
  SENDING = 'sending', // ✅ Mensagem sendo enviada (aparece imediatamente no frontend)
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  messageType?: MessageType;
  mediaUrl?: string;
  quotedMessageId?: string;
}

// ==================== TIPOS DE DEPARTAMENTO ====================

export interface DepartmentResponse {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  isActive: boolean;
  isPrimary?: boolean;
  conversationCount?: number;
  _count?: {
    users: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isPrimary?: boolean;
}

export interface UpdateDepartmentRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

// ==================== TIPOS DE NOTIFICAÇÃO ====================

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  data: any;
  isRead: boolean;
  createdAt: Date;
}

export enum NotificationType {
  NEW_MESSAGE = 'new_message',
  TRANSFER = 'transfer',
  MENTION = 'mention',
  SYSTEM = 'system',
}

export interface NotificationPreferenceResponse {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  newMessageSound: boolean;
  transferSound: boolean;
  mentionSound: boolean;
  silentHoursStart: string | null;
  silentHoursEnd: string | null;
  notifyOnlyDepartments: string[];
}

export interface UpdateNotificationPreferenceRequest {
  soundEnabled?: boolean;
  desktopEnabled?: boolean;
  newMessageSound?: boolean;
  transferSound?: boolean;
  mentionSound?: boolean;
  silentHoursStart?: string;
  silentHoursEnd?: string;
  notifyOnlyDepartments?: string[];
}

// ==================== TIPOS DE MÉTRICAS ====================

export interface DashboardMetrics {
  totalConversations: number;
  conversationsInProgress: number;
  conversationsWaiting: number;
  averageFirstResponseTime: number; // em segundos
  averageResolutionTime: number; // em segundos
  satisfactionRate: number; // 0-5
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

export interface MetricsFilter {
  startDate?: Date;
  endDate?: Date;
  connectionId?: string;
  departmentId?: string;
  userId?: string;
}

// ==================== TIPOS DE WEBSOCKET ====================

export interface SocketUser {
  userId: string;
  socketId: string;
  connectionIds: string[]; // IDs das conexões WhatsApp que o usuário tem acesso
}

export enum SocketEvent {
  // Client -> Server
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  MESSAGE_READ = 'message_read',

  // Server -> Client
  NEW_MESSAGE = 'new_message',
  MESSAGE_STATUS_UPDATE = 'message_status_update',
  CONVERSATION_UPDATE = 'conversation_update',
  CONVERSATION_ASSIGNED = 'conversation_assigned',
  CONVERSATION_TRANSFERRED = 'conversation_transferred',
  USER_TYPING = 'user_typing',
  CONNECTION_STATUS_CHANGE = 'connection_status_change',
  NOTIFICATION = 'notification',
  
  // WhatsApp Connection Events
  WHATSAPP_QR_CODE = 'whatsapp_qr_code',
  WHATSAPP_CONNECTED = 'whatsapp_connected',
  WHATSAPP_DISCONNECTED = 'whatsapp_disconnected',
  WHATSAPP_CONNECTING = 'whatsapp_connecting',
  WHATSAPP_CONNECTION_FAILED = 'whatsapp_connection_failed',
}

export interface SocketMessage {
  event: SocketEvent;
  data: any;
  timestamp: Date;
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

// ==================== TIPOS DE ERRO ====================

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: ValidationError[];
  stack?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ==================== TIPOS DE TEMPLATE ====================

export interface MessageTemplateResponse {
  id: string;
  departmentId: string | null;
  name: string;
  content: string;
  shortcut: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMessageTemplateRequest {
  departmentId?: string;
  name: string;
  content: string;
  shortcut?: string;
}

export interface UpdateMessageTemplateRequest {
  name?: string;
  content?: string;
  shortcut?: string;
  isActive?: boolean;
}
