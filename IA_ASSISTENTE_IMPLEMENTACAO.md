# 🤖 Sistema de Assistentes de IA - Implementação

## 📋 STATUS: EM PROGRESSO (50%)

### ✅ O QUE JÁ FOI IMPLEMENTADO:

#### 1. Backend - Banco de Dados
- ✅ Modelo `AIAssistant` criado no Prisma
- ✅ Campos: nome, apiKey (criptografada), modelo, instruções, temperatura, maxTokens, memoryContext, memoryCacheDays
- ✅ Relação com `WhatsAppConnection` (aiEnabled, aiAssistantId)
- ✅ Índices para performance

#### 2. Backend - Service de IA
- ✅ `AIService` completo com:
  - Criptografia/Descriptografia de API Keys
  - CRUD de assistentes
  - Integração com OpenAI
  - Sistema de memória com Redis (20 mensagens, 1 dia)
  - Geração de respostas automáticas

#### 3. Backend - Rotas API
- ✅ GET `/api/ai` - Listar assistentes
- ✅ GET `/api/ai/:id` - Buscar assistente
- ✅ POST `/api/ai` - Criar assistente
- ✅ PATCH `/api/ai/:id` - Atualizar assistente
- ✅ DELETE `/api/ai/:id` - Deletar assistente
- ✅ DELETE `/api/ai/memory/:conversationId` - Limpar memória

#### 4. Dependências
- ✅ Pacote `openai` instalado

---

## 🚧 O QUE FALTA IMPLEMENTAR:

### 1. Backend - Integração com Mensagens
**Arquivo:** `src/services/message.service.ts`

Adicionar lógica para responder automaticamente quando IA está ativa:

```typescript
async processIncomingMessage(...) {
  // ... código existente ...
  
  // Após salvar mensagem, verificar se deve responder com IA
  const connection = await this.prisma.whatsAppConnection.findUnique({
    where: { id: connectionId },
    select: { aiEnabled: true, aiAssistantId: true }
  });
  
  if (connection?.aiEnabled && connection?.aiAssistantId && !isFromMe) {
    // Gerar resposta da IA
    const aiService = new AIService();
    const aiResponse = await aiService.generateResponse(
      conversation.id,
      messageText,
      connection.aiAssistantId
    );
    
    // Enviar resposta
    await this.sendMessage({
      conversationId: conversation.id,
      content: aiResponse,
      messageType: 'text'
    }, 'system');
  }
}
```

### 2. Backend - Atualizar Rotas de Conexão
**Arquivo:** `src/routes/whatsapp.routes.ts`

Adicionar endpoints para ativar/desativar IA:

```typescript
// Atualizar conexão para incluir IA
app.patch('/:id', async (request, reply) => {
  const { aiEnabled, aiAssistantId } = request.body;
  // ... atualizar conexão
});
```

### 3. Backend - Registrar Rotas
**Arquivo:** `src/app.ts`

Adicionar rota de IA:

```typescript
import { aiRoutes } from './routes/ai.routes.js';

app.register(aiRoutes, { prefix: '/api/ai' });
```

### 4. Frontend - Página de Gerenciamento de IAs
**Arquivo:** `src/pages/AIAssistants.tsx` (CRIAR)

Componente React com:
- Lista de assistentes
- Formulário de criar/editar
- Campos: Nome, API Key, Modelo (dropdown), Instruções (textarea)
- Opções avançadas: Temperature, MaxTokens, MemoryContext, MemoryCacheDays

### 5. Frontend - Atualizar Página de Conexões
**Arquivo:** `src/pages/Connections.tsx`

Adicionar no formulário de editar conexão:
- Toggle Switch "Ativar IA"
- Quando ativo, mostrar dropdown com assistentes disponíveis
- Salvar `aiEnabled` e `aiAssistantId`

### 6. Frontend - Rota no Menu
**Arquivo:** `src/routes/index.tsx`

Adicionar link "Assistentes de IA" no menu admin.

---

## 📝 PRÓXIMOS PASSOS:

### Passo 1: Migrar Banco de Dados
```bash
cd Tom/backend
npx prisma migrate dev --name add_ai_assistants
```

### Passo 2: Completar Backend
1. Adicionar lógica de resposta automática em `message.service.ts`
2. Registrar rotas de IA em `app.ts`
3. Testar endpoints com Postman/Insomnia

### Passo 3: Criar Frontend
1. Criar página `AIAssistants.tsx`
2. Criar componente `AIForm.tsx`
3. Atualizar `Connections.tsx` com toggle e dropdown
4. Adicionar rota no menu

### Passo 4: Testar Sistema
1. Criar um assistente de IA
2. Ativar IA em uma conexão
3. Enviar mensagem no WhatsApp
4. Verificar se IA responde automaticamente

---

## 🔧 CONFIGURAÇÃO NECESSÁRIA:

### Variáveis de Ambiente
Adicionar ao `.env`:

```env
# Chave para criptografar API Keys das IAs
AI_ENCRYPTION_KEY=your-32-char-secret-key-here!!!
```

---

## 📊 EXEMPLO DE USO:

### 1. Criar Assistente
```json
POST /api/ai
{
  "name": "Atendente Virtual Loja",
  "apiKey": "sk-....", 
  "model": "gpt-4",
  "instructions": "Você é um atendente virtual de uma loja online. Seja educado, prestativo e sempre termine oferecendo ajuda adicional.",
  "temperature": 0.7,
  "maxTokens": 500,
  "memoryContext": 20,
  "memoryCacheDays": 1
}
```

### 2. Ativar IA na Conexão
```json
PATCH /api/whatsapp/:connectionId
{
  "aiEnabled": true,
  "aiAssistantId": "uuid-do-assistente"
}
```

### 3. Fluxo Automático
```
Cliente: "Olá, quero comprar um produto"
    ↓
Sistema salva mensagem
    ↓
Verifica: aiEnabled = true
    ↓
Chama AIService.generateResponse()
    ↓
OpenAI gera resposta baseada nas instruções
    ↓
Sistema envia resposta automaticamente
    ↓
Cliente: recebe "Olá! Fico feliz em ajudar. Que tipo de produto você procura?"
```

---

## 🎯 MODELOS DISPONÍVEIS:

- `gpt-4` - Melhor qualidade, mais caro
- `gpt-4-turbo` - Rápido e eficiente
- `gpt-3.5-turbo` - Econômico
- `gpt-4o` - Mais recente (se disponível)
- `gpt-4o-mini` - Versão mini mais rápida

---

## 💡 FUNCIONALIDADES EXTRAS (FUTURO):

- [ ] Análise de sentimento das mensagens
- [ ] Escalação automática para humano se IA não souber responder
- [ ] Relatórios de desempenho da IA
- [ ] Treinar IA com conversas antigas
- [ ] Múltiplas IAs por conexão (fallback)
- [ ] Webhooks para notificar quando IA responde

---

## 🔒 SEGURANÇA:

- ✅ API Keys criptografadas no banco (AES-256)
- ✅ Apenas admins podem gerenciar IAs
- ✅ API Keys nunca retornadas nas respostas
- ✅ Validação de API Key ao criar/editar

---

## 📚 DOCUMENTAÇÃO OPENAI:

- Chat Completions: https://platform.openai.com/docs/api-reference/chat
- Models: https://platform.openai.com/docs/models
- Best Practices: https://platform.openai.com/docs/guides/prompt-engineering

---

**Sistema 50% implementado. Próximo: Completar integração e criar frontend.**
