# 🎯 Funis Inteligentes

Sistema de geração automática de funis de vendas usando IA, com interface visual interativa.

## 📋 Visão Geral

A funcionalidade "Funis Inteligentes" permite que administradores e gerentes criem funis de vendas estruturados automaticamente, usando inteligência artificial para gerar etapas otimizadas baseadas no nicho de mercado.

## 🔐 Acesso

- **Permissões:** Apenas usuários com cargo de **Administrador** ou **Gerente**
- **Rota:** `/dashboard/funnels`
- **Menu:** Aparece no sidebar como "Funis Inteligentes" (ícone ✨)

## 🤖 Integração com IA

### OpenRouter + Google Gemini 2.0 Flash Experimental

O sistema usa o **OpenRouter** como gateway para acessar o modelo **Google Gemini 2.0 Flash Experimental (gratuito)**.

**Por que OpenRouter?**
- Acesso unificado a múltiplos modelos de IA
- Fallback automático se um modelo falhar
- Sem necessidade de múltiplas API keys
- Gerenciamento de custos centralizado
- Modelo Gemini 2.0 Flash gratuito e ilimitado

#### Configuração:

1. Criar conta no OpenRouter: https://openrouter.ai/
2. Gerar API Key: https://openrouter.ai/keys
3. Adicionar no `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

#### Modelo usado:
- **Nome:** `google/gemini-2.0-flash-exp:free`
- **Provider:** Google via OpenRouter
- **Custo:** Gratuito (sem limites de uso)
- **Velocidade:** Muito rápida (~2-5 segundos)
- **Qualidade:** Excelente para geração de funis estruturados
- **Context Window:** 1M tokens
- **Max Output:** 8K tokens

### Fallback

Se a API key não estiver configurada ou houver erro, o sistema usa um **template padrão** com 7 etapas genéricas:
1. Atração
2. Captura
3. Nutrição
4. Qualificação
5. Oferta
6. Fechamento
7. Pós-Venda

## 🎨 Funcionalidades

### 1. Geração Automática
- Informar nicho de mercado (ex: "E-commerce de moda", "SaaS B2B")
- IA gera funil completo com 5-8 etapas otimizadas
- Etapas incluem: título, descrição, ícone, cor e posicionamento

### 2. Visualização Interativa
- **Mapa mental** com cards conectados
- **Linhas pontilhadas animadas** entre etapas
- **MiniMap** para navegação
- **Controles de zoom** e pan
- **Background grid** para referência

### 3. Personalização Completa

#### Editar Etapas:
- Clicar em qualquer card para editar
- Alterar título, descrição, ícone e cor
- 8 ícones disponíveis
- 8 cores pré-definidas

#### Adicionar Etapas:
- Botão "Adicionar Etapa" no painel
- Posicionamento automático ou manual

#### Conectar Etapas:
- Arrastar de uma etapa para outra
- Criar fluxos lineares ou em árvore
- Labels opcionais nas conexões

#### Reorganizar:
- Drag & drop para mover cards
- Botão "Salvar Posições" para persistir

#### Deletar:
- Deletar etapas individuais
- Deletar funis completos
- Conexões são removidas automaticamente

## 📊 Estrutura do Banco de Dados

### Tabela `funnels`
- `id`: UUID (PK)
- `name`: Nome do funil
- `niche`: Nicho de mercado
- `description`: Descrição
- `userId`: Criador (FK)
- `isActive`: Status
- `createdAt`, `updatedAt`

### Tabela `funnel_stages`
- `id`: UUID (PK)
- `funnelId`: Funil (FK)
- `title`: Título da etapa
- `description`: Descrição
- `icon`: Ícone (lucide-react)
- `color`: Cor hexadecimal
- `order`: Ordem no fluxo
- `positionX`, `positionY`: Posição no canvas
- `createdAt`, `updatedAt`

### Tabela `funnel_connections`
- `id`: UUID (PK)
- `fromStageId`: Etapa origem (FK)
- `toStageId`: Etapa destino (FK)
- `label`: Label opcional
- `createdAt`

## 🔌 API Endpoints

### Gerar Funil
```http
POST /api/v1/funnels/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "niche": "E-commerce de moda",
  "name": "Funil Principal" // opcional
}
```

### Listar Funis
```http
GET /api/v1/funnels
Authorization: Bearer <token>
```

### Buscar Funil
```http
GET /api/v1/funnels/:funnelId
Authorization: Bearer <token>
```

### Atualizar Funil
```http
PATCH /api/v1/funnels/:funnelId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Novo Nome",
  "description": "Nova descrição",
  "isActive": true
}
```

### Deletar Funil
```http
DELETE /api/v1/funnels/:funnelId
Authorization: Bearer <token>
```

### Criar Etapa
```http
POST /api/v1/funnels/:funnelId/stages
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Nova Etapa",
  "description": "Descrição",
  "icon": "target",
  "color": "#3B82F6",
  "positionX": 100,
  "positionY": 100
}
```

### Atualizar Etapa
```http
PATCH /api/v1/funnels/stages/:stageId
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Título Atualizado",
  "description": "Nova descrição",
  "icon": "star",
  "color": "#EF4444",
  "positionX": 200,
  "positionY": 150
}
```

### Deletar Etapa
```http
DELETE /api/v1/funnels/stages/:stageId
Authorization: Bearer <token>
```

### Criar Conexão
```http
POST /api/v1/funnels/connections
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromStageId": "uuid-etapa-origem",
  "toStageId": "uuid-etapa-destino",
  "label": "Próximo passo" // opcional
}
```

### Deletar Conexão
```http
DELETE /api/v1/funnels/connections/:connectionId
Authorization: Bearer <token>
```

## 🎨 Ícones Disponíveis

- `target`: Alvo (🎯)
- `users`: Usuários (👥)
- `mail`: E-mail (✉️)
- `phone`: Telefone (📞)
- `check-circle`: Check (✅)
- `dollar-sign`: Dinheiro (💰)
- `star`: Estrela (⭐)
- `gift`: Presente (🎁)

## 🎨 Cores Pré-definidas

- `#3B82F6`: Azul
- `#8B5CF6`: Roxo
- `#10B981`: Verde
- `#F59E0B`: Laranja
- `#EF4444`: Vermelho
- `#EC4899`: Rosa
- `#06B6D4`: Ciano
- `#6366F1`: Índigo

## 💡 Exemplos de Uso

### E-commerce de Moda
```
Atração → Captura → Nutrição → Qualificação → Oferta → Fechamento → Pós-Venda
```

### SaaS B2B
```
Awareness → Lead Magnet → Trial → Demo → Proposta → Negociação → Onboarding
```

### Infoprodutos
```
Conteúdo Gratuito → Captura de E-mail → Sequência de E-mails → Webinar → Oferta → Checkout → Área de Membros
```

## 🚀 Como Usar

1. **Acessar:** Menu lateral > "Funis Inteligentes"
2. **Gerar:** Clicar em "Gerar Funil com IA"
3. **Informar:** Nicho de mercado (ex: "Consultoria financeira")
4. **Aguardar:** IA gera funil em ~5-10 segundos
5. **Personalizar:** Editar etapas, cores, conexões
6. **Salvar:** Posições e alterações são salvas automaticamente

## 🔧 Tecnologias

- **Backend:** Fastify + Prisma + OpenRouter API
- **Frontend:** React + ReactFlow + TailwindCSS
- **IA:** Google Gemini 2.0 Flash (via OpenRouter)
- **Banco:** PostgreSQL (Supabase)

## ⚠️ Limitações

- Apenas admin e gerente podem acessar
- Máximo de 2000 tokens por geração (suficiente para ~8 etapas)
- Fallback para template padrão se IA falhar
- Requer API key do OpenRouter (gratuita)

## 📈 Roadmap Futuro

- [ ] Exportar funil como imagem/PDF
- [ ] Templates pré-definidos por indústria
- [ ] Análise de conversão por etapa
- [ ] Integração com CRM
- [ ] Compartilhamento de funis entre usuários
- [ ] Versionamento de funis
- [ ] Duplicar funis existentes
- [ ] Importar/exportar JSON

## 🐛 Troubleshooting

### IA não está gerando funis
- Verificar se `OPENROUTER_API_KEY` está configurada no `.env`
- Verificar logs do backend para erros da API
- Sistema usará template padrão como fallback

### Etapas não aparecem no canvas
- Verificar se o funil foi carregado corretamente
- Recarregar a página
- Verificar console do navegador para erros

### Não consigo salvar posições
- Verificar permissões (apenas dono do funil pode editar)
- Verificar conexão com backend
- Verificar logs do backend

## 📞 Suporte

Para dúvidas ou problemas, consulte a documentação completa ou entre em contato com o administrador do sistema.

