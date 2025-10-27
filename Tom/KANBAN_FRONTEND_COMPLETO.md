# 🎨 Frontend do Kanban - Guia Completo

## 📦 Instalação de Dependências

### 1. Instalar pacotes de Drag-and-Drop

Execute no terminal do frontend:

```powershell
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Ou execute o script:
```powershell
.\INSTALAR_DND_KANBAN.ps1
```

---

## 📁 Estrutura de Arquivos

```
frontend/src/
├── pages/admin/
│   └── Kanban.tsx          ← Página principal do Kanban
├── components/kanban/
│   ├── KanbanBoard.tsx     ← Board com colunas
│   ├── KanbanColumn.tsx    ← Coluna individual
│   ├── KanbanCard.tsx      ← Card de conversa
│   └── StageModal.tsx      ← Modal para criar/editar etapas
└── types/
    └── kanban.ts           ← Tipos TypeScript
```

---

## 🎯 Funcionalidades

### 1. **Visualização do Board**
- ✅ Colunas representando etapas
- ✅ Cards representando conversas
- ✅ Cores personalizadas por etapa
- ✅ Contador de conversas por etapa

### 2. **Drag and Drop**
- ✅ Arrastar cards entre colunas
- ✅ Feedback visual ao arrastar
- ✅ Atualização automática no backend
- ✅ Animações suaves

### 3. **Gerenciamento de Etapas**
- ✅ Criar nova etapa
- ✅ Editar etapa existente
- ✅ Deletar etapa (se vazia)
- ✅ Reordenar etapas
- ✅ Definir etapa padrão

### 4. **Informações do Card**
- ✅ Nome do contato
- ✅ Telefone
- ✅ Tempo desde última mensagem
- ✅ Número de mensagens
- ✅ Atendente responsável
- ✅ Tags

---

## 🎨 Design do Kanban

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Kanban - Gerenciamento de Conversas          [+ Nova Etapa] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 🟢 Novo (3) │  │🔵 Em Atend. │  │🟡 Aguardando│             │
│  │             │  │     (5)     │  │    (2)      │             │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤             │
│  │             │  │             │  │             │             │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │             │
│  │ │ João    │ │  │ │ Maria   │ │  │ │ Pedro   │ │             │
│  │ │ 5516... │ │  │ │ 5516... │ │  │ │ 5516... │ │             │
│  │ │ 2min    │ │  │ │ 15min   │ │  │ │ 1h      │ │             │
│  │ │ 💬 3    │ │  │ │ 💬 8    │ │  │ │ 💬 5    │ │             │
│  │ │ 👤 Ana  │ │  │ │ 👤 João │ │  │ │ 👤 Ana  │ │             │
│  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │             │
│  │             │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Card de Conversa

```
┌─────────────────────────────────┐
│ 👤 João Silva                   │
│ 📱 5516999999999                │
│ ⏰ Há 5 minutos                 │
│ 💬 3 mensagens                  │
│ 👨‍💼 Atendente: Ana              │
│ 🏷️ VIP • Urgente               │
└─────────────────────────────────┘
```

---

## 🔧 Implementação

### 1. Tipos TypeScript

```typescript
// frontend/src/types/kanban.ts

export interface KanbanStage {
  id: string;
  name: string;
  description?: string;
  color: string;
  order: number;
  isDefault: boolean;
  _count?: {
    conversations: number;
  };
}

export interface KanbanConversation {
  id: string;
  contact: {
    id: string;
    name?: string;
    phoneNumber: string;
  };
  assignedUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
  lastMessageAt: Date;
  unreadCount: number;
  _count: {
    messages: number;
  };
}

export interface KanbanBoard {
  stage: KanbanStage;
  conversations: KanbanConversation[];
}
```

### 2. API Service

```typescript
// frontend/src/services/kanban.service.ts

import { api } from '../lib/api';

export const kanbanService = {
  // Obter board completo
  async getBoard() {
    const response = await api.get('/kanban/board');
    return response.data.data;
  },

  // Mover conversa
  async moveConversation(conversationId: string, toStageId: string, notes?: string) {
    const response = await api.put(`/kanban/conversations/${conversationId}/move`, {
      toStageId,
      notes,
    });
    return response.data.data;
  },

  // Criar etapa
  async createStage(data: any) {
    const response = await api.post('/kanban/stages', data);
    return response.data.data;
  },

  // Listar etapas
  async listStages() {
    const response = await api.get('/kanban/stages');
    return response.data.data;
  },

  // Inicializar etapas padrão
  async initialize() {
    const response = await api.post('/kanban/initialize');
    return response.data;
  },
};
```

### 3. Página Principal (Resumida)

```typescript
// frontend/src/pages/admin/Kanban.tsx

import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { kanbanService } from '../../services/kanban.service';
import { KanbanColumn } from '../../components/kanban/KanbanColumn';
import { toast } from 'sonner';

export function Kanban() {
  const [board, setBoard] = useState<KanbanBoard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBoard();
  }, []);

  const loadBoard = async () => {
    try {
      const data = await kanbanService.getBoard();
      setBoard(data);
    } catch (error) {
      toast.error('Erro ao carregar Kanban');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const conversationId = active.id as string;
    const toStageId = over.id as string;

    try {
      await kanbanService.moveConversation(conversationId, toStageId);
      toast.success('Conversa movida com sucesso!');
      loadBoard(); // Recarregar board
    } catch (error) {
      toast.error('Erro ao mover conversa');
    }
  };

  return (
    <div className="h-full overflow-x-auto bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Kanban</h1>
        <p className="text-gray-600">Gerenciamento de conversas</p>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 min-w-max">
          {board.map((column) => (
            <KanbanColumn
              key={column.stage.id}
              stage={column.stage}
              conversations={column.conversations}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
```

---

## 🎨 Cores das Etapas

```typescript
const stageColors = {
  green: '#10B981',   // Novo
  blue: '#3B82F6',    // Em Atendimento
  yellow: '#F59E0B',  // Aguardando
  purple: '#8B5CF6',  // Resolvido
  gray: '#6B7280',    // Fechado
};
```

---

## 🚀 Como Testar

### 1. Instalar Dependências
```bash
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 2. Inicializar Etapas (Backend)
```bash
POST http://localhost:3000/api/v1/kanban/initialize
```

### 3. Acessar Kanban
```
http://localhost:5173/admin/kanban
```

### 4. Testar Drag-and-Drop
- Arraste um card de uma coluna para outra
- Veja a atualização em tempo real

---

## 📝 Próximos Passos

1. ✅ Instalar dependências
2. ✅ Criar arquivos do frontend
3. ✅ Adicionar rota no menu
4. ✅ Testar drag-and-drop
5. ⏳ Adicionar filtros
6. ⏳ Adicionar busca
7. ⏳ Adicionar WebSocket para tempo real

---

## 🎯 Resumo

**Backend**: ✅ 100% Completo
- Models, Migration, Service, Controller, Rotas

**Frontend**: ⏳ Em Progresso
- Precisa instalar dependências
- Precisa criar componentes
- Precisa adicionar ao menu

**Próximo**: Criar os componentes do frontend!
