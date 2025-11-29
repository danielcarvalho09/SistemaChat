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

  // Validar e normalizar número de telefone brasileiro
  // Números brasileiros devem começar com 55 (código do país)
  private validatePhoneNumber(phone: string): { isValid: boolean; normalized?: string; reason?: string } {
    if (!phone || !phone.trim()) {
      return { isValid: false, reason: 'Número vazio' };
    }

    // Remover caracteres não numéricos para validação
    let cleanPhone = phone.replace(/\D/g, '');

    // Verificar se tem apenas números após limpeza
    if (!/^\d+$/.test(cleanPhone)) {
      return { isValid: false, reason: 'Contém caracteres inválidos' };
    }

    // Verificar se começa com 0 (formato inválido)
    if (cleanPhone.startsWith('0')) {
      return { isValid: false, reason: 'Não pode começar com 0' };
    }

    // ✅ VALIDAÇÃO PARA NÚMEROS BRASILEIROS
    // Números do Brasil devem começar com 55 (código do país)
    
    // Se não começa com 55, pode ser:
    // 1. Número sem código do país (DDD + número) - adicionar 55
    // 2. Número inválido
    
    if (!cleanPhone.startsWith('55')) {
      // Tentar normalizar: adicionar 55 se for número brasileiro válido
      // Formato brasileiro sem código: DDD (2 dígitos) + número (8 ou 9 dígitos)
      // Exemplos válidos: 11987654321 (11 DDD + 987654321), 1198765432 (11 DDD + 98765432)
      
      // Verificar se parece com número brasileiro (10 ou 11 dígitos sem código do país)
      if (cleanPhone.length === 10 || cleanPhone.length === 11) {
        // Adicionar código do país 55
        cleanPhone = `55${cleanPhone}`;
      } else {
        return { isValid: false, reason: 'Número inválido. Números brasileiros devem ter 10 ou 11 dígitos (DDD + número) ou começar com 55' };
      }
    }

    // Após normalizar, validar formato completo
    // Formato esperado: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)
    // Total: 12 ou 13 dígitos (55 + 2 + 8/9)
    
    if (cleanPhone.length < 12) {
      return { isValid: false, reason: 'Número muito curto. Formato esperado: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)' };
    }

    if (cleanPhone.length > 13) {
      return { isValid: false, reason: 'Número muito longo. Formato esperado: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)' };
    }

    // Verificar se realmente começa com 55 (Brasil)
    if (!cleanPhone.startsWith('55')) {
      return { isValid: false, reason: 'Número deve começar com 55 (código do Brasil)' };
    }

    // Verificar formato do DDD (deve estar entre 11 e 99)
    const ddd = cleanPhone.substring(2, 4);
    const dddNum = parseInt(ddd, 10);
    
    if (isNaN(dddNum) || dddNum < 11 || dddNum > 99) {
      return { isValid: false, reason: `DDD inválido: ${ddd}. DDD brasileiro deve estar entre 11 e 99` };
    }

    return { isValid: true, normalized: cleanPhone };
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
      if (validation.isValid && validation.normalized) {
        // ✅ Usar número normalizado (com 55)
        validContacts.push({
          ...contact,
          phone: validation.normalized, // Número normalizado com código do país
        });
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
    // ✅ Os números já estão normalizados e validados (com 55)
    const created = await this.prisma.listContact.createMany({
      data: validContacts.map(c => ({
        listId,
        name: c.name,
        phone: c.phone, // Já está normalizado (com 55) e sem caracteres não numéricos
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
