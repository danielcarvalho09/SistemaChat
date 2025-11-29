import { FastifyInstance } from 'fastify';
import { ContactListController } from '../controllers/contact-list.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/authorization.middleware.js';

export async function contactListRoutes(fastify: FastifyInstance) {
  const contactListController = new ContactListController();

  // ✅ Verificar permissão de contact lists (admin ou gerente)
  // CRUD de listas
  fastify.post('/', {
    preHandler: [authenticate, requirePermission(['manage_contact_lists'])],
    handler: contactListController.createList,
  });

  fastify.get('/', {
    preHandler: [authenticate, requirePermission(['view_contact_lists', 'manage_contact_lists'])],
    handler: contactListController.getLists,
  });

  fastify.get('/:id', {
    preHandler: [authenticate, requirePermission(['view_contact_lists', 'manage_contact_lists'])],
    handler: contactListController.getListById,
  });

  fastify.put('/:id', {
    preHandler: [authenticate, requirePermission(['manage_contact_lists'])],
    handler: contactListController.updateList,
  });

  fastify.delete('/:id', {
    preHandler: [authenticate, requirePermission(['manage_contact_lists'])],
    handler: contactListController.deleteList,
  });

  // Gerenciar contatos
  fastify.post('/:id/contacts', {
    preHandler: [authenticate, requirePermission(['manage_contact_lists'])],
    handler: contactListController.addContacts,
  });

  fastify.delete('/:id/contacts/:contactId', {
    preHandler: [authenticate, requirePermission(['manage_contact_lists'])],
    handler: contactListController.removeContact,
  });

  // Importar contatos de CSV (multipart)
  fastify.post('/:id/import', {
    preHandler: [authenticate, requirePermission(['manage_contact_lists'])],
    handler: contactListController.importContacts,
  });
}
