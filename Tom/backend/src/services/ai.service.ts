import { getPrismaClient } from '../config/database.js';
import { logger } from '../config/logger.js';
import { cacheGet, cacheSet } from '../config/redis.js';
import OpenAI from 'openai';
import crypto from 'crypto';

export class AIService {
  private prisma = getPrismaClient();
  private readonly ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY || 'your-32-char-secret-key-here!!!';
  private readonly ALGORITHM = 'aes-256-cbc';

  /**
   * Criptografa a API Key
   */
  private encrypt(text: string): string {
    try {
      if (!text || !text.trim()) {
        throw new Error('Text to encrypt cannot be empty');
      }

      // Validar chave de criptografia
      if (!this.ENCRYPTION_KEY || this.ENCRYPTION_KEY.length < 16) {
        logger.warn(`[AI Service] ⚠️ Encryption key is too short or missing. Using default key.`);
      }

      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error: any) {
      logger.error('[AI Service] ❌ Error encrypting text:', error);
      throw new Error(`Encryption failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Descriptografa a API Key
   */
  private decrypt(text: string): string {
    try {
      if (!text || !text.trim()) {
        throw new Error('Text to decrypt cannot be empty');
      }

      const parts = text.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const key = Buffer.from(this.ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      logger.error('[AI Service] ❌ Error decrypting text:', error);
      throw new Error(`Decryption failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Cria novo assistente de IA
   */
  async createAssistant(data: {
    name: string;
    apiKey: string;
    model: string;
    instructions: string;
    temperature?: number;
    maxTokens?: number;
    memoryContext?: number;
    memoryCacheDays?: number;
  }) {
    try {
      logger.info(`[AI Service] 🤖 Creating assistant: ${data.name}`);
      logger.debug(`[AI Service] 📝 Input data:`, {
        name: data.name,
        model: data.model,
        hasApiKey: !!data.apiKey,
        apiKeyPrefix: data.apiKey?.substring(0, 10) + '...',
        instructionsLength: data.instructions?.length || 0,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        memoryContext: data.memoryContext,
        memoryCacheDays: data.memoryCacheDays,
      });

      // ✅ Validação dos campos obrigatórios
      if (!data.name || !data.name.trim()) {
        throw new Error('Nome do assistente é obrigatório');
      }

      if (!data.apiKey || !data.apiKey.trim()) {
        throw new Error('API Key é obrigatória');
      }

      if (!data.model || !data.model.trim()) {
        throw new Error('Modelo é obrigatório');
      }

      if (!data.instructions || !data.instructions.trim()) {
        throw new Error('Instruções são obrigatórias');
      }

      // Verificar se nome já existe
      logger.debug(`[AI Service] 🔍 Checking if assistant name "${data.name}" already exists...`);
      const existing = await this.prisma.aIAssistant.findUnique({
        where: { name: data.name },
      });

      if (existing) {
        logger.warn(`[AI Service] ⚠️ Assistant with name "${data.name}" already exists`);
        throw new Error(`Assistant with name "${data.name}" already exists`);
      }

      // Testar API Key
      logger.debug(`[AI Service] 🔑 Testing OpenAI API Key...`);
      try {
        const openai = new OpenAI({ apiKey: data.apiKey });
        const models = await openai.models.list();
        logger.info(`[AI Service] ✅ API Key is valid. Available models: ${models.data.length}`);
      } catch (error: any) {
        logger.error(`[AI Service] ❌ Invalid OpenAI API Key:`, error?.message || error);
        throw new Error(`Invalid OpenAI API Key: ${error?.message || 'Failed to authenticate'}`);
      }

      // Criptografar API Key
      logger.debug(`[AI Service] 🔐 Encrypting API Key...`);
      let encryptedApiKey: string;
      try {
        encryptedApiKey = this.encrypt(data.apiKey);
        logger.debug(`[AI Service] ✅ API Key encrypted successfully`);
      } catch (error: any) {
        logger.error(`[AI Service] ❌ Error encrypting API Key:`, error);
        throw new Error(`Error encrypting API Key: ${error?.message || 'Encryption failed'}`);
      }

      // Criar assistente
      logger.debug(`[AI Service] 💾 Creating assistant in database...`);
      const assistant = await this.prisma.aIAssistant.create({
        data: {
          name: data.name.trim(),
          apiKey: encryptedApiKey,
          model: data.model.trim(),
          instructions: data.instructions.trim(),
          temperature: data.temperature ?? 0.7,
          maxTokens: data.maxTokens ?? 500,
          memoryContext: data.memoryContext ?? 20,
          memoryCacheDays: data.memoryCacheDays ?? 1,
        },
      });

      logger.info(`[AI Service] ✅ Assistant created successfully: ${assistant.id} (${assistant.name})`);

      // Não retornar API Key
      const { apiKey, ...result } = assistant;
      return result;
    } catch (error: any) {
      logger.error('[AI Service] ❌ Error creating assistant:', error);
      logger.error('[AI Service] ❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      throw error;
    }
  }

  /**
   * Lista todos os assistentes
   */
  async listAssistants() {
    const assistants = await this.prisma.aIAssistant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        model: true,
        temperature: true,
        maxTokens: true,
        memoryContext: true,
        memoryCacheDays: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { connections: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assistants;
  }

  /**
   * Busca assistente por ID
   */
  async getAssistant(id: string) {
    const assistant = await this.prisma.aIAssistant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        model: true,
        instructions: true,
        temperature: true,
        maxTokens: true,
        memoryContext: true,
        memoryCacheDays: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        connections: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!assistant) {
      throw new Error('Assistant not found');
    }

    return assistant;
  }

  /**
   * Atualiza assistente
   */
  async updateAssistant(
    id: string,
    data: {
      name?: string;
      apiKey?: string;
      model?: string;
      instructions?: string;
      temperature?: number;
      maxTokens?: number;
      memoryContext?: number;
      memoryCacheDays?: number;
      isActive?: boolean;
    }
  ) {
    try {
      logger.info(`[AI] Updating assistant: ${id}`);

      // Se mudou a API Key, testar e criptografar
      let encryptedApiKey: string | undefined;
      if (data.apiKey) {
        try {
          const openai = new OpenAI({ apiKey: data.apiKey });
          await openai.models.list();
          encryptedApiKey = this.encrypt(data.apiKey);
        } catch (error) {
          throw new Error('Invalid OpenAI API Key');
        }
      }

      const assistant = await this.prisma.aIAssistant.update({
        where: { id },
        data: {
          name: data.name,
          apiKey: encryptedApiKey,
          model: data.model,
          instructions: data.instructions,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          memoryContext: data.memoryContext,
          memoryCacheDays: data.memoryCacheDays,
          isActive: data.isActive,
        },
      });

      logger.info(`[AI] ✅ Assistant updated: ${id}`);

      // Não retornar API Key
      const { apiKey, ...result } = assistant;
      return result;
    } catch (error) {
      logger.error('[AI] Error updating assistant:', error);
      throw error;
    }
  }

  /**
   * Deleta assistente
   */
  async deleteAssistant(id: string) {
    try {
      logger.info(`[AI] Deleting assistant: ${id}`);

      // Verificar se está sendo usado
      const connections = await this.prisma.whatsAppConnection.count({
        where: { aiAssistantId: id },
      });

      if (connections > 0) {
        throw new Error(`Assistant is being used by ${connections} connection(s)`);
      }

      await this.prisma.aIAssistant.delete({
        where: { id },
      });

      logger.info(`[AI] ✅ Assistant deleted: ${id}`);
    } catch (error) {
      logger.error('[AI] Error deleting assistant:', error);
      throw error;
    }
  }

  /**
   * Gera resposta da IA para uma mensagem
   */
  async generateResponse(
    conversationId: string,
    userMessage: string,
    assistantId: string
  ): Promise<string> {
    try {
      logger.info(`[AI] Generating response for conversation ${conversationId}`);

      // Buscar configuração do assistente
      const assistant = await this.prisma.aIAssistant.findUnique({
        where: { id: assistantId },
      });

      if (!assistant || !assistant.isActive) {
        throw new Error('Assistant not found or inactive');
      }

      // Descriptografar API Key
      const apiKey = this.decrypt(assistant.apiKey);

      // Inicializar OpenAI
      const openai = new OpenAI({ apiKey });

      // Buscar histórico de mensagens (memória)
      const cacheKey = `ai:conversation:${conversationId}`;
      let conversationHistory: any[] | null = await cacheGet(cacheKey);

      if (!conversationHistory) {
        // Buscar últimas mensagens do banco
        const messages = await this.prisma.message.findMany({
          where: { conversationId },
          orderBy: { timestamp: 'desc' },
          take: assistant.memoryContext,
          select: {
            content: true,
            isFromContact: true,
            timestamp: true,
          },
        });

        // Formatar mensagens para o formato da OpenAI
        conversationHistory = messages
          .reverse()
          .map((msg) => ({
            role: msg.isFromContact ? 'user' : 'assistant',
            content: msg.content,
          }));
      }

      // Adicionar mensagem atual do usuário
      conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Limitar ao contexto configurado
      if (conversationHistory.length > assistant.memoryContext) {
        conversationHistory = conversationHistory.slice(-assistant.memoryContext);
      }

      // Criar mensagens para a API
      const messages: any[] = [
        {
          role: 'system',
          content: assistant.instructions,
        },
        ...conversationHistory,
      ];

      // Chamar API da OpenAI
      const completion = await openai.chat.completions.create({
        model: assistant.model,
        messages: messages,
        temperature: assistant.temperature,
        max_tokens: assistant.maxTokens,
      });

      const response = completion.choices[0].message.content || 'Desculpe, não consegui gerar uma resposta.';

      // Adicionar resposta ao histórico
      conversationHistory.push({
        role: 'assistant',
        content: response,
      });

      // Salvar no cache Redis (TTL: memoryCacheDays)
      const cacheTTL = assistant.memoryCacheDays * 24 * 60 * 60; // dias -> segundos
      await cacheSet(cacheKey, conversationHistory, cacheTTL);

      logger.info(`[AI] ✅ Response generated for conversation ${conversationId}`);

      return response;
    } catch (error) {
      logger.error('[AI] Error generating response:', error);
      throw error;
    }
  }

  /**
   * Limpa memória de uma conversa
   */
  async clearConversationMemory(conversationId: string) {
    const cacheKey = `ai:conversation:${conversationId}`;
    await cacheSet(cacheKey, null, 1); // Expirar imediatamente
    logger.info(`[AI] Memory cleared for conversation ${conversationId}`);
  }
}
