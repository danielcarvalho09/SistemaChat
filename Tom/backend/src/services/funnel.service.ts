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
  whatsappGuidance?: string;
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
      logger.info(`[FunnelService] ========== INICIANDO GERAÇÃO DE FUNIL ==========`);
      logger.info(`[FunnelService] Niche: ${data.niche}`);
      logger.info(`[FunnelService] Name: ${data.name || 'Não informado'}`);
      logger.info(`[FunnelService] UserId: ${userId}`);

      // ✅ Gerar estrutura do funil usando IA
      logger.info(`[FunnelService] Chamando generateFunnelWithAI...`);
      const funnelStructure = await this.generateFunnelWithAI(data.niche);
      
      logger.info(`[FunnelService] ✅ Estrutura do funil recebida da IA`);
      logger.info(`[FunnelService] Description: ${funnelStructure.description}`);
      logger.info(`[FunnelService] Total de stages: ${funnelStructure.stages?.length || 0}`);
      logger.info(`[FunnelService] Total de connections: ${funnelStructure.connections?.length || 0}`);

      // ✅ Validar e logar cada stage
      if (funnelStructure.stages && Array.isArray(funnelStructure.stages)) {
        funnelStructure.stages.forEach((stage: any, index: number) => {
          logger.info(`[FunnelService] Stage ${index}:`);
          logger.info(`  - Title: ${stage.title}`);
          logger.info(`  - Description: ${stage.description || 'N/A'}`);
          logger.info(`  - WhatsAppGuidance: ${stage.whatsappGuidance ? `SIM (${stage.whatsappGuidance.length} chars)` : 'NÃO'}`);
          logger.info(`  - Icon: ${stage.icon}`);
          logger.info(`  - Color: ${stage.color}`);
          logger.info(`  - Order: ${stage.order}`);
          logger.info(`  - PositionX: ${stage.positionX}`);
          logger.info(`  - PositionY: ${stage.positionY}`);
        });
      } else {
        logger.error(`[FunnelService] ❌ ERRO: stages não é um array válido!`);
        logger.error(`[FunnelService] Tipo recebido: ${typeof funnelStructure.stages}`);
        logger.error(`[FunnelService] Valor: ${JSON.stringify(funnelStructure.stages)}`);
      }

      // ✅ Criar funil no banco
      logger.info(`[FunnelService] Criando funil no banco de dados...`);
      const funnel = await this.prisma.funnel.create({
        data: {
          name: data.name || `Funil ${data.niche}`,
          niche: data.niche,
          description: funnelStructure.description,
          userId,
        },
      });
      logger.info(`[FunnelService] ✅ Funil criado no banco: ${funnel.id}`);

      // ✅ Criar etapas do funil
      logger.info(`[FunnelService] Criando ${funnelStructure.stages?.length || 0} etapas...`);
      const stageIds: Record<number, string> = {};
      for (const stageData of funnelStructure.stages || []) {
        logger.info(`[FunnelService] Criando stage: ${stageData.title}`);
        logger.info(`[FunnelService]   - whatsappGuidance presente: ${!!stageData.whatsappGuidance}`);
        logger.info(`[FunnelService]   - whatsappGuidance length: ${stageData.whatsappGuidance?.length || 0}`);
        logger.info(`[FunnelService]   - positionX: ${stageData.positionX}, positionY: ${stageData.positionY}`);
        
        const stage = await this.prisma.funnelStage.create({
          data: {
            funnelId: funnel.id,
            title: stageData.title,
            description: stageData.description,
            whatsappGuidance: stageData.whatsappGuidance || null,
            icon: stageData.icon,
            color: stageData.color,
            order: stageData.order,
            positionX: stageData.positionX,
            positionY: stageData.positionY,
          },
        });
        stageIds[stageData.order] = stage.id;
        logger.info(`[FunnelService] ✅ Stage criado: ${stage.id} com whatsappGuidance: ${!!stage.whatsappGuidance}`);
      }

      // ✅ Criar conexões entre etapas
      logger.info(`[FunnelService] Criando ${funnelStructure.connections?.length || 0} conexões...`);
      for (const connection of funnelStructure.connections || []) {
        await this.prisma.funnelConnection.create({
          data: {
            fromStageId: stageIds[connection.from],
            toStageId: stageIds[connection.to],
            label: connection.label || null,
          },
        });
        logger.info(`[FunnelService] ✅ Conexão criada: ${connection.from} -> ${connection.to}`);
      }

      logger.info(`[FunnelService] ✅ Funnel criado com sucesso: ${funnel.id}`);
      logger.info(`[FunnelService] Buscando funil completo do banco...`);

      const fullFunnel = await this.getFunnelById(funnel.id, userId);
      
      // ✅ Logar o funil completo retornado
      logger.info(`[FunnelService] ========== FUNIL COMPLETO RETORNADO ==========`);
      logger.info(`[FunnelService] Funil ID: ${fullFunnel.id}`);
      logger.info(`[FunnelService] Total de stages no retorno: ${fullFunnel.stages?.length || 0}`);
      if (fullFunnel.stages && Array.isArray(fullFunnel.stages)) {
        fullFunnel.stages.forEach((stage: any, index: number) => {
          logger.info(`[FunnelService] Stage ${index} retornado:`);
          logger.info(`  - ID: ${stage.id}`);
          logger.info(`  - Title: ${stage.title}`);
          logger.info(`  - WhatsAppGuidance: ${stage.whatsappGuidance ? `SIM (${stage.whatsappGuidance.length} chars)` : 'NÃO'}`);
          logger.info(`  - PositionX: ${stage.positionX}, PositionY: ${stage.positionY}`);
        });
      }

      return fullFunnel;
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
    const prompt = `Você é um especialista em funis de vendas e marketing digital, com foco especial em atendimento via WhatsApp.

Crie um funil de vendas completo e estruturado para o nicho: "${niche}".

O funil deve ter entre 5 e 8 etapas, seguindo as melhores práticas de conversão.

⚠️ ATENÇÃO CRÍTICA: Cada etapa DEVE incluir o campo "whatsappGuidance" com conteúdo detalhado e específico!

Retorne APENAS um JSON válido no seguinte formato (sem explicações adicionais, sem markdown, apenas JSON puro):

{
  "description": "Descrição breve do funil (1 frase)",
  "stages": [
    {
      "title": "Nome da Etapa",
      "description": "Descrição breve da etapa (1-2 frases)",
      "whatsappGuidance": "OBRIGATÓRIO: Detalhes específicos de como implementar esta etapa em um atendimento WhatsApp para o nicho ${niche}. Inclua: (1) Mensagens de exemplo reais e específicas, (2) Tom de voz adequado, (3) Quando e como enviar, (4) Como responder objeções comuns, (5) Scripts de diálogo completos, (6) Timing e frequência. Mínimo 300 caracteres, idealmente 500-800 caracteres. Seja específico para o nicho ${niche}.",
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

REGRAS CRÍTICAS (NÃO IGNORE):
1. ✅ OBRIGATÓRIO: Cada etapa DEVE ter "whatsappGuidance" preenchido com conteúdo detalhado (mínimo 300 chars)
2. ✅ whatsappGuidance deve ser ESPECÍFICO para o nicho "${niche}" - não use conteúdo genérico
3. ✅ whatsappGuidance deve incluir: mensagens de exemplo, tom de voz, timing, objeções, scripts
4. ✅ Etapas devem seguir ordem lógica de conversão
5. ✅ Cores devem ser distintas e representativas (use hex codes válidos)
6. ✅ PositionX e PositionY serão ajustados automaticamente - você pode usar valores iniciais
7. ✅ Ícones devem ser um destes: target, users, mail, phone, check-circle, dollar-sign, star, gift
8. ✅ Conexões devem ligar etapas sequencialmente (0->1, 1->2, etc.)

EXEMPLO de whatsappGuidance para uma etapa de "Qualificação" no nicho "E-commerce de moda":
"No WhatsApp, faça perguntas estratégicas para qualificar leads de moda: 'Qual estilo você mais gosta? Casual, formal ou esportivo?' 'Qual é o seu tamanho preferido?' 'Você costuma comprar online ou prefere ver pessoalmente?' Identifique sinais de compra: mencionar eventos próximos, necessidade urgente de peças, orçamento disponível. Leads qualificados demonstram interesse ativo fazendo perguntas sobre produtos específicos, cores e disponibilidade. Use tom amigável e consultivo, nunca pressione."`;

    try {
      // ✅ Verificar se há API key do OpenRouter configurada
      const apiKey = process.env.OPENROUTER_API_KEY;
      
      if (!apiKey) {
        logger.warn('[FunnelService] No OpenRouter API key configured, using default funnel template');
        return this.getDefaultFunnelTemplate(niche);
      }

      // ✅ Usar OpenRouter com modelo Google Gemini 2.0 Flash
      logger.info('[FunnelService] ========== CHAMANDO OPENROUTER API ==========');
      logger.info(`[FunnelService] Model: google/gemini-2.0-flash-exp:free`);
      logger.info(`[FunnelService] Niche: ${niche}`);
      logger.info(`[FunnelService] Prompt length: ${prompt.length} caracteres`);
      logger.info(`[FunnelService] Primeiros 300 chars do prompt: ${prompt.substring(0, 300)}...`);
      
      const requestBody = {
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um especialista em funis de vendas e marketing digital. Retorne APENAS JSON válido, sem markdown, sem explicações, sem texto adicional. Apenas o JSON puro.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000, // ✅ Aumentado para garantir que whatsappGuidance completo seja retornado
      };
      
      logger.info(`[FunnelService] Request body: ${JSON.stringify(requestBody).substring(0, 500)}...`);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      logger.info(`[FunnelService] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[FunnelService] OpenRouter API error: ${response.status} ${response.statusText}`);
        logger.error(`[FunnelService] Error body: ${errorText}`);
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const result = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      const content = result.choices?.[0]?.message?.content || '';
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d14fd2c5-840b-4c87-b90e-3bfa45b7cf47',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'funnel.service.ts:248',message:'Raw content received from API',data:{contentLength:content.length,first500:content.substring(0,500),last200:content.substring(Math.max(0,content.length-200)),hasJsonMarkdown:content.includes('```json'),hasTripleBackticks:content.includes('```')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      logger.info(`[FunnelService] ========== RESPOSTA DA IA ==========`);
      logger.info(`[FunnelService] Tamanho total da resposta: ${content.length} caracteres`);
      logger.info(`[FunnelService] Primeiros 500 caracteres: ${content.substring(0, 500)}`);
      logger.info(`[FunnelService] Últimos 200 caracteres: ${content.substring(Math.max(0, content.length - 200))}`);
      
      // ✅ Limpar markdown se houver
      let jsonContent = content.trim();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d14fd2c5-840b-4c87-b90e-3bfa45b7cf47',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'funnel.service.ts:256',message:'Before markdown cleaning',data:{length:jsonContent.length,first100:jsonContent.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      logger.info(`[FunnelService] Limpando markdown...`);
      const beforeClean = jsonContent.length;
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const afterClean = jsonContent.length;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d14fd2c5-840b-4c87-b90e-3bfa45b7cf47',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'funnel.service.ts:259',message:'After markdown cleaning',data:{beforeLength:beforeClean,afterLength:afterClean,first100:jsonContent.substring(0,100),last100:jsonContent.substring(Math.max(0,jsonContent.length-100))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      logger.info(`[FunnelService] Tamanho antes: ${beforeClean}, depois: ${afterClean}`);
      
      // ✅ Tentar extrair JSON se houver texto antes/depois
      logger.info(`[FunnelService] Extraindo JSON...`);
      
      // #region agent log
      const jsonMatches = jsonContent.match(/\{[\s\S]*\}/g);
      fetch('http://127.0.0.1:7242/ingest/d14fd2c5-840b-4c87-b90e-3bfa45b7cf47',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'funnel.service.ts:265',message:'JSON extraction attempt',data:{allMatchesCount:jsonMatches?.length||0,hasFirstBrace:jsonContent.includes('{'),hasLastBrace:jsonContent.includes('}'),contentLength:jsonContent.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d14fd2c5-840b-4c87-b90e-3bfa45b7cf47',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'funnel.service.ts:267',message:'JSON extracted by regex',data:{extractedLength:jsonContent.length,first50:jsonContent.substring(0,50),last50:jsonContent.substring(Math.max(0,jsonContent.length-50)),startsWithBrace:jsonContent.startsWith('{'),endsWithBrace:jsonContent.endsWith('}')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        logger.info(`[FunnelService] ✅ JSON extraído com sucesso (${jsonContent.length} chars)`);
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d14fd2c5-840b-4c87-b90e-3bfa45b7cf47',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'funnel.service.ts:270',message:'JSON extraction failed',data:{contentLength:jsonContent.length,fullContent:jsonContent.substring(0,1000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        logger.error(`[FunnelService] ❌ ERRO: Não foi possível extrair JSON da resposta!`);
        logger.error(`[FunnelService] Conteúdo após limpeza: ${jsonContent.substring(0, 500)}`);
      }
      
      logger.info(`[FunnelService] Fazendo parse do JSON...`);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d14fd2c5-840b-4c87-b90e-3bfa45b7cf47',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'funnel.service.ts:275',message:'Before JSON.parse',data:{jsonContentLength:jsonContent.length,first100:jsonContent.substring(0,100),last100:jsonContent.substring(Math.max(0,jsonContent.length-100)),braceCount:jsonContent.split('{').length-1,closeBraceCount:jsonContent.split('}').length-1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      let funnelData;
      try {
        funnelData = JSON.parse(jsonContent);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d14fd2c5-840b-4c87-b90e-3bfa45b7cf47',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'funnel.service.ts:275',message:'JSON.parse succeeded',data:{hasDescription:!!funnelData.description,stagesCount:funnelData.stages?.length||0,connectionsCount:funnelData.connections?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      } catch (parseError: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d14fd2c5-840b-4c87-b90e-3bfa45b7cf47',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'funnel.service.ts:275',message:'JSON.parse failed',data:{errorMessage:parseError?.message||'unknown',errorName:parseError?.name||'unknown',jsonContentLength:jsonContent.length,jsonContentFirst500:jsonContent.substring(0,500),jsonContentLast500:jsonContent.substring(Math.max(0,jsonContent.length-500))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        throw parseError;
      }
      logger.info(`[FunnelService] ✅ JSON parseado com sucesso`);
      logger.info(`[FunnelService] Estrutura recebida:`);
      logger.info(`  - description: ${funnelData.description || 'N/A'}`);
      logger.info(`  - stages: ${funnelData.stages ? `${funnelData.stages.length} items` : 'N/A'}`);
      logger.info(`  - connections: ${funnelData.connections ? `${funnelData.connections.length} items` : 'N/A'}`);

      // ✅ Validar e logar stages ANTES do layout
      if (funnelData.stages && Array.isArray(funnelData.stages)) {
        logger.info(`[FunnelService] ========== STAGES ANTES DO LAYOUT ==========`);
        funnelData.stages.forEach((stage: any, index: number) => {
          logger.info(`[FunnelService] Stage ${index} (antes layout):`);
          logger.info(`  - Title: ${stage.title}`);
          logger.info(`  - WhatsAppGuidance: ${stage.whatsappGuidance ? `SIM (${stage.whatsappGuidance.length} chars)` : 'NÃO'}`);
          logger.info(`  - PositionX original: ${stage.positionX}`);
          logger.info(`  - PositionY original: ${stage.positionY}`);
        });
      }

      // ✅ Aplicar layout automático para distribuir nodes de forma orgânica
      logger.info(`[FunnelService] Aplicando layout orgânico...`);
      funnelData.stages = this.applyOrganicLayout(funnelData.stages);
      logger.info(`[FunnelService] ✅ Layout orgânico aplicado`);

      // ✅ Validar e logar stages DEPOIS do layout
      if (funnelData.stages && Array.isArray(funnelData.stages)) {
        logger.info(`[FunnelService] ========== STAGES DEPOIS DO LAYOUT ==========`);
        funnelData.stages.forEach((stage: any, index: number) => {
          logger.info(`[FunnelService] Stage ${index} (depois layout):`);
          logger.info(`  - Title: ${stage.title}`);
          logger.info(`  - WhatsAppGuidance: ${stage.whatsappGuidance ? `SIM (${stage.whatsappGuidance.length} chars)` : 'NÃO'}`);
          logger.info(`  - PositionX: ${stage.positionX}`);
          logger.info(`  - PositionY: ${stage.positionY}`);
        });
      }

      logger.info('[FunnelService] ✅ Funnel generated by AI (OpenRouter + Gemini 2.0 Flash)');
      logger.info(`[FunnelService] Total de stages gerados: ${funnelData.stages?.length || 0}`);
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
   * Aplica layout orgânico aos stages, distribuindo-os de forma similar ao n8n
   * Cada etapa fica em uma posição diferente, criando um fluxo visual interessante
   */
  private applyOrganicLayout(stages: any[]): any[] {
    logger.info(`[FunnelService] applyOrganicLayout: Recebidos ${stages?.length || 0} stages`);
    
    if (!stages || stages.length === 0) {
      logger.warn(`[FunnelService] applyOrganicLayout: Nenhum stage para processar`);
      return stages;
    }

    const horizontalSpacing = 300; // Espaçamento horizontal entre nodes
    const startX = 100;
    const startY = 150;

    logger.info(`[FunnelService] applyOrganicLayout: Aplicando layout com spacing=${horizontalSpacing}, startX=${startX}, startY=${startY}`);

    // Distribuir nodes em um padrão orgânico (não linear)
    // Criar um layout em "zigzag" ou "ondulado" para visual mais interessante
    const result = stages.map((stage, index) => {
      // Calcular posição X (progressão horizontal)
      const x = startX + index * horizontalSpacing;
      
      // Calcular posição Y (variação vertical para criar movimento orgânico)
      // Usar seno para criar um padrão ondulado
      const waveOffset = Math.sin(index * 0.8) * 120; // Variação de ±120px
      const y = startY + waveOffset + (index % 3) * 40; // Adicionar variação adicional
      
      const newStage = {
        ...stage,
        positionX: Math.round(x),
        positionY: Math.round(y),
      };
      
      logger.info(`[FunnelService] applyOrganicLayout: Stage ${index} "${stage.title}"`);
      logger.info(`  - Posição original: X=${stage.positionX}, Y=${stage.positionY}`);
      logger.info(`  - Posição calculada: X=${newStage.positionX}, Y=${newStage.positionY}`);
      logger.info(`  - WhatsAppGuidance preservado: ${!!newStage.whatsappGuidance}`);
      
      return newStage;
    });
    
    logger.info(`[FunnelService] applyOrganicLayout: ✅ Layout aplicado a ${result.length} stages`);
    return result;
  }

  /**
   * Template padrão de funil (fallback se IA não estiver disponível)
   */
  private getDefaultFunnelTemplate(niche: string): any {
    const template = {
      description: `Funil de vendas estruturado para ${niche}`,
      stages: [
        {
          title: 'Atração',
          description: 'Captar atenção do público-alvo através de conteúdo relevante e anúncios direcionados.',
          whatsappGuidance: 'No WhatsApp, inicie com uma mensagem de valor que desperte interesse. Use tom amigável e profissional. Exemplo: "Olá! Vi que você se interessou por [produto/serviço]. Tenho algo especial que pode te ajudar..." Responda rapidamente (até 5 minutos) e faça perguntas abertas para entender a necessidade do cliente.',
          icon: 'target',
          color: '#3B82F6',
          order: 0,
          positionX: 0, // Será ajustado pelo applyOrganicLayout
          positionY: 0,
        },
        {
          title: 'Captura',
          description: 'Converter visitantes em leads através de formulários, landing pages e iscas digitais.',
          whatsappGuidance: 'No WhatsApp, capture o interesse do lead oferecendo algo de valor imediato. Exemplo: "Olá! Tenho um material exclusivo que pode te ajudar com [problema]. Posso enviar?" Use mensagens curtas, objetivas e com emojis para aumentar engajamento. Após o lead aceitar, colete informações básicas de forma natural.',
          icon: 'users',
          color: '#8B5CF6',
          order: 1,
          positionX: 0,
          positionY: 0,
        },
        {
          title: 'Nutrição',
          description: 'Educar e engajar leads através de e-mails, conteúdos e interações personalizadas.',
          whatsappGuidance: 'No WhatsApp, envie conteúdo educativo regularmente (2-3x por semana). Compartilhe dicas, cases de sucesso, vídeos explicativos. Use tom consultivo, não vendedor. Faça perguntas para entender melhor o lead: "Como você tem lidado com [problema]?" Responda sempre de forma personalizada, nunca use mensagens genéricas em massa.',
          icon: 'mail',
          color: '#10B981',
          order: 2,
          positionX: 0,
          positionY: 0,
        },
        {
          title: 'Qualificação',
          description: 'Identificar leads prontos para compra através de scoring e análise de comportamento.',
          whatsappGuidance: 'No WhatsApp, faça perguntas estratégicas para qualificar: "Qual é o maior desafio que você enfrenta hoje?" "Qual seria o impacto se você resolvesse isso?" "Qual o prazo ideal para implementar uma solução?" Identifique sinais de compra: urgência, orçamento disponível, autoridade para decidir. Leads qualificados demonstram interesse ativo e fazem perguntas específicas.',
          icon: 'check-circle',
          color: '#F59E0B',
          order: 3,
          positionX: 0,
          positionY: 0,
        },
        {
          title: 'Oferta',
          description: 'Apresentar solução ideal com proposta de valor clara e call-to-action forte.',
          whatsappGuidance: 'No WhatsApp, apresente a oferta de forma personalizada, destacando benefícios específicos para o lead. Use linguagem clara e evite jargões. Exemplo: "Com base no que você me contou, nossa solução pode te ajudar a [benefício específico]. Quer que eu te mostre como funciona?" Inclua prova social (testemunhos, números) e crie urgência quando apropriado. Seja transparente sobre valores e condições.',
          icon: 'dollar-sign',
          color: '#EF4444',
          order: 4,
          positionX: 0,
          positionY: 0,
        },
        {
          title: 'Fechamento',
          description: 'Converter leads qualificados em clientes através de negociação e superação de objeções.',
          whatsappGuidance: 'No WhatsApp, identifique e trate objeções com empatia. Para preço: "Entendo sua preocupação. Vamos pensar no retorno que você terá..." Para tempo: "Que tal começarmos com um piloto de 30 dias?" Use perguntas de fechamento: "Faz sentido para você?" "Qual seria o próximo passo ideal?" Crie facilidades: parcelamento, garantia, suporte. Seja assertivo mas nunca pressione. O timing certo é fundamental.',
          icon: 'star',
          color: '#EC4899',
          order: 5,
          positionX: 0,
          positionY: 0,
        },
        {
          title: 'Pós-Venda',
          description: 'Garantir satisfação, fidelização e transformar clientes em promotores da marca.',
          whatsappGuidance: 'No WhatsApp, mantenha contato após a venda. Envie mensagens de acompanhamento: "Como está sendo a experiência?" "Precisa de ajuda com algo?" Ofereça suporte proativo e resolva problemas rapidamente. Peça feedback e use para melhorar. Após resultados positivos, peça indicações: "Que tal compartilhar sua experiência com outros que possam se beneficiar?" Transforme clientes satisfeitos em embaixadores da marca.',
          icon: 'gift',
          color: '#06B6D4',
          order: 6,
          positionX: 0,
          positionY: 0,
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

    // ✅ Aplicar layout orgânico ao template padrão também
    template.stages = this.applyOrganicLayout(template.stages);
    return template;
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
    logger.info(`[FunnelService] getFunnelById: Buscando funil ${funnelId} para usuário ${userId}`);
    
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
    
    logger.info(`[FunnelService] getFunnelById: Funil encontrado: ${!!funnel}`);
    if (funnel) {
      logger.info(`[FunnelService] getFunnelById: Total de stages: ${funnel.stages?.length || 0}`);
      if (funnel.stages && Array.isArray(funnel.stages)) {
        funnel.stages.forEach((stage: any, index: number) => {
          logger.info(`[FunnelService] getFunnelById: Stage ${index} do banco:`);
          logger.info(`  - ID: ${stage.id}`);
          logger.info(`  - Title: ${stage.title}`);
          logger.info(`  - WhatsAppGuidance no banco: ${stage.whatsappGuidance ? `SIM (${stage.whatsappGuidance.length} chars)` : 'NÃO'}`);
          logger.info(`  - PositionX: ${stage.positionX}, PositionY: ${stage.positionY}`);
        });
      }
    }

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
        whatsappGuidance: data.whatsappGuidance || null,
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

