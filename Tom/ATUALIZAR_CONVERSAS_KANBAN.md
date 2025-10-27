# 🔧 Atualizar Conversas Existentes para o Kanban

## ❌ Problema

As conversas existentes não aparecem no Kanban porque:
- Campo `kanbanStageId` está `null`
- Conversas foram criadas antes do sistema Kanban

## ✅ Solução

### 1. Regenerar Prisma Client
```bash
cd backend
npx prisma generate
```

### 2. Atualizar Conversas Existentes

Execute este script SQL no banco de dados:

```sql
-- Atualizar todas as conversas que não têm etapa
UPDATE conversations
SET "kanbanStageId" = (
  SELECT id FROM kanban_stages WHERE "isDefault" = true LIMIT 1
)
WHERE "kanbanStageId" IS NULL
AND "assignedUserId" IS NOT NULL; -- Apenas conversas em atendimento
```

Ou via endpoint (criar endpoint temporário):

```typescript
// Criar endpoint em kanban.controller.ts
async updateExistingConversations() {
  const defaultStage = await this.prisma.kanbanStage.findFirst({
    where: { isDefault: true },
  });

  if (!defaultStage) {
    throw new Error('Nenhuma etapa padrão encontrada');
  }

  const result = await this.prisma.conversation.updateMany({
    where: {
      kanbanStageId: null,
      assignedUserId: { not: null }, // Apenas em atendimento
    },
    data: {
      kanbanStageId: defaultStage.id,
    },
  });

  return { updated: result.count };
}
```

### 3. Reiniciar Backend
```bash
npm run dev
```

---

## 🎯 O Que Foi Corrigido

### Backend
- ✅ Novas conversas recebem `kanbanStageId` automaticamente
- ✅ Busca etapa padrão ao criar conversa
- ✅ Atribui etapa padrão (`isDefault: true`)

### Código Atualizado
```typescript
// message.service.ts - Ao criar conversa

// Buscar etapa padrão do Kanban
const defaultStage = await this.prisma.kanbanStage.findFirst({
  where: { isDefault: true },
});

conversation = await this.prisma.conversation.create({
  data: {
    // ... outros campos
    kanbanStageId: defaultStage?.id || null, // ← NOVO!
  },
});
```

---

## 🚀 Como Testar

### 1. Regenerar Prisma
```bash
cd backend
npx prisma generate
```

### 2. Atualizar conversas antigas (escolha uma opção):

#### Opção A: Via SQL direto
```sql
UPDATE conversations
SET "kanbanStageId" = (
  SELECT id FROM kanban_stages WHERE "isDefault" = true LIMIT 1
)
WHERE "kanbanStageId" IS NULL
AND "assignedUserId" IS NOT NULL;
```

#### Opção B: Via endpoint (criar temporário)
```bash
POST http://localhost:3000/api/v1/kanban/update-existing
```

### 3. Verificar no Kanban
1. Acesse `/dashboard/kanban`
2. Agora deve aparecer as conversas!

---

## 📊 Filtros do Kanban

O Kanban mostra conversas que:
- ✅ Têm `kanbanStageId` preenchido
- ✅ Têm `assignedUserId` = seu ID (filtro por usuário)
- ✅ Estão em qualquer etapa

---

## ✅ Resumo

**Problema**: Conversas antigas sem `kanbanStageId`  
**Solução**: 
1. Regenerar Prisma Client
2. Atualizar conversas existentes
3. Novas conversas já vêm com etapa padrão

**Agora funciona!** 🎉
