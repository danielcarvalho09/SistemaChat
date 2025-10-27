import { FastifyInstance } from 'fastify';
import { ContactListController } from '../controllers/contact-list.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export async function contactListRoutes(fastify: FastifyInstance) {
  const contactListController = new ContactListController();

  // CRUD de listas
  fastify.post('/', {
    preHandler: [authenticate],
    handler: contactListController.createList,
  });

  fastify.get('/', {
    preHandler: [authenticate],
    handler: contactListController.getLists,
  });

  fastify.get('/:id', {
    preHandler: [authenticate],
    handler: contactListController.getListById,
  });

  fastify.put('/:id', {
    preHandler: [authenticate],
    handler: contactListController.updateList,
  });

  fastify.delete('/:id', {
    preHandler: [authenticate],
    handler: contactListController.deleteList,
  });

  // Gerenciar contatos
  fastify.post('/:id/contacts', {
    preHandler: [authenticate],
    handler: contactListController.addContacts,
  });

  fastify.delete('/:id/contacts/:contactId', {
    preHandler: [authenticate],
    handler: contactListController.removeContact,
  });

  // Importar contatos de CSV (multipart)
  fastify.post('/:id/import', {
    preHandler: [authenticate],
    handler: contactListController.importContacts,
  });
}
