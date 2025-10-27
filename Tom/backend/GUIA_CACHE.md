# 🚀 Guia de Uso do Sistema de Cache

## 📋 Visão Geral

Sistema de cache com Redis para melhorar performance do sistema, reduzindo consultas ao banco de dados.

---

## ✨ Recursos

- ✅ Cache automático em rotas GET
- ✅ Invalidação inteligente de cache
- ✅ Chaves padronizadas
- ✅ TTL configurável
- ✅ Estatísticas de cache
- ✅ Suporte a múltiplas estratégias

---

## 🎯 Como Usar

### 1. Cache Básico no Controller

```typescript
import { cache, CacheKeys, CacheTTL } from '../config/cache';

// Exemplo: Buscar usuário com cache
export async function getUser(userId: string) {
  return cache.wrap(
    CacheKeys.user(userId),
    async () => {
      // Esta função só executa se não houver cache
      return await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true, departmentAccess: true },
      });
    },
    CacheTTL.MEDIUM // 5 minutos
  );
}
```

### 2. Cache Automático em Rotas

```typescript
import { cacheMiddleware, invalidateCacheMiddleware } from '../middlewares/cache.middleware';

// GET com cache de 5 minutos
router.get('/users', cacheMiddleware(300), userController.list);

// GET com cache de 30 minutos
router.get('/departments', cacheMiddleware(1800), departmentController.list);

// POST que invalida cache relacionado
router.post('/users',
  invalidateCacheMiddleware(['user:*', 'users:*']),
  userController.create
);

// PUT que invalida cache específico
router.put('/users/:id',
  invalidateCacheMiddleware(['user:*', 'users:*']),
  userController.update
);
```

### 3. Invalidação Manual de Cache

```typescript
import { cache, CacheKeys } from '../config/cache';

// Deletar cache específico
await cache.del(CacheKeys.user(userId));

// Deletar múltiplas chaves
await cache.del([
  CacheKeys.user(userId),
  CacheKeys.userDepartments(userId),
]);

// Deletar por padrão
await cache.delPattern('user:*'); // Deleta todos os caches de usuários
await cache.delPattern('conversation:123:*'); // Deleta todos os caches da conversa 123
```

### 4. Cache de Listas com Paginação

```typescript
export async function listUsers(page: number, limit: number) {
  const cacheKey = CacheKeys.userList(page, limit);
  
  return cache.wrap(
    cacheKey,
    async () => {
      const users = await prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: { roles: true },
      });
      
      const total = await prisma.user.count();
      
      return { users, total, page, limit };
    },
    CacheTTL.SHORT // 1 minuto para listas
  );
}
```

### 5. Cache de Métricas/Dashboard

```typescript
export async function getDashboardStats() {
  return cache.wrap(
    CacheKeys.dashboardStats(),
    async () => {
      const [
        totalUsers,
        totalConversations,
        activeConnections,
        todayMessages,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.conversation.count(),
        prisma.whatsAppConnection.count({ where: { status: 'connected' } }),
        prisma.message.count({
          where: {
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ]);
      
      return {
        totalUsers,
        totalConversations,
        activeConnections,
        todayMessages,
      };
    },
    CacheTTL.SHORT // 1 minuto
  );
}
```

---

## 📊 Chaves de Cache Padronizadas

```typescript
// Usuários
CacheKeys.user(userId)
CacheKeys.userByEmail(email)
CacheKeys.userList(page, limit)
CacheKeys.userDepartments(userId)
CacheKeys.userRoles(userId)

// Conversas
CacheKeys.conversation(conversationId)
CacheKeys.conversationList(filters)
CacheKeys.conversationMessages(conversationId, page)
CacheKeys.conversationMetrics(conversationId)

// Contatos
CacheKeys.contact(contactId)
CacheKeys.contactByPhone(phone)
CacheKeys.contactList(page)

// Departamentos
CacheKeys.department(departmentId)
CacheKeys.departmentList()
CacheKeys.departmentActive()

// Tags
CacheKeys.tag(tagId)
CacheKeys.tagList()

// Templates
CacheKeys.template(templateId)
CacheKeys.templateList(departmentId)

// Conexões WhatsApp
CacheKeys.connection(connectionId)
CacheKeys.connectionList()
CacheKeys.connectionActive()

// Métricas
CacheKeys.metrics(type, period)
CacheKeys.dashboardStats()

// Kanban
CacheKeys.kanbanStages()
CacheKeys.kanbanBoard(filters)
```

---

## ⏱️ TTLs Recomendados

```typescript
CacheTTL.SHORT      // 1 minuto - dados que mudam frequentemente
CacheTTL.MEDIUM     // 5 minutos - dados moderados (padrão)
CacheTTL.LONG       // 30 minutos - dados estáveis
CacheTTL.VERY_LONG  // 1 hora - dados raramente alterados
CacheTTL.DAY        // 1 dia - dados quase estáticos
```

---

## 🎯 Estratégias de Cache por Tipo de Dado

### Dados Estáticos (TTL: VERY_LONG ou DAY)
- Departamentos
- Roles e Permissions
- Tags
- Kanban Stages
- Configurações do sistema

### Dados Moderados (TTL: MEDIUM ou LONG)
- Usuários
- Contatos
- Templates de mensagem
- Conexões WhatsApp

### Dados Dinâmicos (TTL: SHORT)
- Conversas
- Mensagens
- Métricas em tempo real
- Dashboard stats
- Listas paginadas

### Sem Cache
- Autenticação/Login
- Envio de mensagens
- Webhooks
- Eventos em tempo real

---

## 🔄 Padrões de Invalidação

### Ao Criar Usuário
```typescript
await cache.delPattern('user:*');
await cache.delPattern('users:*');
```

### Ao Atualizar Conversa
```typescript
await cache.del(CacheKeys.conversation(conversationId));
await cache.delPattern('conversations:*');
await cache.delPattern(`conversation:${conversationId}:*`);
```

### Ao Enviar Mensagem
```typescript
await cache.del(CacheKeys.conversationMessages(conversationId, 1));
await cache.del(CacheKeys.conversationMetrics(conversationId));
await cache.delPattern(`conversation:${conversationId}:*`);
```

### Ao Atualizar Departamento
```typescript
await cache.del(CacheKeys.department(departmentId));
await cache.delPattern('department*');
```

---

## 📈 Monitoramento

### Ver Estatísticas do Cache

```typescript
const stats = await cache.stats();
console.log(stats);
// {
//   keys: 150,
//   memory: '2.5M',
//   hits: 5420,
//   misses: 320
// }
```

### Limpar Todo o Cache

```typescript
await cache.flush();
```

---

## 💡 Dicas de Performance

1. **Cache agressivo para dados estáticos**
   - Departamentos, roles, tags → TTL de 1 hora ou mais

2. **Cache moderado para dados de usuário**
   - Perfis, preferências → TTL de 5-30 minutos

3. **Cache curto para listas**
   - Paginação, filtros → TTL de 1 minuto

4. **Não cache dados sensíveis**
   - Senhas, tokens, dados de pagamento

5. **Invalide cache em mutations**
   - Sempre limpe cache relacionado após CREATE/UPDATE/DELETE

6. **Use padrões para invalidação em massa**
   - `user:*` invalida todos os caches de usuários

7. **Monitore hit rate**
   - Hit rate > 80% = cache eficiente
   - Hit rate < 50% = revisar estratégia

---

## 🚀 Exemplo Completo: User Controller

```typescript
import { cache, CacheKeys, CacheTTL } from '../config/cache';
import { Request, Response } from 'express';

export class UserController {
  // GET /users/:id - Com cache
  async show(req: Request, res: Response) {
    const { id } = req.params;
    
    const user = await cache.wrap(
      CacheKeys.user(id),
      async () => {
        return await prisma.user.findUnique({
          where: { id },
          include: { roles: true, departmentAccess: true },
        });
      },
      CacheTTL.MEDIUM
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json(user);
  }
  
  // GET /users - Com cache
  async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const result = await cache.wrap(
      CacheKeys.userList(page, limit),
      async () => {
        const users = await prisma.user.findMany({
          skip: (page - 1) * limit,
          take: limit,
          include: { roles: true },
        });
        
        const total = await prisma.user.count();
        
        return { users, total, page, limit };
      },
      CacheTTL.SHORT
    );
    
    return res.json(result);
  }
  
  // POST /users - Invalida cache
  async create(req: Request, res: Response) {
    const user = await prisma.user.create({
      data: req.body,
    });
    
    // Invalidar cache relacionado
    await cache.delPattern('user:*');
    await cache.delPattern('users:*');
    
    return res.status(201).json(user);
  }
  
  // PUT /users/:id - Invalida cache
  async update(req: Request, res: Response) {
    const { id } = req.params;
    
    const user = await prisma.user.update({
      where: { id },
      data: req.body,
    });
    
    // Invalidar cache específico e listas
    await cache.del(CacheKeys.user(id));
    await cache.delPattern('users:*');
    
    return res.json(user);
  }
  
  // DELETE /users/:id - Invalida cache
  async delete(req: Request, res: Response) {
    const { id } = req.params;
    
    await prisma.user.delete({
      where: { id },
    });
    
    // Invalidar cache
    await cache.del(CacheKeys.user(id));
    await cache.delPattern('users:*');
    
    return res.status(204).send();
  }
}
```

---

## 🎯 Resultado Esperado

Com cache implementado corretamente:

- ⚡ **50-90% mais rápido** em rotas GET frequentes
- 📉 **Redução de 70-90%** em queries ao banco
- 🚀 **Melhor experiência** do usuário
- 💰 **Menor custo** de infraestrutura

---

## 📚 Próximos Passos

1. Implemente cache nos controllers mais usados
2. Monitore hit rate do cache
3. Ajuste TTLs conforme necessidade
4. Configure invalidação automática
5. Documente estratégias específicas do projeto
