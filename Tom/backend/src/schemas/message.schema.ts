import { z } from 'zod';

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000, 'Message too long'),
  messageType: z.enum(['text', 'image', 'audio', 'video', 'document']).optional().default('text'),
  mediaUrl: z.string().url().optional(),
  quotedMessageId: z.string().uuid().optional(),
});

export const GetMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
});

export const UpdateMessageStatusSchema = z.object({
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type GetMessagesInput = z.infer<typeof GetMessagesSchema>;
export type UpdateMessageStatusInput = z.infer<typeof UpdateMessageStatusSchema>;
