import { getPrismaClient } from '../config/database.js';
import { AppError } from '../middlewares/error.middleware.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';

interface BroadcastData {
  userId: string;
  connectionId: string;
  listId: string;
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
}

interface IntervalConfig {
  minInterval: number;
  maxInterval: number;
}

export class BroadcastService {
  private prisma = getPrismaClient();
  private activeBroadcasts: Map<string, boolean> = new Map();

  // Gera ID único para evitar spam do WhatsApp
  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  // Gera intervalo aleatório entre min e max (em segundos)
  private getRandomInterval(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
  }

  // Envia broadcast
  async sendBroadcast(data: BroadcastData) {
    const { userId, connectionId, listId, message, mediaUrl, mediaType } = data;

    // Verificar se a lista existe e pertence ao usuário
    const list = await this.prisma.contactList.findFirst({
      where: { id: listId, userId },
      include: { contacts: true }
    });

    if (!list) {
      throw new AppError('Lista não encontrada', 404);
    }

    // Verificar se a conexão existe e está ativa
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { id: connectionId, status: 'connected' }
    });

    if (!connection) {
      throw new AppError('Conexão não encontrada ou inativa', 404);
    }

    if (list.contacts.length === 0) {
      throw new AppError('Lista sem contatos', 400);
    }

    // Criar registro do broadcast
    const broadcast = await this.prisma.broadcast.create({
      data: {
        userId,
        connectionId,
        listId,
        message,
        mediaUrl,
        mediaType,
        totalContacts: list.contacts.length,
        status: 'pending'
      }
    });

    // Marcar broadcast como ativo
    this.activeBroadcasts.set(broadcast.id, true);

    // Buscar configurações de intervalo
    const config = await this.getIntervalConfig(userId);

    // Iniciar envio assíncrono
    this.processBroadcast(broadcast.id, connectionId, list.contacts, message, mediaUrl, mediaType, config);

    return {
      id: broadcast.id,
      status: 'pending',
      totalContacts: list.contacts.length,
      message: 'Broadcast iniciado',
    };
  }

  // Processa o envio do broadcast
  private async processBroadcast(
    broadcastId: string,
    connectionId: string,
    contacts: any[],
    message: string,
    mediaUrl: string | undefined,
    mediaType: string | undefined,
    config: IntervalConfig
  ) {
    try {
      // Atualizar status para "em andamento"
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'in_progress', startedAt: new Date() }
      });

      let sent = 0;
      let failed = 0;

      for (const contact of contacts) {
        // Verificar se o broadcast foi cancelado
        if (!this.activeBroadcasts.get(broadcastId)) {
          await this.prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: 'cancelled', completedAt: new Date() }
          });
          return;
        }

        try {
          // Formatar número para WhatsApp
          const phoneNumber = contact.phone.replace(/\D/g, '');
          const whatsappId = `${phoneNumber}@s.whatsapp.net`;

          // Buscar nome do contato
          // Prioridade: 1. Nome da lista, 2. Nome do banco (se já conversou), 3. Número
          const contactName = await baileysManager.getContactName(connectionId, phoneNumber);
          const finalName = contact.name || (contactName !== phoneNumber ? contactName : null) || phoneNumber;
          
          // Substituir variáveis na mensagem
          let personalizedMessage = message;
          personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/gi, finalName);
          personalizedMessage = personalizedMessage.replace(/\{\{phone\}\}/gi, phoneNumber);
          personalizedMessage = personalizedMessage.replace(/\{\{nome\}\}/gi, finalName);
          personalizedMessage = personalizedMessage.replace(/\{\{telefone\}\}/gi, phoneNumber);

          // Adicionar ID único ao final da mensagem com emoji
          const uniqueId = this.generateUniqueId();
          const messageWithId = `${personalizedMessage}\n\n🆔 _${uniqueId}_`;

          // Enviar mensagem
          if (mediaUrl && mediaType && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
            await baileysManager.sendMedia(connectionId, whatsappId, messageWithId, mediaUrl, mediaType);
          } else {
            await baileysManager.sendMessage(connectionId, whatsappId, messageWithId);
          }

          sent++;

          // Registrar envio
          await this.prisma.broadcastLog.create({
            data: {
              broadcastId,
              contactId: contact.id,
              status: 'sent'
            }
          });

          // Atualizar progresso
          await this.prisma.broadcast.update({
            where: { id: broadcastId },
            data: { sentCount: sent }
          });

          // Aguardar intervalo aleatório antes do próximo envio
          if (sent < contacts.length) {
            const delay = this.getRandomInterval(config.minInterval, config.maxInterval);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          failed++;
          console.error(`Erro ao enviar para ${contact.phone}:`, error);

          // Registrar falha
          await this.prisma.broadcastLog.create({
            data: {
              broadcastId,
              contactId: contact.id,
              status: 'failed',
              error: (error as Error).message
            }
          });

          // Atualizar contador de falhas
          await this.prisma.broadcast.update({
            where: { id: broadcastId },
            data: { failedCount: failed }
          });
        }
      }

      // Finalizar broadcast
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'completed', completedAt: new Date() }
      });

      this.activeBroadcasts.delete(broadcastId);
    } catch (error) {
      console.error('Erro ao processar broadcast:', error);
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'failed', completedAt: new Date() }
      });
      this.activeBroadcasts.delete(broadcastId);
    }
  }

  // Buscar histórico de broadcasts
  async getBroadcastHistory(userId: string) {
    return await this.prisma.broadcast.findMany({
      where: { userId },
      include: {
        list: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  // Buscar detalhes de um broadcast
  async getBroadcastDetails(broadcastId: string, userId: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId, userId },
      include: {
        list: { select: { name: true } },
        logs: {
          include: {
            contact: { select: { name: true, phone: true } }
          },
          orderBy: { sentAt: 'desc' }
        }
      }
    });

    if (!broadcast) {
      throw new AppError('Broadcast não encontrado', 404);
    }

    return broadcast;
  }

  // Cancelar broadcast
  async cancelBroadcast(broadcastId: string, userId: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId, userId }
    });

    if (!broadcast) {
      throw new AppError('Broadcast não encontrado', 404);
    }

    if (broadcast.status !== 'in_progress' && broadcast.status !== 'pending') {
      throw new AppError('Broadcast não pode ser cancelado', 400);
    }

    this.activeBroadcasts.set(broadcastId, false);
  }

  // Buscar configurações de intervalo
  async getIntervalConfig(userId: string): Promise<IntervalConfig> {
    let config = await this.prisma.broadcastConfig.findUnique({
      where: { userId }
    });

    if (!config) {
      // Criar configuração padrão
      config = await this.prisma.broadcastConfig.create({
        data: {
          userId,
          minInterval: 5,
          maxInterval: 15
        }
      });
    }

    return {
      minInterval: config.minInterval,
      maxInterval: config.maxInterval,
    };
  }

  // Atualizar configurações de intervalo
  async updateIntervalConfig(userId: string, config: IntervalConfig) {
    const result = await this.prisma.broadcastConfig.upsert({
      where: { userId },
      update: {
        minInterval: config.minInterval,
        maxInterval: config.maxInterval
      },
      create: {
        userId,
        minInterval: config.minInterval,
        maxInterval: config.maxInterval
      }
    });

    return {
      minInterval: result.minInterval,
      maxInterval: result.maxInterval,
    };
  }
}
