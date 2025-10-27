import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';

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

interface KanbanConversation {
  id: string;
  contact: Contact;
  assignedUser?: AssignedUser;
  lastMessageAt: string;
  unreadCount: number;
  _count: {
    messages: number;
  };
}

interface BoardColumn {
  stage: KanbanStage;
  conversations: KanbanConversation[];
}

export function Kanban() {
  const [board, setBoard] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<KanbanConversation | null>(null);

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
      setBoard(Array.isArray(data) ? data : []);
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

    try {
      await api.put(`/kanban/conversations/${conversationId}/move`, {
        toStageId,
      });

      toast.success('Conversa movida com sucesso!');
      loadBoard();
    } catch (error) {
      console.error('Erro ao mover conversa:', error);
      toast.error('Erro ao mover conversa');
    }
  };

  const initializeStages = async () => {
    try {
      await api.post('/kanban/initialize');
      toast.success('Etapas padrão criadas!');
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
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Carregando Kanban...</div>
      </div>
    );
  }

  if (board.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-gray-500">Nenhuma etapa encontrada</div>
        <Button onClick={initializeStages}>
          <Plus className="w-4 h-4 mr-2" />
          Criar Etapas Padrão
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Kanban</h1>
            <p className="text-gray-600 mt-1">Gerenciamento de conversas em atendimento</p>
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
                id={column.stage.id}
                className="flex flex-col w-80 bg-white rounded-lg shadow-sm border border-gray-200"
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
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {column.conversations.length}
                    </span>
                  </div>
                  {column.stage.description && (
                    <p className="text-sm text-gray-500 mt-1">{column.stage.description}</p>
                  )}
                </div>

                {/* Cards Container */}
                <div
                  className="flex-1 overflow-y-auto p-3 space-y-3"
                  data-stage-id={column.stage.id}
                >
                  {column.conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      id={conversation.id}
                      draggable
                      className="bg-white border border-gray-200 rounded-lg p-4 cursor-move hover:shadow-md transition-shadow"
                    >
                      {/* Contact Info */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 truncate">
                            {conversation.contact.name || 'Sem nome'}
                          </h4>
                          <p className="text-sm text-gray-500 truncate">
                            {conversation.contact.phoneNumber}
                          </p>
                        </div>
                        {conversation.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>⏰</span>
                          <span>{formatTime(conversation.lastMessageAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>💬</span>
                          <span>{conversation._count.messages}</span>
                        </div>
                      </div>

                      {/* Assigned User */}
                      {conversation.assignedUser && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                              {conversation.assignedUser.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-600">
                              {conversation.assignedUser.name}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {column.conversations.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      Nenhuma conversa
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeCard && (
              <div className="bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl w-80 opacity-90">
                <h4 className="font-medium text-gray-900">
                  {activeCard.contact.name || 'Sem nome'}
                </h4>
                <p className="text-sm text-gray-500">{activeCard.contact.phoneNumber}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
