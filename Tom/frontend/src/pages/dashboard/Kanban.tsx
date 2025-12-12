import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Users as UsersIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { GlassButton } from '../../components/ui/glass-button';
import { formatPhoneNumber } from '../../utils/formatPhone';
import { MessageSidebar } from '../../components/kanban/MessageSidebar';
import { useAuthStore } from '../../store/authStore';
import { KanbanBoard, type Column, type Task } from '../../components/ui/kanban-board';

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
  isGroup?: boolean;
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
  firstMessageAt?: string;
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

// Mapear conversas para tasks do Kanban
const conversationToTask = (conversation: KanbanConversation): Task => {
  const isGroup = conversation.contact.isGroup || false;
  const phoneNumber = formatPhoneNumber(conversation.contact.phoneNumber);
  const lastMessage = conversation.messages && conversation.messages.length > 0 
    ? conversation.messages[0].content 
    : undefined;
  
  // Data da primeira mensagem
  const firstMessageDate = conversation.firstMessageAt || conversation.lastMessageAt;
  
  // Para grupos: usar pushName do contato (nome do grupo)
  // Para conversas individuais: usar pushName como título e número como subtítulo
  const pushName = conversation.contact.pushName || conversation.contact.name;
  const title = isGroup 
    ? (pushName || phoneNumber) // Grupo: pushName ou número como fallback
    : (pushName || phoneNumber); // Individual: pushName ou número como fallback
  
  const subtitle = isGroup ? undefined : phoneNumber;
  
  // Primeira letra do pushName para o avatar
  const contactInitial = pushName 
    ? pushName.charAt(0).toUpperCase()
    : phoneNumber.charAt(0).toUpperCase();
  
  return {
    id: conversation.id,
    title,
    subtitle, // Número formatado (apenas se não for grupo)
    description: lastMessage,
    tags: conversation.tags?.map(ct => ct.tag.name) || [],
    assignee: conversation.assignedUser ? {
      name: conversation.assignedUser.name,
      avatar: conversation.assignedUser.avatar,
    } : undefined,
    dueDate: firstMessageDate, // Data da primeira mensagem
    comments: conversation.unreadCount > 0 ? conversation.unreadCount : undefined,
    attachments: 0,
    contactInitial, // Primeira letra do pushName
    conversation, // Armazenar dados completos da conversa
  };
};

export function Kanban() {
  const { user } = useAuthStore();
  const [board, setBoard] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#3B82F6');
  const [selectedConversation, setSelectedConversation] = useState<KanbanConversation | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCardRef, setSelectedCardRef] = useState<React.RefObject<HTMLDivElement> | null>(null);

  const isAdmin = user?.roles?.some(role => role.name === 'admin') || false;

  useEffect(() => {
    loadBoard();
  }, [selectedUserId]);

  const loadBoard = async () => {
    try {
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

  // Buscar lista de usuários para admin
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [showUserSelector, setShowUserSelector] = useState(false);

  useEffect(() => {
    if (isAdmin) {
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

  // Transformar BoardColumn[] para Column[]
  const kanbanColumns: Column[] = useMemo(() => {
    return board.map((col) => ({
      id: col.stage.id,
      title: col.stage.name,
      color: col.stage.color,
      tasks: col.conversations.map(conversationToTask),
    }));
  }, [board]);

  const handleTaskMove = async (taskId: string, _fromColumnId: string, toColumnId: string) => {
    try {
      await api.put(`/kanban/conversations/${taskId}/move`, {
        toStageId: toColumnId,
      });

      toast.success('Conversa movida com sucesso!');
      loadBoard();
    } catch (error) {
      console.error('Erro ao mover conversa:', error);
      toast.error('Erro ao mover conversa');
      loadBoard();
    }
  };

  const handleTaskClick = (task: Task, _columnId: string, event: React.MouseEvent) => {
    if (task.conversation) {
      setSelectedConversation(task.conversation);
      // Buscar referência do card clicado
      const cardElement = (event.currentTarget as HTMLElement).closest('[data-card-id]') as HTMLElement;
      if (cardElement) {
        setSelectedCardRef({ current: cardElement } as React.RefObject<HTMLDivElement>);
      }
      setSidebarOpen(true);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-foreground">Carregando Kanban...</div>
      </div>
    );
  }

  if (board.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-background">
        <div className="text-foreground">Nenhuma etapa encontrada</div>
        <div className="flex gap-3">
          <GlassButton onClick={initializeStages}>
            <Plus className="w-4 h-4 mr-2" />
            Criar Etapa Padrão
          </GlassButton>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Etapa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="bg-background border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isAdmin && selectedUserId 
                ? `Kanban - ${users.find(u => u.id === selectedUserId)?.name || 'Usuário'}` 
                : 'Minhas Conversas - Kanban'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin && selectedUserId
                ? `Visualizando conversas aceitas do usuário selecionado`
                : 'Gerencie suas conversas em atendimento (apenas conversas aceitas das suas conexões)'}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowUserSelector(!showUserSelector)}
                  className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <UsersIcon className="w-4 h-4" />
                  {selectedUserId 
                    ? users.find(u => u.id === selectedUserId)?.name || 'Usuário'
                    : 'Todos os Usuários'}
                </button>
                {showUserSelector && (
                  <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setSelectedUserId(undefined);
                          setShowUserSelector(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded hover:bg-muted ${
                          !selectedUserId ? 'bg-primary/10 text-primary' : 'text-foreground'
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
                          className={`w-full text-left px-3 py-2 rounded hover:bg-muted ${
                            selectedUserId === user.id ? 'bg-primary/10 text-primary' : 'text-foreground'
                          }`}
                        >
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Etapa
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <KanbanBoard
          columns={kanbanColumns}
          onTaskMove={handleTaskMove}
          onTaskClick={handleTaskClick}
        />
      </div>

      {/* Modal Criar Coluna */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Nova Coluna</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Nome</label>
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  className="w-full bg-background border border-input text-foreground rounded px-3 py-2 focus:border-primary focus:outline-none"
                  placeholder="Ex: Em Andamento"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Cor</label>
                <input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="w-full h-10 bg-background border border-input rounded cursor-pointer"
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
