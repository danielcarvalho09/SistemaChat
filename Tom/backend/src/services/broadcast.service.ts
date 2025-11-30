import { getPrismaClient } from '../config/database.js';
import { AppError } from '../middlewares/error.middleware.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';
import { logger } from '../config/logger.js';

interface BroadcastData {
  userId: string;
  connectionId: string;
  listId: string;
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
  privacyPolicyUrl?: string;
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
    const { userId, connectionId, listId, message, mediaUrl, mediaType, privacyPolicyUrl } = data;

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

    // ✅ Buscar configurações de intervalo ANTES de criar o broadcast
    const config = await this.getIntervalConfig(userId);

    // ✅ Criar registro do broadcast com informações adicionais
    const broadcast = await this.prisma.broadcast.create({
      data: {
        userId,
        connectionId,
        listId,
        message,
        mediaUrl,
        mediaType,
        privacyPolicyUrl: privacyPolicyUrl || null,
        totalContacts: list.contacts.length,
        status: 'pending',
        // ✅ Cache de informações para facilitar consultas
        listName: list.name,
        connectionName: connection.name,
        connectionPhone: connection.phoneNumber,
        // ✅ Salvar configurações de intervalo usadas
        minIntervalUsed: config.minInterval,
        maxIntervalUsed: config.maxInterval,
        // ✅ Inicializar contadores de resposta
        repliedCount: 0,
        notRepliedCount: 0, // Será atualizado quando o broadcast finalizar e quando contatos responderem
      }
    });

    // Marcar broadcast como ativo
    this.activeBroadcasts.set(broadcast.id, true);

    // Iniciar envio assíncrono
    this.processBroadcast(broadcast.id, connectionId, list.contacts, message, mediaUrl, mediaType, privacyPolicyUrl, config);

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
    privacyPolicyUrl: string | undefined,
    config: IntervalConfig
  ) {
    const startTime = Date.now(); // ✅ Marcar início para calcular duração
    let lastSentAt: Date | null = null;
    let sent = 0; // ✅ Declarar antes do try para estar acessível no catch
    let failed = 0; // ✅ Declarar antes do try para estar acessível no catch
    
    try {
      // Atualizar status para "em andamento"
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'in_progress', startedAt: new Date() }
      });

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
          // ✅ Formatar número para WhatsApp (já deve estar normalizado com 55)
          let phoneNumber = contact.phone.replace(/\D/g, '');
          
          // ✅ GARANTIR que número começa com 55 (Brasil)
          // Se não começar com 55, pode ser número sem código do país - adicionar
          if (!phoneNumber.startsWith('55')) {
            // Se tem 10 ou 11 dígitos, é número brasileiro sem código - adicionar 55
            if (phoneNumber.length === 10 || phoneNumber.length === 11) {
              phoneNumber = `55${phoneNumber}`;
              logger.info(`[Broadcast] ✅ Normalized phone number: added 55 prefix -> ${phoneNumber}`);
            } else {
              logger.error(`[Broadcast] ❌ Invalid phone number format: ${phoneNumber} (must start with 55 for Brazil)`);
              throw new Error(`Número inválido: ${phoneNumber} (deve começar com 55 para Brasil)`);
            }
          }
          
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
          let messageWithId = `${personalizedMessage}\n\n🆔 _${uniqueId}_`;
          
          // ✅ Adicionar link de política de privacidade se fornecido (FIXO ao final)
          if (privacyPolicyUrl && privacyPolicyUrl.trim()) {
            messageWithId = `${messageWithId}\n\n🔒 Política de Privacidade: ${privacyPolicyUrl.trim()}`;
          }

          // Enviar mensagem
          if (mediaUrl && mediaType && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
            await baileysManager.sendMedia(connectionId, whatsappId, messageWithId, mediaUrl, mediaType);
          } else {
            await baileysManager.sendMessage(connectionId, whatsappId, messageWithId);
          }

          sent++;

          // ✅ Registrar envio com informações adicionais
          const sentAt = new Date();
          lastSentAt = sentAt;
          
          await this.prisma.broadcastLog.create({
            data: {
              broadcastId,
              contactId: contact.id,
              status: 'sent',
              phoneNumber: phoneNumber, // ✅ Cache do número
              contactName: finalName, // ✅ Cache do nome usado
              uniqueId: uniqueId, // ✅ Salvar ID único para rastrear respostas
              attempts: 1,
              hasReplied: false, // ✅ Inicialmente não respondeu
              sentAt: sentAt,
            }
          });

          // ✅ Calcular métricas em tempo real
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          const messagesPerMinute = elapsedSeconds > 0 ? (sent / elapsedSeconds) * 60 : 0;

          // Atualizar progresso com métricas
          await this.prisma.broadcast.update({
            where: { id: broadcastId },
            data: { 
              sentCount: sent,
              lastSentAt: sentAt,
              durationSeconds: elapsedSeconds,
              messagesPerMinute: Math.round(messagesPerMinute * 100) / 100, // 2 casas decimais
            }
          });

          // Aguardar intervalo aleatório antes do próximo envio
          if (sent < contacts.length) {
            const delay = this.getRandomInterval(config.minInterval, config.maxInterval);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          failed++;
          console.error(`Erro ao enviar para ${contact.phone}:`, error);

          // ✅ Tentar obter phoneNumber formatado mesmo em caso de erro
          let phoneNumberForLog: string | null = null;
          try {
            let phoneNum = contact.phone.replace(/\D/g, '');
            if (!phoneNum.startsWith('55') && (phoneNum.length === 10 || phoneNum.length === 11)) {
              phoneNum = `55${phoneNum}`;
            }
            phoneNumberForLog = phoneNum;
          } catch {
            phoneNumberForLog = contact.phone || null;
          }

          // ✅ Registrar falha com informações adicionais
          await this.prisma.broadcastLog.create({
            data: {
              broadcastId,
              contactId: contact.id,
              status: 'failed',
              error: (error as Error).message,
              phoneNumber: phoneNumberForLog, // ✅ Cache do número formatado
              contactName: contact.name || null, // ✅ Cache do nome
              attempts: 1,
            }
          });

          // Atualizar contador de falhas
          await this.prisma.broadcast.update({
            where: { id: broadcastId },
            data: { failedCount: failed }
          });
        }
      }

      // ✅ Finalizar broadcast com métricas finais
      const endTime = Date.now();
      const totalDurationSeconds = Math.floor((endTime - startTime) / 1000);
      const totalMessages = sent + failed;
      const finalMessagesPerMinute = totalDurationSeconds > 0 
        ? (sent / totalDurationSeconds) * 60 
        : 0;
      const successRate = totalMessages > 0 
        ? (sent / totalMessages) * 100 
        : 0;

      // ✅ Calcular contadores de resposta (inicialmente todos não responderam)
      const repliedCount = 0; // Ainda não há respostas no momento da finalização
      const notRepliedCount = Math.max(0, sent - repliedCount); // Todos que receberam ainda não responderam

      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { 
          status: 'completed', 
          completedAt: new Date(),
          lastSentAt: lastSentAt || new Date(),
          durationSeconds: totalDurationSeconds,
          messagesPerMinute: Math.round(finalMessagesPerMinute * 100) / 100,
          successRate: Math.round(successRate * 100) / 100, // Taxa de sucesso em %
          repliedCount: repliedCount, // ✅ Inicialmente 0 (atualizado em tempo real quando responderem)
          notRepliedCount: notRepliedCount, // ✅ Todos que receberam (atualizado quando responderem)
        }
      });

      this.activeBroadcasts.delete(broadcastId);
    } catch (error) {
      console.error('Erro ao processar broadcast:', error);
      
      // ✅ Atualizar com métricas parciais mesmo em caso de falha
      const endTime = Date.now();
      const totalDurationSeconds = Math.floor((endTime - startTime) / 1000);
      const totalMessages = sent + failed;
      const finalMessagesPerMinute = totalDurationSeconds > 0 
        ? (sent / totalDurationSeconds) * 60 
        : 0;
      const successRate = totalMessages > 0 
        ? (sent / totalMessages) * 100 
        : 0;
      
      // ✅ Calcular contadores de resposta mesmo em caso de falha
      const repliedCount = 0;
      const notRepliedCount = Math.max(0, sent - repliedCount);

      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { 
          status: 'failed', 
          completedAt: new Date(),
          lastSentAt: lastSentAt || null,
          durationSeconds: totalDurationSeconds,
          messagesPerMinute: Math.round(finalMessagesPerMinute * 100) / 100,
          successRate: Math.round(successRate * 100) / 100,
          repliedCount: repliedCount,
          notRepliedCount: notRepliedCount,
        }
      });
      this.activeBroadcasts.delete(broadcastId);
    }
  }

  // Buscar histórico de broadcasts
  // ✅ Se isAdmin = true, retorna todos os broadcasts. Senão, apenas do usuário
  async getBroadcastHistory(userId: string, isAdmin: boolean = false) {
    const broadcasts = await this.prisma.broadcast.findMany({
      where: isAdmin ? {} : { userId }, // ✅ Admin vê tudo, outros apenas os seus
      include: {
        list: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // ✅ Se for admin, buscar informações dos usuários que criaram os broadcasts
    if (isAdmin && broadcasts.length > 0) {
      const userIds = [...new Set(broadcasts.map(b => b.userId))];
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
      });
      
      const userMap = new Map(users.map(u => [u.id, u]));
      
      return broadcasts.map(broadcast => ({
        ...broadcast,
        user: userMap.get(broadcast.userId) || null
      }));
    }

    return broadcasts;
  }

  // Buscar detalhes de um broadcast
  // ✅ Se isAdmin = true, pode ver qualquer broadcast. Senão, apenas os seus
  async getBroadcastDetails(broadcastId: string, userId: string, isAdmin: boolean = false) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: isAdmin 
        ? { id: broadcastId } // ✅ Admin pode ver qualquer broadcast
        : { id: broadcastId, userId }, // ✅ Outros apenas os seus
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
      return null;
    }

    // ✅ Se for admin, buscar informações do usuário que criou o broadcast
    if (isAdmin) {
      const user = await this.prisma.user.findUnique({
        where: { id: broadcast.userId },
        select: { id: true, name: true, email: true }
      });
      
      return {
        ...broadcast,
        user: user || null
      };
    }

    return broadcast;

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
