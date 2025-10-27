# Sistema de Disparo de Mensagens em Massa

## 📋 Visão Geral

Sistema completo para disparo de mensagens em massa via WhatsApp com as seguintes funcionalidades:

- ✅ **Disparo de Mensagens**: Envie mensagens para listas de contatos
- ✅ **Listas de Contatos**: Crie e gerencie múltiplas listas
- ✅ **Importação CSV**: Importe contatos em massa via arquivo CSV
- ✅ **Intervalos Randomicos**: Configure intervalos entre envios para evitar spam
- ✅ **ID Único**: Cada mensagem recebe um ID único para evitar detecção de spam
- ✅ **Histórico**: Acompanhe todos os disparos realizados
- ✅ **Mídia**: Suporte para envio de imagens e documentos

## 🚀 Instalação

### 1. Atualizar o Schema do Prisma

O schema já foi atualizado com os novos models. Execute a migration:

```powershell
cd backend
npx prisma migrate dev --name add_broadcast_system
```

### 2. Instalar Dependências (se necessário)

No backend, certifique-se de ter o multer instalado para upload de arquivos CSV:

```powershell
cd backend
npm install multer
npm install -D @types/multer
```

### 3. Registrar as Rotas

**IMPORTANTE**: O projeto usa Fastify, não Express. As rotas precisam ser adaptadas.

Adicione no arquivo `backend/src/routes/index.ts`:

```typescript
import broadcastRoutes from './broadcast.routes';
import contactListRoutes from './contact-list.routes';

// No registerRoutes:
await fastify.register(broadcastRoutes, { prefix: `${apiPrefix}/broadcast` });
await fastify.register(contactListRoutes, { prefix: `${apiPrefix}/contact-lists` });
```

**NOTA**: Os controllers e rotas criados usam Express. Você precisará adaptá-los para Fastify ou criar versões Fastify.

## 📁 Estrutura de Arquivos Criados

### Backend

```
backend/src/
├── controllers/
│   ├── broadcast.controller.ts          # Controller de broadcast
│   └── contact-list.controller.ts       # Controller de listas
├── services/
│   ├── broadcast.service.ts             # Lógica de disparo
│   └── contact-list.service.ts          # Lógica de listas
├── routes/
│   ├── broadcast.routes.ts              # Rotas de broadcast
│   └── contact-list.routes.ts           # Rotas de listas
└── prisma/
    └── schema.prisma                     # Schema atualizado
```

### Frontend

```
frontend/src/pages/admin/
├── Broadcast.tsx                # Página de disparo
├── ContactLists.tsx             # Página de listas
├── BroadcastSettings.tsx        # Página de configurações
├── AdminLayout.tsx              # Menu atualizado
└── routes/AdminRoutes.tsx       # Rotas atualizadas
```

## 🎯 Funcionalidades

### 1. Listas de Contatos

**Criar Lista**:
- Nome e descrição
- Adicionar contatos manualmente
- Importar via CSV

**Formato CSV**:
```csv
nome,telefone
João Silva,5516999999999
Maria Santos,5516988888888
```

Ou apenas telefones:
```csv
5516999999999
5516988888888
```

### 2. Disparo de Mensagens

**Campos**:
- Lista de contatos (obrigatório)
- Conexão WhatsApp (obrigatório)
- Mensagem (obrigatório)
- Mídia (opcional): URL de imagem ou documento

**ID Único**:
- Automaticamente adicionado ao final de cada mensagem
- Formato: `_abc123def456_`
- Evita detecção de spam pelo WhatsApp

### 3. Configuração de Intervalos

**Intervalos Recomendados**:
- Pequeno (até 50): 3-8 segundos
- Médio (50-200): 5-15 segundos
- Grande (200+): 10-30 segundos

**Cálculo**:
- Intervalo aleatório entre min e max
- Tempo estimado = (min + max) / 2 * quantidade

### 4. Histórico

Acompanhe:
- Status (pendente, em andamento, concluído, cancelado, falhou)
- Total de contatos
- Mensagens enviadas
- Mensagens com falha
- Data e hora

## 🔧 API Endpoints

### Broadcast

```
POST   /api/broadcast                    # Iniciar disparo
GET    /api/broadcast/history            # Histórico
GET    /api/broadcast/:id                # Detalhes
POST   /api/broadcast/:id/cancel         # Cancelar
GET    /api/broadcast/config/interval    # Obter config
PUT    /api/broadcast/config/interval    # Atualizar config
```

### Listas de Contatos

```
POST   /api/contact-lists                # Criar lista
GET    /api/contact-lists                # Listar todas
GET    /api/contact-lists/:id            # Detalhes
PUT    /api/contact-lists/:id            # Atualizar
DELETE /api/contact-lists/:id            # Deletar
POST   /api/contact-lists/:id/contacts   # Adicionar contatos
DELETE /api/contact-lists/:id/contacts/:contactId  # Remover contato
POST   /api/contact-lists/:id/import     # Importar CSV
```

## 📊 Models do Prisma

### ContactList
- id, name, description, userId
- Relação: contacts[], broadcasts[]

### ListContact
- id, listId, name, phone
- Relação: list, broadcastLogs[]

### Broadcast
- id, userId, connectionId, listId
- message, mediaUrl, mediaType
- totalContacts, sentCount, failedCount
- status, startedAt, completedAt
- Relação: list, logs[]

### BroadcastLog
- id, broadcastId, contactId
- status, error, sentAt
- Relação: broadcast, contact

### BroadcastConfig
- id, userId (unique)
- minInterval, maxInterval

## ⚠️ Avisos Importantes

### WhatsApp Policies
- ✅ Respeite as políticas do WhatsApp
- ✅ Não envie spam
- ✅ Obtenha consentimento dos contatos
- ✅ Use intervalos adequados

### Limitações
- O WhatsApp pode bloquear números que enviam muitas mensagens
- Recomenda-se não enviar mais de 500 mensagens por dia por número
- Use múltiplas conexões para volumes maiores

### Segurança
- Todas as rotas requerem autenticação
- Usuários só acessam suas próprias listas
- Validação de dados em todos os endpoints

## 🐛 Troubleshooting

### Erro: Property 'contactList' does not exist
**Causa**: Migration não foi executada
**Solução**: Execute `npx prisma migrate dev`

### Erro: Cannot find module 'express'
**Causa**: Projeto usa Fastify, não Express
**Solução**: Adapte os controllers para Fastify

### Mensagens não estão sendo enviadas
**Causa**: Método sendMedia não existe no baileysManager
**Solução**: Implemente o método ou use apenas sendMessage

## 📝 Próximos Passos

1. **Gerar Migration**:
   ```powershell
   cd backend
   npx prisma migrate dev --name add_broadcast_system
   ```

2. **Adaptar para Fastify**:
   - Converter controllers de Express para Fastify
   - Atualizar rotas para usar Fastify
   - Registrar rotas no index.ts

3. **Implementar sendMedia**:
   - Adicionar método no baileysManager
   - Suporte para envio de imagens
   - Suporte para envio de documentos

4. **Testar**:
   - Criar lista de teste
   - Adicionar contatos
   - Fazer disparo de teste
   - Verificar intervalos

## 📞 Suporte

Para dúvidas ou problemas:
- Verifique os logs do backend
- Consulte a documentação do Baileys
- Revise as políticas do WhatsApp

---

**Desenvolvido com ❤️ para disparo inteligente de mensagens**
