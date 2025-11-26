import { getPrismaClient } from '../config/database.js';
import { AppError } from '../middlewares/error.middleware.js';

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

  // Validar número de telefone
  private validatePhoneNumber(phone: string): { isValid: boolean; reason?: string } {
    if (!phone || !phone.trim()) {
      return { isValid: false, reason: 'Número vazio' };
    }

    // Remover caracteres não numéricos para validação
    const cleanPhone = phone.replace(/\D/g, '');

    // Verificar se tem pelo menos 10 dígitos (formato mínimo)
    if (cleanPhone.length < 10) {
      return { isValid: false, reason: 'Muito curto (mínimo 10 dígitos)' };
    }

    // Verificar se tem mais de 15 dígitos (formato máximo internacional)
    if (cleanPhone.length > 15) {
      return { isValid: false, reason: 'Muito longo (máximo 15 dígitos)' };
    }

    // Verificar se começa com 0 (formato inválido)
    if (cleanPhone.startsWith('0')) {
      return { isValid: false, reason: 'Não pode começar com 0' };
    }

    // Verificar se tem apenas números após limpeza
    if (!/^\d+$/.test(cleanPhone)) {
      return { isValid: false, reason: 'Contém caracteres inválidos' };
    }

    return { isValid: true };
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
    const validContacts: ContactData[] = [];
    const invalidContacts: Array<ContactData & { reason: string }> = [];

    for (const contact of contacts) {
      if (!contact.phone || !contact.phone.trim()) {
        invalidContacts.push({ ...contact, reason: 'Número vazio' });
        continue;
      }

      const validation = this.validatePhoneNumber(contact.phone);
      if (validation.isValid) {
        validContacts.push(contact);
      } else {
        invalidContacts.push({ ...contact, reason: validation.reason || 'Inválido' });
      }
    }

    if (validContacts.length === 0) {
      throw new AppError(
        `Nenhum contato válido fornecido. ${invalidContacts.length} número(s) mal formatado(s).`,
        400
      );
    }

    // Criar contatos válidos
    const created = await this.prisma.listContact.createMany({
      data: validContacts.map(c => ({
        listId,
        name: c.name,
        phone: c.phone.replace(/\D/g, ''), // Remover caracteres não numéricos
      })),
      skipDuplicates: true,
    });

    return {
      message: `${created.count} contatos adicionados com sucesso${invalidContacts.length > 0 ? `. ${invalidContacts.length} número(s) mal formatado(s) foram ignorados.` : ''}`,
      count: created.count,
      invalidCount: invalidContacts.length,
      invalidContacts: invalidContacts.length > 0 ? invalidContacts.map(ic => ({
        phone: ic.phone,
        name: ic.name,
        reason: ic.reason,
      })) : undefined,
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
