import { z } from 'zod';

// ==================== VALIDADORES DE AUTENTICAÇÃO ====================

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      'Password must contain at least one special character'
    ),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ==================== VALIDADORES DE CONEXÃO ====================

export const createConnectionSchema = z.object({
  name: z.string().min(3, 'Connection name must be at least 3 characters'),
  phoneNumber: z.string().regex(/^\d+$/, 'Phone number must contain only digits').min(10, 'Phone number must be at least 10 digits'),
  departmentIds: z.array(z.string().uuid()).optional(),
  isMatriz: z.boolean().optional(),
});

export const updateConnectionSchema = z.object({
  name: z.string().min(3).optional(),
  isActive: z.boolean().optional(),
  isMatriz: z.boolean().optional(),
  departmentIds: z.array(z.string().uuid()).optional(),
});

// ==================== VALIDADORES DE CONVERSA ====================

export const acceptConversationSchema = z.object({
  departmentId: z.string().uuid('Invalid department ID').optional(),
});

export const transferConversationSchema = z.object({
  toUserId: z.string().optional(),
  toDepartmentId: z.string().min(1, 'Department ID is required').optional(),
  toConnectionId: z.string().optional(),
  reason: z.string().max(200, 'Reason must be at most 200 characters').optional(),
}).refine(
  (data) => data.toUserId || data.toDepartmentId || data.toConnectionId,
  'Either toUserId, toDepartmentId or toConnectionId must be provided'
);

export const updateConversationStatusSchema = z.object({
  status: z.enum(['waiting', 'transferred', 'in_progress', 'resolved', 'closed']),
});

export const updateConversationNotesSchema = z.object({
  internalNotes: z.string().max(1000, 'Notes must be at most 1000 characters'),
});

// ==================== VALIDADORES DE MENSAGEM ====================

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(4096),
  messageType: z
    .enum(['text', 'image', 'video', 'audio', 'document', 'location'])
    .default('text'),
  mediaUrl: z.string().url('Invalid media URL').optional(),
});

// ==================== VALIDADORES DE DEPARTAMENTO ====================

export const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters'),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color format')
    .default('#3B82F6'),
  icon: z.string().default('folder'),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color format').optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ==================== VALIDADORES DE USUÁRIO ====================

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
  status: z.enum(['online', 'offline', 'away']).optional(),
});

export const assignUserRoleSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
});

export const assignUserDepartmentSchema = z.object({
  departmentId: z.string().uuid('Invalid department ID'),
});

export const assignUserConnectionSchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID'),
});

// ==================== VALIDADORES DE TEMPLATE ====================

export const createMessageTemplateSchema = z.object({
  departmentId: z.string().uuid('Invalid department ID').optional(),
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  content: z.string().min(1, 'Template content is required'),
  shortcut: z.string().regex(/^\/\w+$/, 'Shortcut must start with /').optional(),
});

export const updateMessageTemplateSchema = z.object({
  name: z.string().min(2).optional(),
  content: z.string().min(1).optional(),
  shortcut: z.string().regex(/^\/\w+$/).optional(),
  isActive: z.boolean().optional(),
});

// ==================== VALIDADORES DE NOTIFICAÇÃO ====================

export const updateNotificationPreferenceSchema = z.object({
  soundEnabled: z.boolean().optional(),
  desktopEnabled: z.boolean().optional(),
  newMessageSound: z.boolean().optional(),
  transferSound: z.boolean().optional(),
  mentionSound: z.boolean().optional(),
  silentHoursStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)')
    .optional(),
  silentHoursEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)')
    .optional(),
  notifyOnlyDepartments: z.array(z.string().uuid()).optional(),
});

// ==================== VALIDADORES DE PAGINAÇÃO ====================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ==================== VALIDADORES DE FILTROS ====================

export const conversationFilterSchema = paginationSchema.extend({
  status: z.enum(['waiting', 'transferred', 'in_progress', 'resolved', 'closed']).optional(),
  departmentId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  connectionId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const metricsFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  connectionId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

// ==================== HELPER PARA VALIDAÇÃO ====================

export const validate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw {
        statusCode: 400,
        message: 'Validation failed',
        errors: formattedErrors,
      };
    }
    throw error;
  }
};
