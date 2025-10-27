# ⚡ Otimizações de Performance - Além do Cache

## 🎯 Estratégias para Acelerar o Sistema

---

## 1. 🔍 Otimização de Queries (Prisma)

### ❌ Problema: N+1 Queries

```typescript
// LENTO - Faz 1 query + N queries (N+1 problem)
const conversations = await prisma.conversation.findMany();
for (const conv of conversations) {
  conv.contact = await prisma.contact.findUnique({ where: { id: conv.contactId } });
  conv.user = await prisma.user.findUnique({ where: { id: conv.userId } });
}
```

### ✅ Solução: Use `include` ou `select`

```typescript
// RÁPIDO - 1 query apenas com JOINs
const conversations = await prisma.conversation.findMany({
  include: {
    contact: true,
    user: {
      select: { id: true, name: true, email: true } // Só campos necessários
    },
    department: true,
  },
});
```

### 💡 Dica: Selecione apenas campos necessários

```typescript
// LENTO - Busca TODOS os campos
const users = await prisma.user.findMany();

// RÁPIDO - Busca apenas o necessário
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    status: true,
    // Não busca: password, createdAt, updatedAt, etc
  },
});
```

---

## 2. 📊 Paginação Eficiente

### ❌ Problema: Buscar tudo de uma vez

```typescript
// LENTO - Busca 10.000 conversas
const conversations = await prisma.conversation.findMany();
```

### ✅ Solução: Cursor-based Pagination

```typescript
// RÁPIDO - Busca 20 por vez
const conversations = await prisma.conversation.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { createdAt: 'desc' },
});

const total = await prisma.conversation.count(); // Cache isso!

return {
  data: conversations,
  pagination: {
    page,
    limit: 20,
    total,
    pages: Math.ceil(total / 20),
  },
};
```

### 🚀 Melhor ainda: Cursor Pagination

```typescript
// SUPER RÁPIDO - Não usa OFFSET (mais eficiente)
const conversations = await prisma.conversation.findMany({
  take: 20,
  cursor: lastId ? { id: lastId } : undefined,
  skip: lastId ? 1 : 0,
  orderBy: { createdAt: 'desc' },
});
```

---

## 3. 🔗 Índices no Banco de Dados

### Adicione índices para queries frequentes

```prisma
// schema.prisma
model Conversation {
  id String @id @default(uuid())
  contactId String
  userId String
  status String
  createdAt DateTime @default(now())
  
  // Índices para acelerar queries
  @@index([contactId])
  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@index([userId, status]) // Índice composto
}

model Message {
  id String @id @default(uuid())
  conversationId String
  createdAt DateTime @default(now())
  
  @@index([conversationId])
  @@index([createdAt])
  @@index([conversationId, createdAt]) // Para ordenação
}
```

### Aplicar índices:

```bash
# Criar migration
npx prisma migrate dev --name add_indexes

# Aplicar no Supabase
npx prisma migrate deploy
```

---

## 4. 🔄 Parallel Queries

### ❌ Problema: Queries sequenciais

```typescript
// LENTO - 3 segundos (1s + 1s + 1s)
const users = await prisma.user.count();
const conversations = await prisma.conversation.count();
const messages = await prisma.message.count();
```

### ✅ Solução: Queries paralelas

```typescript
// RÁPIDO - 1 segundo (todas ao mesmo tempo)
const [users, conversations, messages] = await Promise.all([
  prisma.user.count(),
  prisma.conversation.count(),
  prisma.message.count(),
]);
```

---

## 5. 📦 Compressão de Respostas

### Habilitar GZIP no Fastify

```typescript
// server.ts
import compress from '@fastify/compress';

await fastify.register(compress, {
  global: true,
  threshold: 1024, // Comprimir respostas > 1KB
});
```

### Instalar:

```bash
npm install @fastify/compress
```

**Resultado**: Respostas 70-90% menores!

---

## 6. 🎨 Otimização de JSON

### ❌ Problema: Serialização lenta

```typescript
// LENTO - JSON.stringify é lento para objetos grandes
return reply.send(bigObject);
```

### ✅ Solução: fast-json-stringify

```typescript
// server.ts
import fastJson from 'fast-json-stringify';

// Definir schemas para respostas frequentes
const conversationSchema = fastJson({
  type: 'object',
  properties: {
    id: { type: 'string' },
    contactId: { type: 'string' },
    status: { type: 'string' },
    // ... outros campos
  },
});

// Usar no controller
return reply.send(conversationSchema(data));
```

**Resultado**: 2-3x mais rápido na serialização!

---

## 7. 🔌 Connection Pooling

### Configurar pool de conexões do Prisma

```typescript
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}
```

### No .env:

```bash
# Supabase com pooling otimizado
DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=20"
```

---

## 8. 📡 WebSocket para Dados em Tempo Real

### Evite polling - use WebSocket

```typescript
// ❌ LENTO - Polling a cada 2 segundos
setInterval(() => {
  fetch('/api/conversations').then(...)
}, 2000);

// ✅ RÁPIDO - WebSocket com eventos
socket.on('conversation:new', (data) => {
  // Atualizar UI instantaneamente
});

socket.on('message:received', (data) => {
  // Adicionar mensagem em tempo real
});
```

---

## 9. 🎯 Lazy Loading no Frontend

### Carregar dados sob demanda

```typescript
// ❌ LENTO - Carrega tudo ao abrir
const conversations = await api.getConversations();
const messages = await api.getMessages(convId);
const contacts = await api.getContacts();

// ✅ RÁPIDO - Carrega conforme necessário
// 1. Carrega lista de conversas
const conversations = await api.getConversations();

// 2. Só carrega mensagens quando clicar na conversa
onClick(() => {
  const messages = await api.getMessages(convId);
});

// 3. Contatos só quando abrir modal
onOpenModal(() => {
  const contacts = await api.getContacts();
});
```

---

## 10. 🖼️ Otimização de Imagens/Arquivos

### Redimensionar e comprimir uploads

```typescript
import sharp from 'sharp';

// Otimizar imagem antes de salvar
const optimizedImage = await sharp(buffer)
  .resize(800, 800, { fit: 'inside' })
  .jpeg({ quality: 80 })
  .toBuffer();
```

### Instalar:

```bash
npm install sharp
```

---

## 11. 🔢 Agregações no Banco

### ❌ Problema: Contar no código

```typescript
// LENTO - Busca tudo e conta no Node.js
const conversations = await prisma.conversation.findMany();
const pending = conversations.filter(c => c.status === 'pending').length;
const active = conversations.filter(c => c.status === 'active').length;
```

### ✅ Solução: Agregar no banco

```typescript
// RÁPIDO - Conta no PostgreSQL
const stats = await prisma.conversation.groupBy({
  by: ['status'],
  _count: true,
});

// Resultado: { status: 'pending', _count: 50 }
```

---

## 12. 📝 Debounce em Buscas

### Frontend - Evitar requisições excessivas

```typescript
// ❌ LENTO - Faz requisição a cada tecla
onChange={(e) => {
  searchConversations(e.target.value);
}}

// ✅ RÁPIDO - Aguarda 300ms após parar de digitar
import { debounce } from 'lodash';

const debouncedSearch = debounce((value) => {
  searchConversations(value);
}, 300);

onChange={(e) => {
  debouncedSearch(e.target.value);
}}
```

---

## 13. 🎭 Virtual Scrolling

### Para listas grandes (1000+ itens)

```typescript
// ❌ LENTO - Renderiza 1000 conversas
{conversations.map(conv => <ConversationItem {...conv} />)}

// ✅ RÁPIDO - Renderiza apenas 20 visíveis
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={conversations.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ConversationItem {...conversations[index]} />
    </div>
  )}
</FixedSizeList>
```

### Instalar:

```bash
npm install react-window
```

---

## 14. 🔐 Otimização de Autenticação

### JWT com refresh token

```typescript
// Tokens curtos para segurança, mas sem re-login constante
const accessToken = jwt.sign(payload, secret, { expiresIn: '15m' });
const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: '7d' });

// Frontend renova token automaticamente
if (tokenExpired) {
  const newToken = await refreshAccessToken();
}
```

---

## 15. 📊 Monitoramento de Performance

### Adicionar métricas

```typescript
import { performance } from 'perf_hooks';

async function listConversations(request, reply) {
  const start = performance.now();
  
  const conversations = await prisma.conversation.findMany();
  
  const duration = performance.now() - start;
  logger.info(`listConversations took ${duration.toFixed(2)}ms`);
  
  return reply.send(conversations);
}
```

---

## 🎯 Checklist de Implementação

### Prioridade ALTA (faça hoje):
- [ ] Adicionar `select` em todas as queries (campos mínimos)
- [ ] Implementar paginação em listas grandes
- [ ] Usar `Promise.all()` para queries paralelas
- [ ] Adicionar índices no banco de dados
- [ ] Habilitar compressão GZIP

### Prioridade MÉDIA (faça esta semana):
- [ ] Implementar debounce em buscas
- [ ] Otimizar serialização JSON
- [ ] Lazy loading no frontend
- [ ] Virtual scrolling em listas grandes
- [ ] Otimizar uploads de imagens

### Prioridade BAIXA (melhorias futuras):
- [ ] Monitoramento de performance
- [ ] Agregações no banco
- [ ] Connection pooling avançado

---

## 📊 Ganhos Esperados

| Otimização | Ganho de Performance |
|------------|---------------------|
| Select específico | 30-50% mais rápido |
| Paginação | 80-95% mais rápido |
| Índices | 50-90% mais rápido |
| Queries paralelas | 60-80% mais rápido |
| Compressão GZIP | 70-90% menos dados |
| Virtual scrolling | 90-99% mais rápido |
| Debounce | 80-95% menos requests |

**Total combinado: 10-50x mais rápido!** 🚀

---

## 🔧 Script de Implementação Rápida

Vou criar scripts para aplicar essas otimizações automaticamente...
