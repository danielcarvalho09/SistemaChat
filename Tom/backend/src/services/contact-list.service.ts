import { getPrismaClient } from '../config/database';
import { AppError } from '../middlewares/error.middleware';

interface CreateListData {
  name: string;
  description?: string;
  userId: string;
}

interface UpdateListData {
  name?: string;
  description?: string;
}

interface ContactData {
  name?: string;
  phone: string;
}

export class ContactListService {
  private prisma = getPrismaClient();

  // Criar nova lista
  async createList(data: CreateListData) {
    return await this.prisma.contactList.create({
      data: {
        name: data.name,
        description: data.description,
        userId: data.userId,
      },
    });
  }

  // Listar todas as listas do usuário
  async getLists(userId: string) {
    return await this.prisma.contactList.findMany({
      where: { userId },
      include: {
        contacts: true,
        _count: {
          select: { contacts: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Obter lista por ID
  async getListById(listId: string, userId: string) {
    const list = await this.prisma.contactList.findFirst({
      where: { id: listId, userId },
      include: {
        contacts: {
          orderBy: { createdAt: 'desc' }
        },
      },
    });

    if (!list) {
      throw new AppError('Lista não encontrada', 404);
    }

    return list;
  }

  // Atualizar lista
  async updateList(listId: string, userId: string, data: UpdateListData) {
    const list = await this.prisma.contactList.findFirst({
      where: { id: listId, userId },
    });

    if (!list) {
      throw new AppError('Lista não encontrada', 404);
    }

    return await this.prisma.contactList.update({
      where: { id: listId },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  // Deletar lista
  async deleteList(listId: string, userId: string) {
    const list = await this.prisma.contactList.findFirst({
      where: { id: listId, userId },
    });

    if (!list) {
      throw new AppError('Lista não encontrada', 404);
    }

    await this.prisma.contactList.delete({
      where: { id: listId },
    });
  }

  // Adicionar contatos à lista
  async addContacts(listId: string, userId: string, contacts: ContactData[]) {
    const list = await this.prisma.contactList.findFirst({
      where: { id: listId, userId },
    });

    if (!list) {
      throw new AppError('Lista não encontrada', 404);
    }

    // Validar telefones
    const validContacts = contacts.filter(c => c.phone && c.phone.trim().length > 0);

    if (validContacts.length === 0) {
      throw new AppError('Nenhum contato válido fornecido', 400);
    }

    // Criar contatos
    const created = await this.prisma.listContact.createMany({
      data: validContacts.map(c => ({
        listId,
        name: c.name,
        phone: c.phone.replace(/\D/g, ''), // Remover caracteres não numéricos
      })),
      skipDuplicates: true,
    });

    return {
      message: `${created.count} contatos adicionados com sucesso`,
      count: created.count,
    };
  }

  // Remover contato da lista
  async removeContact(listId: string, contactId: string, userId: string) {
    const list = await this.prisma.contactList.findFirst({
      where: { id: listId, userId },
    });

    if (!list) {
      throw new AppError('Lista não encontrada', 404);
    }

    const contact = await this.prisma.listContact.findFirst({
      where: { id: contactId, listId },
    });

    if (!contact) {
      throw new AppError('Contato não encontrado', 404);
    }

    await this.prisma.listContact.delete({
      where: { id: contactId },
    });
  }

  // Importar contatos de CSV
  async importContactsFromCSV(listId: string, userId: string, fileBuffer: Buffer) {
    const list = await this.prisma.contactList.findFirst({
      where: { id: listId, userId },
    });

    if (!list) {
      throw new AppError('Lista não encontrada', 404);
    }

    // Converter buffer para string
    const csvContent = fileBuffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);

    if (lines.length === 0) {
      throw new AppError('Arquivo CSV vazio', 400);
    }

    const contacts: ContactData[] = [];

    // Processar linhas (assumindo formato: nome,telefone ou apenas telefone)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Pular cabeçalho se existir
      if (i === 0 && (line.toLowerCase().includes('nome') || line.toLowerCase().includes('name'))) {
        continue;
      }

      const parts = line.split(',').map(p => p.trim());
      
      if (parts.length >= 2) {
        // Formato: nome,telefone
        contacts.push({
          name: parts[0],
          phone: parts[1],
        });
      } else if (parts.length === 1) {
        // Formato: apenas telefone
        contacts.push({
          phone: parts[0],
        });
      }
    }

    if (contacts.length === 0) {
      throw new AppError('Nenhum contato válido encontrado no CSV', 400);
    }

    return await this.addContacts(listId, userId, contacts);
  }
}
