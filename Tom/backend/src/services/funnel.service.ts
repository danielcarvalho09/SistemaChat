import { getPrismaClient } from '../config/database.js';
import { logger } from '../config/logger.js';
import { NotFoundError, ForbiddenError } from '../middlewares/error.middleware.js';

interface GenerateFunnelRequest {
  niche: string;
  name?: string;
}

interface FunnelStageData {
  title: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  positionX: number;
  positionY: number;
}

interface FunnelConnectionData {
  fromStageId: string;
  toStageId: string;
  label?: string;
}

export class FunnelService {
  private prisma = getPrismaClient();

  /**
   * Gera funil automaticamente usando IA
   */
  async generateFunnel(data: GenerateFunnelRequest, userId: string): Promise<any> {
    try {
      logger.info(`[FunnelService] Generating funnel for niche: ${data.niche}`);

      // ✅ Gerar estrutura do funil usando IA
      const funnelStructure = await this.generateFunnelWithAI(data.niche);

      // ✅ Criar funil no banco
      const funnel = await this.prisma.funnel.create({
        data: {
          name: data.name || `Funil ${data.niche}`,
          niche: data.niche,
          description: funnelStructure.description,
          userId,
        },
      });

      // ✅ Criar etapas do funil
      const stageIds: Record<number, string> = {};
      for (const stageData of funnelStructure.stages) {
        const stage = await this.prisma.funnelStage.create({
          data: {
            funnelId: funnel.id,
            title: stageData.title,
            description: stageData.description,
            icon: stageData.icon,
            color: stageData.color,
            order: stageData.order,
            positionX: stageData.positionX,
            positionY: stageData.positionY,
          },
        });
        stageIds[stageData.order] = stage.id;
      }

      // ✅ Criar conexões entre etapas
      for (const connection of funnelStructure.connections) {
        await this.prisma.funnelConnection.create({
          data: {
            fromStageId: stageIds[connection.from],
            toStageId: stageIds[connection.to],
            label: connection.label || null,
          },
        });
      }

      logger.info(`[FunnelService] ✅ Funnel created: ${funnel.id} with ${funnelStructure.stages.length} stages`);

      return this.getFunnelById(funnel.id, userId);
    } catch (error) {
      logger.error('[FunnelService] Error generating funnel:', error);
      throw error;
    }
  }

  /**
   * Gera estrutura do funil usando IA (OpenAI/Gemini/Claude)
   */
  private async generateFunnelWithAI(niche: string): Promise<any> {
    // ✅ Prompt otimizado para gerar funil de vendas
    const prompt = `Você é um especialista em funis de vendas e marketing digital. 

Crie um funil de vendas completo e estruturado para o nicho: "${niche}".

O funil deve ter entre 5 e 8 etapas, seguindo as melhores práticas de conversão.

Retorne APENAS um JSON válido no seguinte formato (sem explicações adicionais):

{
  "description": "Descrição breve do funil (1 frase)",
  "stages": [
    {
      "title": "Nome da Etapa",
      "description": "Descrição detalhada da etapa (2-3 frases)",
      "icon": "target|users|mail|phone|check-circle|dollar-sign|star|gift",
      "color": "#HEX_COLOR",
      "order": 0,
      "positionX": 100,
      "positionY": 50
    }
  ],
  "connections": [
    { "from": 0, "to": 1, "label": "Próximo passo" }
  ]
}

Regras:
- Etapas devem seguir ordem lógica de conversão
- Cores devem ser distintas e representativas
- PositionX deve aumentar ~200px por etapa (fluxo horizontal)
- PositionY pode variar para criar fluxos em árvore
- Ícones devem ser do lucide-react
- Conexões devem ligar etapas sequencialmente`;

    try {
      // ✅ Verificar se há API key do OpenRouter configurada
      const apiKey = process.env.OPENROUTER_API_KEY;
      
      if (!apiKey) {
        logger.warn('[FunnelService] No OpenRouter API key configured, using default funnel template');
        return this.getDefaultFunnelTemplate(niche);
      }

      // ✅ Usar OpenRouter com modelo Google Gemini 2.0 Flash
      logger.info('[FunnelService] Calling OpenRouter API with Gemini 2.0 Flash...');
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [
            { 
              role: 'system', 
              content: 'Você é um especialista em funis de vendas e marketing digital. Retorne APENAS JSON válido, sem markdown, sem explicações, sem texto adicional. Apenas o JSON puro.' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[FunnelService] OpenRouter API error: ${response.status} ${response.statusText}`);
        logger.error(`[FunnelService] Error body: ${errorText}`);
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content || '';
      
      logger.info(`[FunnelService] Raw AI response: ${content.substring(0, 200)}...`);
      
      // ✅ Limpar markdown se houver
      let jsonContent = content.trim();
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // ✅ Tentar extrair JSON se houver texto antes/depois
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }
      
      const funnelData = JSON.parse(jsonContent);

      logger.info('[FunnelService] ✅ Funnel generated by AI (OpenRouter + Gemini 2.0 Flash)');
      logger.info(`[FunnelService] Generated ${funnelData.stages?.length || 0} stages`);
      return funnelData;
    } catch (error: any) {
      logger.error('[FunnelService] Error calling OpenRouter API:', error?.message || error);
      if (error?.stack) {
        logger.error('[FunnelService] Stack:', error.stack);
      }
      logger.info('[FunnelService] Using default funnel template as fallback');
      return this.getDefaultFunnelTemplate(niche);
    }
  }

  /**
   * Template padrão de funil (fallback se IA não estiver disponível)
   */
  private getDefaultFunnelTemplate(niche: string): any {
    return {
      description: `Funil de vendas estruturado para ${niche}`,
      stages: [
        {
          title: 'Atração',
          description: 'Captar atenção do público-alvo através de conteúdo relevante e anúncios direcionados.',
          icon: 'target',
          color: '#3B82F6',
          order: 0,
          positionX: 100,
          positionY: 100,
        },
        {
          title: 'Captura',
          description: 'Converter visitantes em leads através de formulários, landing pages e iscas digitais.',
          icon: 'users',
          color: '#8B5CF6',
          order: 1,
          positionX: 350,
          positionY: 100,
        },
        {
          title: 'Nutrição',
          description: 'Educar e engajar leads através de e-mails, conteúdos e interações personalizadas.',
          icon: 'mail',
          color: '#10B981',
          order: 2,
          positionX: 600,
          positionY: 100,
        },
        {
          title: 'Qualificação',
          description: 'Identificar leads prontos para compra através de scoring e análise de comportamento.',
          icon: 'check-circle',
          color: '#F59E0B',
          order: 3,
          positionX: 850,
          positionY: 100,
        },
        {
          title: 'Oferta',
          description: 'Apresentar solução ideal com proposta de valor clara e call-to-action forte.',
          icon: 'dollar-sign',
          color: '#EF4444',
          order: 4,
          positionX: 1100,
          positionY: 100,
        },
        {
          title: 'Fechamento',
          description: 'Converter leads qualificados em clientes através de negociação e superação de objeções.',
          icon: 'star',
          color: '#EC4899',
          order: 5,
          positionX: 1350,
          positionY: 100,
        },
        {
          title: 'Pós-Venda',
          description: 'Garantir satisfação, fidelização e transformar clientes em promotores da marca.',
          icon: 'gift',
          color: '#06B6D4',
          order: 6,
          positionX: 1600,
          positionY: 100,
        },
      ],
      connections: [
        { from: 0, to: 1, label: 'Converter' },
        { from: 1, to: 2, label: 'Educar' },
        { from: 2, to: 3, label: 'Qualificar' },
        { from: 3, to: 4, label: 'Apresentar' },
        { from: 4, to: 5, label: 'Fechar' },
        { from: 5, to: 6, label: 'Fidelizar' },
      ],
    };
  }

  /**
   * Lista funis do usuário
   */
  async listFunnels(userId: string, userRoles: string[]): Promise<any[]> {
    const isAdmin = userRoles.includes('admin');

    const funnels = await this.prisma.funnel.findMany({
      where: isAdmin ? {} : { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        stages: {
          orderBy: { order: 'asc' },
          include: {
            connectionsFrom: {
              include: {
                toStage: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return funnels;
  }

  /**
   * Busca funil por ID
   */
  async getFunnelById(funnelId: string, userId: string): Promise<any> {
    const funnel = await this.prisma.funnel.findUnique({
      where: { id: funnelId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        stages: {
          orderBy: { order: 'asc' },
          include: {
            connectionsFrom: {
              include: {
                toStage: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
            connectionsTo: {
              include: {
                fromStage: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!funnel) {
      throw new NotFoundError('Funnel not found');
    }

    // Verificar permissão
    if (funnel.userId !== userId) {
      throw new ForbiddenError('You do not have permission to access this funnel');
    }

    return funnel;
  }

  /**
   * Atualiza funil
   */
  async updateFunnel(
    funnelId: string,
    userId: string,
    data: { name?: string; description?: string; isActive?: boolean }
  ): Promise<any> {
    const funnel = await this.prisma.funnel.findUnique({
      where: { id: funnelId },
    });

    if (!funnel) {
      throw new NotFoundError('Funnel not found');
    }

    if (funnel.userId !== userId) {
      throw new ForbiddenError('You do not have permission to update this funnel');
    }

    const updated = await this.prisma.funnel.update({
      where: { id: funnelId },
      data,
    });

    return updated;
  }

  /**
   * Deleta funil
   */
  async deleteFunnel(funnelId: string, userId: string): Promise<void> {
    const funnel = await this.prisma.funnel.findUnique({
      where: { id: funnelId },
    });

    if (!funnel) {
      throw new NotFoundError('Funnel not found');
    }

    if (funnel.userId !== userId) {
      throw new ForbiddenError('You do not have permission to delete this funnel');
    }

    await this.prisma.funnel.delete({
      where: { id: funnelId },
    });

    logger.info(`[FunnelService] Funnel deleted: ${funnelId}`);
  }

  /**
   * Cria nova etapa no funil
   */
  async createStage(
    funnelId: string,
    userId: string,
    data: Omit<FunnelStageData, 'order'>
  ): Promise<any> {
    // Verificar permissão
    const funnel = await this.prisma.funnel.findUnique({
      where: { id: funnelId },
    });

    if (!funnel) {
      throw new NotFoundError('Funnel not found');
    }

    if (funnel.userId !== userId) {
      throw new ForbiddenError('You do not have permission to modify this funnel');
    }

    // Buscar maior order
    const maxOrder = await this.prisma.funnelStage.findFirst({
      where: { funnelId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const stage = await this.prisma.funnelStage.create({
      data: {
        funnelId,
        title: data.title,
        description: data.description,
        icon: data.icon,
        color: data.color,
        order: (maxOrder?.order || -1) + 1,
        positionX: data.positionX,
        positionY: data.positionY,
      },
    });

    return stage;
  }

  /**
   * Atualiza etapa do funil
   */
  async updateStage(
    stageId: string,
    userId: string,
    data: Partial<FunnelStageData>
  ): Promise<any> {
    const stage = await this.prisma.funnelStage.findUnique({
      where: { id: stageId },
      include: { funnel: true },
    });

    if (!stage) {
      throw new NotFoundError('Stage not found');
    }

    if (stage.funnel.userId !== userId) {
      throw new ForbiddenError('You do not have permission to modify this stage');
    }

    const updated = await this.prisma.funnelStage.update({
      where: { id: stageId },
      data,
    });

    return updated;
  }

  /**
   * Deleta etapa do funil
   */
  async deleteStage(stageId: string, userId: string): Promise<void> {
    const stage = await this.prisma.funnelStage.findUnique({
      where: { id: stageId },
      include: { funnel: true },
    });

    if (!stage) {
      throw new NotFoundError('Stage not found');
    }

    if (stage.funnel.userId !== userId) {
      throw new ForbiddenError('You do not have permission to delete this stage');
    }

    await this.prisma.funnelStage.delete({
      where: { id: stageId },
    });
  }

  /**
   * Cria conexão entre etapas
   */
  async createConnection(
    userId: string,
    data: FunnelConnectionData
  ): Promise<any> {
    // Verificar se ambas as etapas existem e pertencem ao mesmo funil
    const fromStage = await this.prisma.funnelStage.findUnique({
      where: { id: data.fromStageId },
      include: { funnel: true },
    });

    const toStage = await this.prisma.funnelStage.findUnique({
      where: { id: data.toStageId },
      include: { funnel: true },
    });

    if (!fromStage || !toStage) {
      throw new NotFoundError('Stage not found');
    }

    if (fromStage.funnelId !== toStage.funnelId) {
      throw new Error('Stages must belong to the same funnel');
    }

    if (fromStage.funnel.userId !== userId) {
      throw new ForbiddenError('You do not have permission to modify this funnel');
    }

    const connection = await this.prisma.funnelConnection.create({
      data: {
        fromStageId: data.fromStageId,
        toStageId: data.toStageId,
        label: data.label,
      },
    });

    return connection;
  }

  /**
   * Deleta conexão entre etapas
   */
  async deleteConnection(connectionId: string, userId: string): Promise<void> {
    const connection = await this.prisma.funnelConnection.findUnique({
      where: { id: connectionId },
      include: {
        fromStage: {
          include: { funnel: true },
        },
      },
    });

    if (!connection) {
      throw new NotFoundError('Connection not found');
    }

    if (connection.fromStage.funnel.userId !== userId) {
      throw new ForbiddenError('You do not have permission to delete this connection');
    }

    await this.prisma.funnelConnection.delete({
      where: { id: connectionId },
    });
  }
}

