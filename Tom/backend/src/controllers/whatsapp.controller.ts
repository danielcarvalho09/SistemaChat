import { FastifyRequest, FastifyReply } from 'fastify';
import { WhatsAppService } from '../services/whatsapp.service.js';

/**
 * Controller de conexões WhatsApp
 */
export class WhatsAppController {
  private whatsappService = new WhatsAppService();

  /**
   * POST /api/v1/connections
   * Cria nova conexão WhatsApp
   */
  createConnection = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = request.body as any;
    const connection = await this.whatsappService.createConnection(data);

    return reply.status(201).send({
      success: true,
      message: 'Connection created successfully',
      data: connection,
    });
  };

  /**
   * GET /api/v1/connections
   * Lista todas as conexões
   */
  listConnections = async (request: FastifyRequest, reply: FastifyReply) => {
    const connections = await this.whatsappService.listConnections();

    return reply.status(200).send({
      success: true,
      data: connections,
    });
  };

  /**
   * GET /api/v1/connections/:connectionId
   * Busca conexão por ID
   */
  getConnectionById = async (
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ) => {
    const { connectionId } = request.params;
    const connection = await this.whatsappService.getConnectionById(connectionId);

    return reply.status(200).send({
      success: true,
      data: connection,
    });
  };

  /**
   * PATCH /api/v1/connections/:connectionId
   * Atualiza conexão
   */
  updateConnection = async (
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ) => {
    const { connectionId } = request.params;
    const data = request.body as any;
    const connection = await this.whatsappService.updateConnection(connectionId, data);

    return reply.status(200).send({
      success: true,
      message: 'Connection updated successfully',
      data: connection,
    });
  };

  /**
   * POST /api/v1/connections/:connectionId/connect
   * Conecta uma conexão e gera QR Code
   */
  connectConnection = async (
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ) => {
    const { connectionId } = request.params;
    const result = await this.whatsappService.connectConnection(connectionId);

    return reply.status(200).send({
      success: true,
      message: 'Scan the QR code to authenticate.',
      data: result,
    });
  };

  manualReconnectConnection = async (
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ) => {
    const { connectionId } = request.params;
    const result = await this.whatsappService.manualReconnectConnection(connectionId);

    return reply.status(200).send({
      success: true,
      message: result.message,
      data: result,
    });
  };

  /**
   * POST /api/v1/connections/:connectionId/reset
   * Reseta conexão e gera novo QR code (limpa credenciais corrompidas)
   */
  resetConnection = async (
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ) => {
    const { connectionId } = request.params;
    const result = await this.whatsappService.resetConnection(connectionId);

    return reply.status(200).send({
      success: true,
      message: 'Conexão resetada. Novo QR code será gerado.',
      data: result,
    });
  };

  /**
   * POST /api/v1/connections/:connectionId/disconnect
   * Desconecta conexão
   */
  disconnectConnection = async (
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ) => {
    const { connectionId } = request.params;
    await this.whatsappService.disconnectConnection(connectionId);

    return reply.status(200).send({
      success: true,
      message: 'Connection disconnected successfully',
    });
  };

  /**
   * DELETE /api/v1/connections/:connectionId
   * Deleta conexão
   */
  deleteConnection = async (
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ) => {
    const { connectionId } = request.params;
    await this.whatsappService.deleteConnection(connectionId);

    return reply.status(200).send({
      success: true,
      message: 'Connection deleted successfully',
    });
  };
}
