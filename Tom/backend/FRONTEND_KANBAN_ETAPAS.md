# 🎨 Frontend: Gerenciar Etapas do Kanban

## 🎯 O que precisa ser implementado no Frontend:

O backend já está pronto! Você precisa criar a interface para:
1. ✅ Listar etapas
2. ✅ Criar nova etapa
3. ✅ Editar etapa
4. ✅ Deletar etapa
5. ✅ Reordenar etapas (drag & drop)

---

## 📋 Onde Adicionar:

### Opção 1: Modal no próprio Kanban

Adicionar um botão "⚙️ Gerenciar Etapas" no topo do Kanban que abre um modal.

### Opção 2: Página de Configurações

Criar uma página `/settings/kanban` para gerenciar as etapas.

---

## 💻 Exemplo de Implementação (React):

### 1. Componente: Gerenciar Etapas

```tsx
// src/pages/KanbanSettings.tsx
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import api from '../services/api';

interface KanbanStage {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
  isDefault: boolean;
  _count: {
    conversations: number;
  };
}

export function KanbanSettings() {
  const [stages, setStages] = useState<KanbanStage[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<KanbanStage | null>(null);

  // Carregar etapas
  useEffect(() => {
    loadStages();
  }, []);

  async function loadStages() {
    const response = await api.get('/kanban/stages');
    setStages(response.data.data);
  }

  // Criar/Editar etapa
  async function handleSave(data: any) {
    if (editingStage) {
      // Editar
      await api.put(`/kanban/stages/${editingStage.id}`, data);
    } else {
      // Criar
      await api.post('/kanban/stages', {
        ...data,
        order: stages.length, // Adicionar no final
      });
    }
    
    loadStages();
    setIsModalOpen(false);
    setEditingStage(null);
  }

  // Deletar etapa
  async function handleDelete(id: string) {
    if (confirm('Tem certeza? Só é possível deletar etapas sem conversas.')) {
      try {
        await api.delete(`/kanban/stages/${id}`);
        loadStages();
      } catch (error: any) {
        alert(error.response?.data?.message || 'Erro ao deletar etapa');
      }
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Etapas do Kanban</h1>
        <button
          onClick={() => {
            setEditingStage(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Nova Etapa
        </button>
      </div>

      <div className="space-y-3">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex items-center gap-4 p-4 bg-white border rounded-lg"
          >
            {/* Drag handle */}
            <GripVertical className="text-gray-400 cursor-move" />

            {/* Cor */}
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: stage.color }}
            />

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{stage.name}</h3>
                {stage.isDefault && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                    Padrão
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{stage.description}</p>
              <p className="text-xs text-gray-400 mt-1">
                {stage._count.conversations} conversas
              </p>
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingStage(stage);
                  setIsModalOpen(true);
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
              >
                <Edit size={18} />
              </button>
              
              {!stage.isDefault && stage._count.conversations === 0 && (
                <button
                  onClick={() => handleDelete(stage.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Criar/Editar */}
      {isModalOpen && (
        <StageModal
          stage={editingStage}
          onSave={handleSave}
          onClose={() => {
            setIsModalOpen(false);
            setEditingStage(null);
          }}
        />
      )}
    </div>
  );
}
```

### 2. Modal de Criar/Editar

```tsx
// src/components/StageModal.tsx
import { useState } from 'react';
import { X } from 'lucide-react';

interface StageModalProps {
  stage: KanbanStage | null;
  onSave: (data: any) => void;
  onClose: () => void;
}

export function StageModal({ stage, onSave, onClose }: StageModalProps) {
  const [formData, setFormData] = useState({
    name: stage?.name || '',
    description: stage?.description || '',
    color: stage?.color || '#3B82F6',
    isDefault: stage?.isDefault || false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {stage ? 'Editar Etapa' : 'Nova Etapa'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ex: Em Atendimento"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Descrição da etapa"
              rows={3}
            />
          </div>

          {/* Cor */}
          <div>
            <label className="block text-sm font-medium mb-1">Cor</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-16 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-lg"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          {/* Etapa Padrão */}
          {!stage && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="isDefault" className="text-sm">
                Marcar como etapa padrão (novas conversas vão para esta etapa)
              </label>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {stage ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 3. Adicionar Botão no Kanban

```tsx
// src/pages/Kanban.tsx
import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Kanban() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Kanban</h1>
        
        {/* Botão para gerenciar etapas */}
        <Link
          to="/settings/kanban"
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          <Settings size={20} />
          Gerenciar Etapas
        </Link>
      </div>

      {/* Board do Kanban */}
      {/* ... */}
    </div>
  );
}
```

### 4. Adicionar Rota

```tsx
// src/App.tsx ou routes.tsx
import { KanbanSettings } from './pages/KanbanSettings';

<Route path="/settings/kanban" element={<KanbanSettings />} />
```

---

## 🎨 Cores Sugeridas:

```tsx
const COLORS = [
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Verde', value: '#10B981' },
  { name: 'Amarelo', value: '#F59E0B' },
  { name: 'Vermelho', value: '#EF4444' },
  { name: 'Roxo', value: '#8B5CF6' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Cinza', value: '#6B7280' },
];
```

---

## 🔄 Drag & Drop (Reordenar)

Para implementar arrastar e soltar, use uma biblioteca como `@dnd-kit/core`:

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

```tsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';

function handleDragEnd(event: any) {
  const { active, over } = event;
  
  if (active.id !== over.id) {
    const oldIndex = stages.findIndex(s => s.id === active.id);
    const newIndex = stages.findIndex(s => s.id === over.id);
    
    const newStages = arrayMove(stages, oldIndex, newIndex);
    setStages(newStages);
    
    // Salvar nova ordem
    await api.put('/kanban/stages/reorder', {
      stageIds: newStages.map(s => s.id)
    });
  }
}
```

---

## ✅ Checklist de Implementação:

- [ ] Criar página `KanbanSettings.tsx`
- [ ] Criar componente `StageModal.tsx`
- [ ] Adicionar botão "Gerenciar Etapas" no Kanban
- [ ] Adicionar rota `/settings/kanban`
- [ ] Implementar drag & drop (opcional)
- [ ] Adicionar validações (não deletar etapa com conversas)
- [ ] Adicionar feedback visual (toast/alert)

---

## 🎯 Resultado Final:

```
┌─────────────────────────────────────┐
│ Etapas do Kanban    [+ Nova Etapa] │
├─────────────────────────────────────┤
│ ≡ 🟢 Novo                    ✏️ 🗑️ │
│   Conversas novas                   │
│   5 conversas                       │
├─────────────────────────────────────┤
│ ≡ 🔵 Em Atendimento          ✏️ 🗑️ │
│   Conversas sendo atendidas         │
│   3 conversas                       │
├─────────────────────────────────────┤
│ ≡ 🟡 Aguardando Cliente      ✏️ 🗑️ │
│   Aguardando resposta               │
│   2 conversas                       │
└─────────────────────────────────────┘
```

---

## 📚 APIs Disponíveis:

```typescript
// Listar
GET /api/v1/kanban/stages

// Criar
POST /api/v1/kanban/stages
{ name, description, color, order, isDefault }

// Editar
PUT /api/v1/kanban/stages/:id
{ name, description, color }

// Deletar
DELETE /api/v1/kanban/stages/:id

// Reordenar
PUT /api/v1/kanban/stages/reorder
{ stageIds: ['id1', 'id2', 'id3'] }
```

---

**Implemente no frontend seguindo este guia!** 🚀
