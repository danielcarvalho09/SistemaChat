import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { Plus, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { GlassButton } from '../../components/ui/glass-button';
import { formatPhoneNumber } from '../../utils/formatPhone';

interface KanbanStage {
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

interface Contact {
  id: string;
  name?: string;
  phoneNumber: string;
}

interface AssignedUser {
  id: string;
  name: string;
  avatar?: string;
}

interface Message {
  id: string;
  content: string;
  isFromContact: boolean;
  timestamp: string;
}

interface KanbanConversation {
  id: string;
  contact: Contact;
  assignedUser?: AssignedUser;
  lastMessageAt: string;
  unreadCount: number;
  messages?: Message[];
  _count: {
    messages: number;
  };
}

interface BoardColumn {
  stage: KanbanStage;
  conversations: KanbanConversation[];
}

// Componente para área droppable (coluna)
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="flex-1">{children}</div>;
}

// Componente para card draggable
function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

export function Kanban() {
  const [board, setBoard] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<KanbanConversation | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#3B82F6');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadBoard();
  }, []);

  const loadBoard = async () => {
    try {
      const response = await api.get('/kanban/board');
      const data = response.data?.data || response.data || [];
      const normalized: BoardColumn[] = Array.isArray(data) ? data : [];

      const atendimentoColumns = normalized.filter((column) =>
        column?.stage?.name?.toLowerCase().includes('atendimento')
      );

      const nextBoard =
        atendimentoColumns.length > 0 ? atendimentoColumns : normalized;

      const withSortedConversations = nextBoard.map((column) => ({
        ...column,
        conversations: [...column.conversations].sort((a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        ),
      }));

      setBoard(withSortedConversations);
    } catch (error) {
      console.error('Erro ao carregar Kanban:', error);
      toast.error('Erro ao carregar Kanban');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const conversation = board
      .flatMap((col) => col.conversations)
      .find((conv) => conv.id === active.id);
    setActiveCard(conversation || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over || active.id === over.id) return;

    const conversationId = active.id as string;
    const toStageId = over.id as string;

    // Optimistic Update: Atualizar UI imediatamente
    const conversationToMove = board
      .flatMap((col) => col.conversations)
      .find((conv) => conv.id === conversationId);

    if (!conversationToMove) return;

    // Remover da coluna atual e adicionar na nova
    const newBoard = board.map((col) => {
      if (col.stage.id === toStageId) {
        // Adicionar na nova coluna
        return {
          ...col,
          conversations: [...col.conversations, conversationToMove],
        };
      } else {
        // Remover da coluna antiga
        return {
          ...col,
          conversations: col.conversations.filter((c) => c.id !== conversationId),
        };
      }
    });

    // Atualizar UI imediatamente
    setBoard(newBoard);

    try {
      await api.put(`/kanban/conversations/${conversationId}/move`, {
        toStageId,
      });

      toast.success('Conversa movida com sucesso!');
      // Recarregar para garantir sincronização
      loadBoard();
    } catch (error) {
      console.error('Erro ao mover conversa:', error);
      toast.error('Erro ao mover conversa');
      // Reverter em caso de erro
      loadBoard();
    }
  };

  const handleCreateStage = async () => {
    if (!newStageName.trim()) {
      toast.error('Digite um nome para a coluna');
      return;
    }

    try {
      const maxOrder = Math.max(...board.map(b => b.stage.order), -1);
      
      await api.post('/kanban/stages', {
        name: newStageName,
        color: newStageColor,
        order: maxOrder + 1,
      });

      toast.success('Coluna criada com sucesso!');
      setShowCreateModal(false);
      setNewStageName('');
      setNewStageColor('#3B82F6');
      loadBoard();
    } catch (error) {
      console.error('Erro ao criar coluna:', error);
      toast.error('Erro ao criar coluna');
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta coluna?')) return;

    try {
      await api.delete(`/kanban/stages/${stageId}`);
      toast.success('Coluna deletada com sucesso!');
      loadBoard();
    } catch (error: any) {
      console.error('Erro ao deletar coluna:', error);
      toast.error(error.response?.data?.message || 'Erro ao deletar coluna');
    }
  };

  const initializeStages = async () => {
    try {
      await api.post('/kanban/initialize');
      toast.success('Etapa padrão criada!');
      loadBoard();
    } catch (error) {
      console.error('Erro ao inicializar:', error);
      toast.error('Erro ao inicializar etapas');
    }
  };

  const formatTime = (date: string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-gray-900">Carregando Kanban...</div>
      </div>
    );
  }

  if (board.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-white">
        <div className="text-gray-900">Nenhuma etapa encontrada</div>
        <div className="flex gap-3">
          <GlassButton onClick={initializeStages}>
            <Plus className="w-4 h-4 mr-2" />
            Criar Etapa Padrão
          </GlassButton>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nova Etapa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Minhas Conversas - Kanban</h1>
            <p className="text-gray-600 mt-1">Gerencie suas conversas em atendimento</p>
          </div>
          <div className="flex gap-2">
            {/* Botão principal */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Etapa
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max">
            {board.map((column) => (
              <div
                key={column.stage.id}
                className="flex flex-col w-80 bg-white shadow-sm border border-gray-300"
              >
                {/* Column Header */}
                <div
                  className="p-4 border-b border-gray-200"
                  style={{ borderTopColor: column.stage.color, borderTopWidth: '4px' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: column.stage.color }}
                      />
                      <h3 className="font-semibold text-gray-900">{column.stage.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                        {column.conversations.length}
                      </span>
                      {!column.stage.isDefault && (
                        <button
                          onClick={() => handleDeleteStage(column.stage.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Deletar coluna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {column.stage.description && (
                    <p className="text-sm text-gray-600 mt-1">{column.stage.description}</p>
                  )}
                </div>

                {/* Cards Container - Droppable */}
                <DroppableColumn id={column.stage.id}>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-260px)]">
                    {column.conversations.map((conversation) => (
                      <DraggableCard key={conversation.id} id={conversation.id}>
                        <div className="bg-gray-50 border border-gray-200 p-4 hover:shadow-md transition-shadow">
                          {/* Contact Info */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 truncate">
                                {conversation.contact.name || 'Sem nome'}
                              </h4>
                              <p className="text-sm text-gray-600 truncate">
                                {formatPhoneNumber(conversation.contact.phoneNumber)}
                              </p>
                            </div>
                            {conversation.unreadCount > 0 && (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>

                          {/* Última Mensagem */}
                          {conversation.messages && conversation.messages.length > 0 && (
                            <div className="mt-2 p-2 bg-white text-xs">
                              <span className="text-gray-700 line-clamp-2">
                                {conversation.messages[0].content}
                              </span>
                            </div>
                          )}

                          {/* Stats */}
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                            <div className="flex items-center gap-1">
                              <span>{formatTime(conversation.lastMessageAt)}</span>
                            </div>
                          </div>
                        </div>
                      </DraggableCard>
                    ))}

                    {column.conversations.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        Nenhuma conversa
                      </div>
                    )}
                  </div>
                </DroppableColumn>
              </div>
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeCard && (
              <div className="bg-gray-50 border-2 border-blue-500 p-4 shadow-xl w-80 opacity-90">
                <h4 className="font-medium text-gray-900">
                  {activeCard.contact.name || 'Sem nome'}
                </h4>
                <p className="text-sm text-gray-600">{formatPhoneNumber(activeCard.contact.phoneNumber)}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modal Criar Coluna */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-300 rounded-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Nova Coluna</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-600 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Nome</label>
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded px-3 py-2 focus:border-gray-900"
                  placeholder="Ex: Em Andamento"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Cor</label>
                <input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="w-full h-10 bg-white border border-gray-300 rounded cursor-pointer"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <GlassButton onClick={handleCreateStage} className="flex-1">
                Criar
              </GlassButton>
              <GlassButton onClick={() => setShowCreateModal(false)} variant="outline" className="flex-1">
                Cancelar
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
