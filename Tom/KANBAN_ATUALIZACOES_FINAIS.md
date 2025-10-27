# 🎯 Atualizações Finais do Kanban

## ✅ Mudanças Solicitadas

### 1. **Formatação do Número**
- ✅ Usar `formatPhoneNumber()` para exibir telefone formatado

### 2. **Última Mensagem**
- ✅ Mostrar última mensagem enviada/recebida
- ✅ Indicar se foi enviada ou recebida

### 3. **Apenas Coluna "Novo"**
- ✅ Manter apenas etapa padrão
- ✅ Remover outras colunas pré-criadas

### 4. **Botão Criar Colunas**
- ✅ Modal para cadastrar novas colunas
- ✅ Escolher nome e cor
- ✅ Botão deletar coluna

### 5. **Menu Lateral**
- ✅ Remover link "Conversas"
- ✅ Botão engrenagem levar para `/admin`

---

## 🔧 Implementação

### Backend - Atualizar Etapas Padrão

Apenas criar coluna "Novo":

```typescript
// kanban.service.ts - initializeDefaultStages()
async initializeDefaultStages() {
  const count = await this.prisma.kanbanStage.count();

  if (count === 0) {
    await this.createStage({
      name: 'Novo',
      description: 'Conversas novas',
      color: '#10B981',
      order: 0,
      isDefault: true
    });
  }
}
```

### Backend - Incluir Última Mensagem

```typescript
// kanban.service.ts - getConversationsByStage()
async getConversationsByStage(stageId: string, userId?: string) {
  return await this.prisma.conversation.findMany({
    where: { 
      kanbanStageId: stageId,
      ...(userId && { assignedUserId: userId }),
    },
    include: {
      contact: true,
      assignedUser: { select: { id: true, name: true, avatar: true } },
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 1, // ← ÚLTIMA MENSAGEM
        select: {
          id: true,
          content: true,
          isFromContact: true,
          timestamp: true,
        },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: 'desc' },
  });
}
```

### Frontend - Card Atualizado

```tsx
<DraggableCard key={conversation.id} id={conversation.id}>
  <div className="bg-white border border-gray-200 rounded-lg p-4 cursor-move hover:shadow-md transition-shadow">
    {/* Nome */}
    <h4 className="font-medium text-gray-900 truncate">
      {conversation.contact.name || 'Sem nome'}
    </h4>
    
    {/* Telefone Formatado */}
    <p className="text-sm text-gray-500 truncate">
      {formatPhoneNumber(conversation.contact.phoneNumber)}
    </p>
    
    {/* Última Mensagem */}
    {conversation.messages?.[0] && (
      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
        <span className={conversation.messages[0].isFromContact ? 'text-blue-600' : 'text-green-600'}>
          {conversation.messages[0].isFromContact ? '📩 ' : '📤 '}
        </span>
        <span className="text-gray-600 line-clamp-2">
          {conversation.messages[0].content}
        </span>
      </div>
    )}
    
    {/* Stats */}
    <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
      <div>⏰ {formatTime(conversation.lastMessageAt)}</div>
      <div>💬 {conversation._count.messages}</div>
    </div>
  </div>
</DraggableCard>
```

### Frontend - Botão Criar Coluna

```tsx
{/* Header com botão */}
<div className="bg-white border-b border-gray-200 p-6">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Minhas Conversas - Kanban</h1>
      <p className="text-gray-600 mt-1">Gerencie suas conversas em atendimento</p>
    </div>
    <Button onClick={() => setShowCreateModal(true)}>
      <Plus className="w-4 h-4 mr-2" />
      Nova Coluna
    </Button>
  </div>
</div>

{/* Modal Criar Coluna */}
{showCreateModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-96">
      <h2 className="text-xl font-bold mb-4">Nova Coluna</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            type="text"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Ex: Em Andamento"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Cor</label>
          <input
            type="color"
            value={newStageColor}
            onChange={(e) => setNewStageColor(e.target.value)}
            className="w-full h-10 border rounded"
          />
        </div>
      </div>
      
      <div className="flex gap-2 mt-6">
        <Button onClick={handleCreateStage} className="flex-1">
          Criar
        </Button>
        <Button onClick={() => setShowCreateModal(false)} variant="outline" className="flex-1">
          Cancelar
        </Button>
      </div>
    </div>
  </div>
)}
```

### Frontend - Deletar Coluna

```tsx
{/* Botão deletar no header da coluna */}
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.stage.color }} />
    <h3 className="font-semibold text-gray-900">{column.stage.name}</h3>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
      {column.conversations.length}
    </span>
    {!column.stage.isDefault && (
      <button
        onClick={() => handleDeleteStage(column.stage.id)}
        className="text-red-500 hover:text-red-700"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    )}
  </div>
</div>
```

### Menu Lateral - Remover Conversas

```tsx
// DashboardLayout.tsx
const navigation = [
  // { name: 'Conversas', href: '/dashboard', icon: MessageSquare }, ← REMOVER
  { name: 'Kanban', href: '/dashboard/kanban', icon: Columns3 },
];
```

### Menu Lateral - Botão Engrenagem

```tsx
// DashboardLayout.tsx
<div className="flex gap-2">
  <Link to="/admin">
    <Button variant="outline" size="sm" className="flex-1">
      <Settings className="w-4 h-4" />
    </Button>
  </Link>
  <Button variant="outline" size="sm" className="flex-1" onClick={logout}>
    <LogOut className="w-4 h-4" />
  </Button>
</div>
```

---

## 📋 Checklist

- [ ] Atualizar backend para incluir última mensagem
- [ ] Atualizar backend para criar apenas coluna "Novo"
- [ ] Atualizar card com telefone formatado
- [ ] Atualizar card com última mensagem
- [ ] Adicionar botão "Nova Coluna"
- [ ] Adicionar modal para criar coluna
- [ ] Adicionar botão deletar coluna
- [ ] Remover "Conversas" do menu
- [ ] Botão engrenagem levar para /admin
- [ ] Testar drag-and-drop
- [ ] Testar criar coluna
- [ ] Testar deletar coluna

---

## 🎯 Resultado Final

### Menu Lateral
```
┌─────────────────────┐
│  💬 WhatsApp        │
│  Atendimento        │
├─────────────────────┤
│                     │
│ 📊 Kanban          │  ← Único item
│                     │
├─────────────────────┤
│ 👤 João Silva       │
│ 📧 joao@email.com   │
│ [⚙️→Admin] [🚪]     │
└─────────────────────┘
```

### Kanban
```
┌─────────────────────────────────────────────────┐
│  Minhas Conversas - Kanban    [+ Nova Coluna]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │🟢 Novo(2)│  │🔵Custom 1│  │🟣Custom 2│      │
│  │          │  │      [🗑️]│  │      [🗑️]│      │
│  ├──────────┤  ├──────────┤  ├──────────┤      │
│  │ João     │  │          │  │          │      │
│  │ (16)9999 │  │          │  │          │      │
│  │ 📩 Oi!   │  │          │  │          │      │
│  │ ⏰2min💬3│  │          │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
```

---

**Pronto para implementar!** 🚀
