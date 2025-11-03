import { useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useConversationStore } from '../../store/conversationStore';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const { conversations, fetchConversations, isLoading } = useConversationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // Mostrar todas por padrão

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleAcceptConversation = () => {
    // Recarregar conversas após aceitar
    fetchConversations();
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      (conv.contact.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.contact.phoneNumber.includes(searchQuery);

    // Filtro de status com lógica especial:
    // - 'all': Mostra todas as conversas
    // - 'in_progress': Inclui in_progress E transferred
    // - outros: Filtra pelo status específico
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true; // Mostrar todas
    } else if (statusFilter === 'in_progress') {
      matchesStatus = conv.status === 'in_progress' || conv.status === 'transferred';
    } else {
      matchesStatus = conv.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  // Contadores por status
  const statusCounts = {
    all: conversations.length, // Total de conversas
    waiting: conversations.filter(c => c.status === 'waiting').length,
    in_progress: conversations.filter(c => c.status === 'in_progress' || c.status === 'transferred').length,
    transferred: conversations.filter(c => c.status === 'transferred').length,
    resolved: conversations.filter(c => c.status === 'resolved').length,
  };

  return (
    <div className="flex flex-col h-full relative z-10 bg-white">
      {/* Search Bar */}
      <div className="p-3 bg-white">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchConversations()}
            disabled={isLoading}
            title="Recarregar conversas"
            className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 bg-white flex gap-2 overflow-x-auto scrollbar-hide border-b border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStatusFilter('all')}
          className={`flex-1 whitespace-nowrap bg-white text-gray-900 border-none hover:bg-white hover:underline transition-all ${
            statusFilter === 'all' ? 'underline font-bold' : ''
          }`}
        >
          Todas ({statusCounts.all})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStatusFilter('waiting')}
          className={`flex-1 whitespace-nowrap bg-white text-gray-900 border-none hover:bg-white hover:underline transition-all ${
            statusFilter === 'waiting' ? 'underline font-bold' : ''
          }`}
        >
          Aguardando ({statusCounts.waiting})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStatusFilter('in_progress')}
          className={`flex-1 whitespace-nowrap bg-white text-gray-900 border-none hover:bg-white hover:underline transition-all ${
            statusFilter === 'in_progress' ? 'underline font-bold' : ''
          }`}
        >
          Em Atendimento ({statusCounts.in_progress})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStatusFilter('transferred')}
          className={`flex-1 whitespace-nowrap bg-white text-gray-900 border-none hover:bg-white hover:underline transition-all ${
            statusFilter === 'transferred' ? 'underline font-bold' : ''
          }`}
        >
          Transferidas ({statusCounts.transferred})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStatusFilter('resolved')}
          className={`flex-1 whitespace-nowrap bg-white text-gray-900 border-none hover:bg-white hover:underline transition-all ${
            statusFilter === 'resolved' ? 'underline font-bold' : ''
          }`}
        >
          Finalizadas ({statusCounts.resolved})
        </Button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-400">Carregando...</div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <div>Nenhuma conversa encontrada</div>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation as any}
              isSelected={conversation.id === selectedConversationId}
              onClick={() => onSelectConversation(conversation.id)}
              onAccept={handleAcceptConversation}
            />
          ))
        )}
      </div>
    </div>
  );
}
