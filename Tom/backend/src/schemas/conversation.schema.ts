import { z } from 'zod';

export const GetConversationsSchema = z.object({
  status: z.enum(['waiting', 'in_progress', 'resolved']).optional(),
  assignedUserId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
  search: z.string().max(100).optional(),
});

export const UpdateConversationStatusSchema = z.object({
  status: z.enum(['waiting', 'in_progress', 'resolved']),
});

export const AssignConversationSchema = z.object({
  userId: z.string().uuid(),
});

export const SearchConversationsSchema = z.object({
  query: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\s@._-]+$/, 'Invalid characters in search'),
});

export type GetConversationsInput = z.infer<typeof GetConversationsSchema>;
export type UpdateConversationStatusInput = z.infer<typeof UpdateConversationStatusSchema>;
export type AssignConversationInput = z.infer<typeof AssignConversationSchema>;
export type SearchConversationsInput = z.infer<typeof SearchConversationsSchema>;
