import { FastifyRequest, FastifyReply } from 'fastify';
import { ContactListService } from '../services/contact-list.service.js';
import { logger } from '../config/logger.js';

interface CreateListBody {
  name: string;
  description?: string;
}

interface AddContactsBody {
  contacts: Array<{ name?: string; phone: string }>;
}

export class ContactListController {
  private contactListService = new ContactListService();

  // Criar nova lista de contatos
  createList = async (request: FastifyRequest<{ Body: CreateListBody }>, reply: FastifyReply) => {
    const { name, description } = request.body;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    if (!name) {
      return reply.status(400).send({
        success: false,
        message: 'Nome da lista é obrigatório',
      });
    }

    const list = await this.contactListService.createList({
      name,
      description,
      userId,
    });

    logger.info(`Lista criada: ${list.id}`);

    return reply.status(201).send({
      success: true,
      data: list,
    });
  };

  // Listar todas as listas do usuário
  getLists = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    const lists = await this.contactListService.getLists(userId);

    return reply.status(200).send({
      success: true,
      data: lists,
    });
  };

  // Obter detalhes de uma lista específica
  getListById = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    const list = await this.contactListService.getListById(id, userId);

    return reply.status(200).send({
      success: true,
      data: list,
    });
  };

  // Atualizar lista
  updateList = async (
    request: FastifyRequest<{ Params: { id: string }; Body: CreateListBody }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { name, description } = request.body;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    const list = await this.contactListService.updateList(id, userId, {
      name,
      description,
    });

    logger.info(`Lista atualizada: ${id}`);

    return reply.status(200).send({
      success: true,
      data: list,
    });
  };

  // Deletar lista
  deleteList = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    await this.contactListService.deleteList(id, userId);

    logger.info(`Lista deletada: ${id}`);

    return reply.status(200).send({
      success: true,
      message: 'Lista deletada com sucesso',
    });
  };

  // Adicionar contatos à lista
  addContacts = async (
    request: FastifyRequest<{ Params: { id: string }; Body: AddContactsBody }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { contacts } = request.body;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    if (!contacts || !Array.isArray(contacts)) {
      return reply.status(400).send({
        success: false,
        message: 'Contatos devem ser um array',
      });
    }

    const result = await this.contactListService.addContacts(id, userId, contacts);

    logger.info(`Contatos adicionados à lista: ${id}`);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  // Remover contato da lista
  removeContact = async (
    request: FastifyRequest<{ Params: { id: string; contactId: string } }>,
    reply: FastifyReply
  ) => {
    const { id, contactId } = request.params;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    await this.contactListService.removeContact(id, contactId, userId);

    logger.info(`Contato removido da lista: ${id}`);

    return reply.status(200).send({
      success: true,
      message: 'Contato removido com sucesso',
    });
  };

  // Importar contatos de arquivo CSV
  importContacts = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    // Obter arquivo do multipart
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        success: false,
        message: 'Arquivo não enviado',
      });
    }

    // Converter stream para buffer
    const buffer = await data.toBuffer();

    const result = await this.contactListService.importContactsFromCSV(id, userId, buffer);

    logger.info(`Contatos importados para lista: ${id}`);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };
}
