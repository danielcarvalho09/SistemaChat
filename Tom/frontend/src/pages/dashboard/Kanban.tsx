import React, { useState, useEffect } from 'react';
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
import { Plus, Trash2, X, Users as UsersIcon, ChevronRight, User } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { GlassButton } from '../../components/ui/glass-button';
import { formatPhoneNumber } from '../../utils/formatPhone';
import { MessageSidebar } from '../../components/kanban/MessageSidebar';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

// Componente do ícone WhatsApp em cinza escuro
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    fill="#374151" 
    viewBox="0 0 32 32" 
    version="1.1" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M26.576 5.363c-2.69-2.69-6.406-4.354-10.511-4.354-8.209 0-14.865 6.655-14.865 14.865 0 2.732 0.737 5.291 2.022 7.491l-0.038-0.070-2.109 7.702 7.879-2.067c2.051 1.139 4.498 1.809 7.102 1.809h0.006c8.209-0.003 14.862-6.659 14.862-14.868 0-4.103-1.662-7.817-4.349-10.507l0 0zM16.062 28.228h-0.005c-0 0-0.001 0-0.001 0-2.319 0-4.489-0.64-6.342-1.753l0.056 0.031-0.451-0.267-4.675 1.227 1.247-4.559-0.294-0.467c-1.185-1.862-1.889-4.131-1.889-6.565 0-6.822 5.531-12.353 12.353-12.353s12.353 5.531 12.353 12.353c0 6.822-5.53 12.353-12.353 12.353h-0zM22.838 18.977c-0.371-0.186-2.197-1.083-2.537-1.208-0.341-0.124-0.589-0.185-0.837 0.187-0.246 0.371-0.958 1.207-1.175 1.455-0.216 0.249-0.434 0.279-0.805 0.094-1.15-0.466-2.138-1.087-2.997-1.852l0.010 0.009c-0.799-0.74-1.484-1.587-2.037-2.521l-0.028-0.052c-0.216-0.371-0.023-0.572 0.162-0.757 0.167-0.166 0.372-0.434 0.557-0.65 0.146-0.179 0.271-0.384 0.366-0.604l0.006-0.017c0.043-0.087 0.068-0.188 0.068-0.296 0-0.131-0.037-0.253-0.101-0.357l0.002 0.003c-0.094-0.186-0.836-2.014-1.145-2.758-0.302-0.724-0.609-0.625-0.836-0.637-0.216-0.010-0.464-0.012-0.712-0.012-0.395 0.010-0.746 0.188-0.988 0.463l-0.001 0.002c-0.802 0.761-1.3 1.834-1.3 3.023 0 0.026 0 0.053 0.001 0.079l-0-0.004c0.131 1.467 0.681 2.784 1.527 3.857l-0.012-0.015c1.604 2.379 3.742 4.282 6.251 5.564l0.094 0.043c0.548 0.248 1.25 0.513 1.968 0.74l0.149 0.041c0.442 0.14 0.951 0.221 1.479 0.221 0.303 0 0.601-0.027 0.889-0.078l-0.031 0.004c1.069-0.223 1.956-0.868 2.497-1.749l0.009-0.017c0.165-0.366 0.261-0.793 0.261-1.242 0-0.185-0.016-0.366-0.047-0.542l0.003 0.019c-0.092-0.155-0.34-0.247-0.712-0.434z"></path>
  </svg>
);

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
  pushName?: string;
  avatar?: string;
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

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ConversationTag {
  id: string;
  tag: Tag;
}

interface KanbanConversation {
  id: string;
  contact: Contact;
  assignedUser?: AssignedUser;
  lastMessageAt: string;
  unreadCount: number;
  messages?: Message[];
  tags?: ConversationTag[];
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
  const { user } = useAuthStore();
  const [board, setBoard] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<KanbanConversation | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#3B82F6');
  const [selectedConversation, setSelectedConversation] = useState<KanbanConversation | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined); // Para admin ver kanban de outros usuários
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCardRef, setSelectedCardRef] = useState<React.RefObject<HTMLDivElement> | null>(null);
  const navigate = useNavigate();

  const isAdmin = user?.roles?.some(role => role.name === 'admin') || false;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadBoard();
  }, [selectedUserId]); // Recarregar quando mudar usuário selecionado (admin)

  const loadBoard = async () => {
    try {
      // ✅ Para admin: passar userId como query param se estiver visualizando kanban de outro usuário
      const params = isAdmin && selectedUserId ? { userId: selectedUserId } : {};
      const response = await api.get('/kanban/board', { params });
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

  // ✅ Buscar lista de usuários para admin
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [showUserSelector, setShowUserSelector] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      // Buscar lista de usuários para o seletor
      api.get('/users')
        .then((response) => {
          const usersData = response.data?.data || [];
          setUsers(usersData.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
        })
        .catch((error) => {
          console.error('Erro ao carregar usuários:', error);
        });
    }
  }, [isAdmin]);

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
            <h1 className="text-3xl font-bold text-gray-900">
              {isAdmin && selectedUserId 
                ? `Kanban - ${users.find(u => u.id === selectedUserId)?.name || 'Usuário'}` 
                : 'Minhas Conversas - Kanban'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isAdmin && selectedUserId
                ? `Visualizando conversas aceitas do usuário selecionado`
                : 'Gerencie suas conversas em atendimento (apenas conversas aceitas das suas conexões)'}
            </p>
          </div>
          <div className="flex gap-2">
            {/* ✅ Seletor de usuário para admin */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowUserSelector(!showUserSelector)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <UsersIcon className="w-4 h-4" />
                  {selectedUserId 
                    ? users.find(u => u.id === selectedUserId)?.name || 'Usuário'
                    : 'Todos os Usuários'}
                </button>
                {showUserSelector && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setSelectedUserId(undefined);
                          setShowUserSelector(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${
                          !selectedUserId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        Todos os Usuários
                      </button>
                      {users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setShowUserSelector(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${
                            selectedUserId === user.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
          <div className="flex gap-6 h-full min-w-max">
            {board.map((column) => (
              <div
                key={column.stage.id}
                className="flex flex-col w-80"
              >
                {/* Column Header - Nome da etapa */}
                <div className="mb-2">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">{column.stage.name}</h3>
                  {/* Barra colorida */}
                  <div
                    className="h-1 rounded-full"
                    style={{ backgroundColor: column.stage.color }}
                  />
                </div>

                {/* Cards Container - Droppable */}
                <DroppableColumn id={column.stage.id}>
                  <div className="flex-1 overflow-y-auto space-y-3 min-h-[200px] max-h-[calc(100vh-260px)]">
                    {column.conversations.map((conversation) => (
                      <DraggableCard key={conversation.id} id={conversation.id}>
                        <div 
                          data-card-id={conversation.id}
                          className="relative bg-white rounded-lg border border-gray-300 shadow-sm p-4 hover:shadow-md transition-shadow"
                        >
                          {/* Seta superior direita */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConversation(conversation);
                              // Buscar referência do card pelo data attribute
                              const cardElement = (e.currentTarget.closest('[data-card-id]') as HTMLElement);
                              if (cardElement) {
                                setSelectedCardRef({ current: cardElement } as React.RefObject<HTMLDivElement>);
                              }
                              setSidebarOpen(true);
                            }}
                            className="absolute top-2 right-2 text-gray-600 hover:text-gray-900 transition-colors z-10"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          {/* Layout horizontal: Foto à esquerda, conteúdo à direita */}
                          <div className="flex gap-3">
                            {/* Avatar do contato - lado esquerdo, centralizado verticalmente */}
                            <div className="flex-shrink-0 flex items-center">
                              <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                                <User className="w-7 h-7 stroke-[1.5] text-gray-900" />
                              </div>
                            </div>

                            {/* Conteúdo à direita */}
                            <div className="flex-1 min-w-0">
                              {/* Nome do contato na parte superior */}
                              <div className="mb-2">
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                  {conversation.contact.pushName || conversation.contact.name || formatPhoneNumber(conversation.contact.phoneNumber)}
                                </h4>
                              </div>

                              {/* Resumo da conversa embaixo */}
                              {conversation.messages && conversation.messages.length > 0 && (
                                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                  {conversation.messages[0].content}
                                </p>
                              )}

                              {/* Tags e ícone WhatsApp alinhados na mesma linha */}
                              <div className="flex items-center justify-between gap-2">
                                {/* Tags em retângulos cinzas */}
                                {conversation.tags && conversation.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 flex-1">
                                    {conversation.tags.map((ct) => (
                                      <span
                                        key={ct.id}
                                        className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded"
                                      >
                                        {ct.tag.name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Ícone WhatsApp alinhado com as tags */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Redirecionar para a conversa no dashboard
                                    navigate(`/dashboard?conversation=${conversation.id}`);
                                  }}
                                  className="hover:opacity-80 transition-opacity flex-shrink-0"
                                  title="Abrir conversa"
                                >
                                  <WhatsAppIcon className="w-6 h-6" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </DraggableCard>
                    ))}

                    {column.conversations.length === 0 && (
                      <div className="text-center text-gray-400 py-8 text-sm">
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

      {/* Card Flutuante de Mensagem */}
      {selectedConversation && (
        <MessageSidebar
          conversation={selectedConversation}
          isOpen={sidebarOpen}
          cardRef={selectedCardRef}
          onClose={() => {
            setSidebarOpen(false);
            setSelectedConversation(null);
            setSelectedCardRef(null);
          }}
          onMessageSent={() => {
            loadBoard();
          }}
        />
      )}
    </div>
  );
}
