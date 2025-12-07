import { FastifyRequest, FastifyReply } from 'fastify';
import { ConversationService } from '../services/conversation.service.js';
import { MessageService } from '../services/message.service.js';
import { validate } from '../utils/validators.js';
import {
  conversationFilterSchema,
  acceptConversationSchema,
  transferConversationSchema,
  updateConversationStatusSchema,
  updateConversationNotesSchema,
  sendMessageSchema,
  paginationSchema,
} from '../utils/validators.js';
import { getSocketServer } from '../websocket/socket.server.js';
import { ConversationStatus, MessageType } from '../models/types.js';
import { logger } from '../config/logger.js';

export class ConversationController {
  private conversationService = new ConversationService();
  private messageService = new MessageService();

  /**
   * GET /api/v1/conversations
   * Lista conversas com filtros
   */
  listConversations = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = validate(conversationFilterSchema, request.query);
      const userId = request.user!.userId;
      const userRoles = request.user!.roles;
      logger.info(`DEBUG: Controller listConversations called userId=${userId} roles=${JSON.stringify(userRoles)}`);
      /* Reverting mock */

      try {
        const conversations = await this.conversationService.listConversations(userId, userRoles, {
          ...params,
          status: params.status as ConversationStatus | undefined,
        });

        return reply.status(200).send({
          success: true,
          data: conversations.data,
          pagination: conversations.pagination,
        });
      } catch (error: any) {
        // Return error details for debugging
        return reply.status(500).send({
          message: error.message,
          stack: error.stack
        });
      }
    } catch (error: any) {
      logger.error('[ConversationController] Error in listConversations:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error listing conversations',
      });
    }
  };

  /**
   * GET /api/v1/conversations/:conversationId
   * Busca conversa por ID
   */
  getConversationById = async (
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply
  ) => {
    const { conversationId } = request.params;
    const userId = request.user!.userId;
    const userRoles = request.user!.roles;

    const conversation = await this.conversationService.getConversationById(
      conversationId,
      userId,
      userRoles
    );

    return reply.status(200).send({
      success: true,
      data: conversation,
    });
  };

  /**
   * POST /api/v1/conversations/:conversationId/accept
   * Aceita conversa da fila
   */
  acceptConversation = async (
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply
  ) => {
    const { conversationId } = request.params;
    const { departmentId } = validate(acceptConversationSchema, request.body ?? {});
    const userId = request.user!.userId;

    const conversation = await this.conversationService.acceptConversation(
      conversationId,
      userId,
      departmentId
    );

    // Emitir evento via WebSocket
    const socketServer = getSocketServer();
    socketServer.emitConversationAssigned(userId, conversation);
    socketServer.emitConversationUpdate(conversationId, { status: 'in_progress', assignedUserId: userId });

    return reply.status(200).send({
      success: true,
      message: 'Conversation accepted successfully',
      data: conversation,
    });
  };

  /**
   * POST /api/v1/conversations/:conversationId/transfer
   * Transfere conversa para usuário específico
   */
  transferConversation = async (
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply
  ) => {
    const { conversationId } = request.params;
    console.log('🔄 [transferConversation] Request body:', JSON.stringify(request.body));
    const { toUserId, reason } = validate(
      transferConversationSchema,
      request.body
    );
    const userId = request.user!.userId;
    console.log('✅ [transferConversation] Validated:', { toUserId, reason });

    await this.conversationService.transferConversation(
      conversationId,
      userId,
      toUserId,
      reason
    );

    // Emitir evento via WebSocket
    const socketServer = getSocketServer();
    socketServer.emitConversationTransferred(conversationId, userId, toUserId);

    return reply.status(200).send({
      success: true,
      message: 'Conversation transferred successfully',
    });
  };

  /**
   * PATCH /api/v1/conversations/:conversationId/status
   * Atualiza status da conversa
   */
  updateStatus = async (
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply
  ) => {
    const { conversationId } = request.params;
    const { status } = validate(updateConversationStatusSchema, request.body);
    const userId = request.user!.userId;

    const conversation = await this.conversationService.updateConversationStatus(
      conversationId,
      status as ConversationStatus,
      userId
    );

    // Emitir evento via WebSocket
    const socketServer = getSocketServer();
    socketServer.emitConversationUpdate(conversationId, { status });

    return reply.status(200).send({
      success: true,
      message: 'Conversation status updated successfully',
      data: conversation,
    });
  };

  /**
   * PATCH /api/v1/conversations/:conversationId/notes
   * Atualiza notas internas
   */
  updateNotes = async (
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply
  ) => {
    const { conversationId } = request.params;
    const { internalNotes } = validate(updateConversationNotesSchema, request.body);
    const userId = request.user!.userId;

    await this.conversationService.updateInternalNotes(conversationId, internalNotes, userId);

    return reply.status(200).send({
      success: true,
      message: 'Internal notes updated successfully',
    });
  };

  /**
   * POST /api/v1/conversations/:conversationId/read
   * Marca conversa como lida
   */
  markAsRead = async (
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply
  ) => {
    const { conversationId } = request.params;

    await this.conversationService.markAsRead(conversationId);

    return reply.status(200).send({
      success: true,
      message: 'Conversation marked as read',
    });
  };

  /**
   * GET /api/v1/conversations/:conversationId/messages
   * Lista mensagens da conversa
   */
  listMessages = async (
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply
  ) => {
    const { conversationId } = request.params;
    const params = validate(paginationSchema, request.query);
    const userId = request.user!.userId;
    const userRoles = request.user!.roles;

    const messages = await this.messageService.listMessages(conversationId, userId, userRoles, params);

    return reply.status(200).send({
      success: true,
      data: messages.data,
      pagination: messages.pagination,
    });
  };

  /**
   * POST /api/v1/conversations/:conversationId/messages
   * Envia mensagem
   */
  sendMessage = async (
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { conversationId } = request.params;
      const body = request.body as any;
      logger.info('[sendMessage] Raw request body:', {
        body: request.body,
        conversationId,
        hasMediaUrl: !!body?.mediaUrl,
        mediaUrl: body?.mediaUrl,
        messageType: body?.messageType,
        content: body?.content,
      });

      let data;
      try {
        // Passar o body diretamente - o schema vai lidar com undefined/null
        logger.info('[sendMessage] Request body before validation:', JSON.stringify(request.body));

        data = validate(sendMessageSchema, request.body);

        logger.info('[sendMessage] ✅ Validation successful:', {
          conversationId,
          userId: request.user!.userId,
          content: data.content?.substring(0, 50) + (data.content && data.content.length > 50 ? '...' : ''),
          contentLength: data.content?.length || 0,
          messageType: data.messageType,
          hasMediaUrl: !!data.mediaUrl,
          mediaUrl: data.mediaUrl?.substring(0, 100) || 'none',
          hasQuotedMessage: !!data.quotedMessageId,
        });
      } catch (validationError: any) {
        // Importar ZodError para verificar tipo
        const { ZodError } = await import('zod');

        const errorDetails = {
          errorMessage: validationError?.message || 'Unknown validation error',
          errorName: validationError?.name,
          rawBody: request.body,
          bodyType: typeof request.body,
          bodyKeys: request.body ? Object.keys(request.body) : [],
          conversationId,
        };

        logger.error('[sendMessage] ❌ Validation failed:', errorDetails);

        // Se for ZodError, extrair detalhes específicos
        if (validationError instanceof ZodError || (validationError?.issues && Array.isArray(validationError.issues))) {
          const zodErrors = (validationError.issues || []).map((err: any) => ({
            field: err.path?.join('.') || 'unknown',
            message: err.message || 'Validation error',
            code: err.code || 'custom_error',
          }));

          logger.error('[sendMessage] ❌ Zod validation errors:', zodErrors);
          logger.error('[sendMessage] ❌ Full Zod error:', JSON.stringify(validationError, null, 2));

          return reply.status(400).send({
            success: false,
            statusCode: 400,
            message: 'Validation failed',
            errors: zodErrors,
            receivedBody: request.body,
          });
        }

        // Retornar erro genérico de validação
        return reply.status(400).send({
          success: false,
          statusCode: 400,
          message: validationError?.message || 'Validation failed',
          error: errorDetails.errorMessage,
          receivedBody: request.body,
        });
      }

      const userId = request.user!.userId;
      const userRoles = request.user!.roles;

      const message = await this.messageService.sendMessage({
        ...data,
        conversationId,
        content: data.content || '', // Garantir que content seja sempre string
        messageType: (data.messageType || 'text') as MessageType,
        mediaUrl: data.mediaUrl || undefined,
        quotedMessageId: data.quotedMessageId || undefined,
      }, userId, userRoles);

      // WebSocket event já foi emitido no service

      return reply.status(201).send({
        success: true,
        message: 'Message sent successfully',
        data: message,
      });
    } catch (error) {
      console.error('[sendMessage] Error:', error);
      console.error('[sendMessage] Error stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  };
}
