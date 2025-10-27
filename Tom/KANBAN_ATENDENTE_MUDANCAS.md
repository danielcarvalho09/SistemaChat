# 🔄 Kanban para Área do Atendente - Mudanças

## 📋 O Que Mudou

### Conceito Anterior ❌
- Kanban no painel admin
- Todas as conversas visíveis
- Acesso apenas para admins

### Novo Conceito ✅
- **Kanban na área do atendente** (Dashboard)
- **Cada usuário vê apenas suas conversas**
- **Menu lateral com 2 opções**: Conversas + Kanban
- **Apenas conversas em atendimento** (assignedUserId preenchido)

---

## ✅ Backend - Já Atualizado!

### Service (kanban.service.ts)
```typescript
// Agora filtra por usuário
async getKanbanBoard(userId?: string) {
  // Retorna apenas conversas do usuário
}

async getConversationsByStage(stageId: string, userId?: string) {
  where: { 
    kanbanStageId: stageId,
    assignedUserId: userId // ← FILTRO POR USUÁRIO
  }
}
```

### Controller (kanban.controller.ts)
```typescript
getBoard = async (request, reply) => {
  const userId = request.user!.userId; // ← Pega do token
  const board = await this.kanbanService.getKanbanBoard(userId);
}
```

---

## 🎯 Frontend - Mudanças Necessárias

### 1. Estrutura de Pastas

**Mover arquivo:**
```
De:   frontend/src/pages/admin/Kanban.tsx
Para: frontend/src/pages/dashboard/Kanban.tsx
```

### 2. Layout do Dashboard

**Criar menu lateral no Dashboard:**
```typescript
// frontend/src/pages/dashboard/DashboardLayout.tsx

const navigation = [
  { name: 'Conversas', href: '/dashboard', icon: MessageSquare },
  { name: 'Kanban', href: '/dashboard/kanban', icon: Columns3 },
];
```

### 3. Rotas

**Atualizar rotas:**
```typescript
// Remover de AdminRoutes
// Adicionar em DashboardRoutes (ou criar se não existir)

<Route path="/dashboard">
  <Route index element={<Dashboard />} />
  <Route path="kanban" element={<Kanban />} />
</Route>
```

### 4. Remover do Admin

**AdminLayout.tsx:**
- Remover item "Kanban" do menu

**AdminRoutes.tsx:**
- Remover rota `/admin/kanban`

---

## 🎨 Nova Estrutura

### Menu do Atendente

```
┌─────────────────────┐
│  WhatsApp System    │
├─────────────────────┤
│                     │
│ 💬 Conversas        │  ← Página atual de conversas
│ 📊 Kanban          │  ← NOVO! Visualização Kanban
│                     │
├─────────────────────┤
│ 👤 João Silva       │
│ 📧 joao@email.com   │
│ [⚙️] [🚪]           │
└─────────────────────┘
```

### Kanban do Atendente

```
┌─────────────────────────────────────────────────┐
│  Kanban - Minhas Conversas                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │🟢 Novo(2)│  │🔵 Atend. │  │🟣Resolv. │      │
│  ├──────────┤  ├──────────┤  ├──────────┤      │
│  │          │  │          │  │          │      │
│  │ João     │  │ Maria    │  │ Pedro    │      │
│  │ 2min     │  │ 15min    │  │ 1h       │      │
│  │          │  │          │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  ← Apenas conversas atribuídas a mim           │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Implementação Passo a Passo

### Passo 1: Verificar se existe DashboardLayout

```bash
# Verificar se existe
frontend/src/pages/dashboard/DashboardLayout.tsx
```

Se não existir, criar com menu lateral.

### Passo 2: Mover Kanban.tsx

```bash
# Mover arquivo
mv frontend/src/pages/admin/Kanban.tsx frontend/src/pages/dashboard/Kanban.tsx
```

### Passo 3: Criar/Atualizar DashboardLayout

Adicionar menu lateral com:
- Conversas
- Kanban

### Passo 4: Atualizar Rotas

Remover de admin, adicionar em dashboard.

### Passo 5: Testar

1. Login como atendente
2. Ver menu com "Conversas" e "Kanban"
3. Clicar em Kanban
4. Ver apenas suas conversas
5. Arrastar entre colunas

---

## 📊 Comparação

### Antes (Admin)
- ✅ Todas as conversas
- ✅ Acesso admin
- ❌ Não individual

### Depois (Atendente)
- ✅ Apenas minhas conversas
- ✅ Acesso atendente
- ✅ Individual por usuário
- ✅ Menu lateral próprio

---

## 🎯 Próximos Passos

1. ⏳ Verificar estrutura do Dashboard
2. ⏳ Criar DashboardLayout se não existir
3. ⏳ Mover Kanban.tsx
4. ⏳ Atualizar rotas
5. ⏳ Remover do admin
6. ⏳ Testar

---

## ✅ Backend Pronto!

O backend já está:
- ✅ Filtrando por usuário
- ✅ Retornando apenas conversas do atendente
- ✅ Funcionando corretamente

**Falta apenas ajustar o frontend!**
