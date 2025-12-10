import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, User, Smartphone, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import api from '../../lib/axios';
import { formatPhoneNumber as formatPhone } from '../../utils/formatPhone';
import { ConversationTags } from '../tags/ConversationTags';

interface Conversation {
  id: string;
  contact: {
    name: string;
    phoneNumber: string;
    pushName?: string | null;
    profilePicture?: string;
  };
  lastMessage?: {
    content: string;
    createdAt: string;
    isFromMe: boolean;
    status?: string;
  };
  unreadCount: number;
  status: string;
  lastMessageAt?: string;
  department?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  } | null;
  connection?: {
    id: string;
    name: string;
    phoneNumber: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
  } | null;
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  onAccept?: (conversationId: string) => void;
}

export function ConversationItem({ conversation, isSelected, onClick, onAccept }: ConversationItemProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que clique no botão selecione a conversa
    
    setIsAccepting(true);
    try {
      // Se conversa foi transferida, marcar para destacar
      if (conversation.status === 'transferred') {
        localStorage.setItem(`transferred_${conversation.id}`, 'true');
      }
      
      await api.patch(`/conversations/${conversation.id}/accept`, {});
      if (onAccept) {
        onAccept(conversation.id);
      }
    } catch (error: any) {
      console.error('Erro ao aceitar conversa:', error);
      
      // Mostrar mensagem de erro amigável
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.error || 
                          error?.message || 
                          'Não foi possível aceitar a conversa. Ela pode já ter sido aceita por outro atendente.';
      
      alert(errorMessage);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Tem certeza que deseja recusar esta conversa?')) {
      return;
    }
    
    setIsRejecting(true);
    try {
      await api.patch(`/conversations/${conversation.id}/status`, { status: 'closed' });
      if (onAccept) {
        onAccept(conversation.id);
      }
    } catch (error) {
      console.error('Erro ao recusar conversa:', error);
    } finally {
      setIsRejecting(false);
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return '#F59E0B'; // Laranja/Amarelo
      case 'transferred':
        return '#8B5CF6'; // Roxo
      case 'in_progress':
        return '#10B981'; // Verde
      case 'resolved':
        return '#9CA3AF'; // Cinza
      default:
        return '#D1D5DB'; // Cinza claro
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Aguardando';
      case 'transferred':
        return 'Transferida';
      case 'in_progress':
        return 'Em Atendimento';
      case 'resolved':
        return 'Resolvida';
      default:
        return status;
    }
  };

  const formatTime = (date?: string) => {
    if (!date) return '';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return '';
    }
  };

  // Usar função utilitária de formatação
  const formatPhoneNumber = formatPhone;

  const isWaiting = conversation.status === 'waiting';
  const isTransferred = conversation.status === 'transferred';
  const canAccept = isWaiting || isTransferred;

  return (
    <div className="relative">
      <div
        className={cn(
          'flex flex-col gap-2 p-3 transition-all duration-200',
          !canAccept && 'cursor-pointer hover:bg-gray-100',
          isSelected && 'bg-gray-100'
        )}
      >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
            <User className="w-7 h-7 stroke-[1.5] text-gray-900" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex flex-col gap-0.5 flex-1" onClick={!canAccept ? onClick : undefined}>
            <h3 className="font-semibold text-gray-900 truncate">
              {(() => {
                // ✅ Verificar se é grupo (phoneNumber contém @g.us)
                const isGroup = conversation.contact.phoneNumber?.includes('@g.us') || false;
                
                // ✅ REGRA: Para grupos, SEMPRE usar name (subject do grupo), nunca pushName
                // Para privados, priorizar pushName > name > número
                if (isGroup) {
                  // Grupo: usar name (subject) ou número como fallback
                  return conversation.contact.name && conversation.contact.name !== conversation.contact.phoneNumber
                    ? conversation.contact.name
                    : formatPhoneNumber(conversation.contact.phoneNumber);
                } else {
                  // Privado: priorizar pushName > name > número
                  return conversation.contact.pushName || 
                         (conversation.contact.name && conversation.contact.name !== conversation.contact.phoneNumber 
                           ? conversation.contact.name 
                           : formatPhoneNumber(conversation.contact.phoneNumber));
                }
              })()}
            </h3>
            {(() => {
              const isGroup = conversation.contact.phoneNumber?.includes('@g.us') || false;
              // Para grupos, não mostrar número (já está no título se não tiver name)
              // Para privados, mostrar número se tiver pushName ou name
              if (isGroup) {
                return null; // Grupos não mostram número no subtítulo
              } else {
                return (conversation.contact.pushName || conversation.contact.name) ? (
                  <p className="text-xs text-gray-500 truncate">
                    {formatPhoneNumber(conversation.contact.phoneNumber)}
                  </p>
                ) : null;
              }
            })()}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {conversation.lastMessageAt && (
              <span className="text-xs text-gray-400">
                {formatTime(conversation.lastMessageAt)}
              </span>
            )}
            {canAccept && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  disabled={isRejecting || isAccepting}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold text-xs px-3 py-1 rounded transition-all duration-200 flex items-center gap-1"
                >
                  {isRejecting ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <X className="w-3 h-3" />
                      Recusar
                    </>
                  )}
                </button>
                <button
                  onClick={handleAccept}
                  disabled={isAccepting || isRejecting}
                  className="bg-[#00a884] hover:bg-[#008069] text-white font-semibold text-xs px-4 py-1 rounded transition-all duration-200"
                >
                  {isAccepting ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Aceitar'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between" onClick={!canAccept ? onClick : undefined}>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {conversation.lastMessage?.isFromMe && (
              <div className="flex-shrink-0">
                {conversation.lastMessage.status === 'read' ? (
                  <CheckCheck className="w-4 h-4 text-blue-500" />
                ) : (
                  <Check className="w-4 h-4 text-gray-400" />
                )}
              </div>
            )}
            <p className="text-sm text-gray-400 truncate">
              {conversation.lastMessage?.content || 'Sem mensagens'}
            </p>
          </div>

          {conversation.unreadCount > 0 && !isWaiting && (
            <div className="flex-shrink-0 ml-2">
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-green-500 rounded-full">
                {conversation.unreadCount}
              </span>
            </div>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2 flex-wrap" onClick={!canAccept ? onClick : undefined}>
          <span className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded-full" style={{ backgroundColor: getStatusColor(conversation.status) }}>
            {getStatusLabel(conversation.status)}
          </span>
          {conversation.department && (
            <span 
              className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded-full"
              style={{ backgroundColor: conversation.department.color }}
            >
              {conversation.department.name}
            </span>
          )}
          {conversation.connection && (
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-white bg-gray-800 rounded-full border border-gray-700"
            >
              <Smartphone className="w-3 h-3" />
              {conversation.connection.name}
            </span>
          )}
          {conversation.assignedTo && (
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-white bg-gray-800 rounded-full border border-gray-700"
            >
              <User className="w-3 h-3" />
              {conversation.assignedTo.name}
            </span>
          )}
          <ConversationTags conversationId={conversation.id} maxTags={2} />
        </div>
        </div>
      </div>

      </div>
      {/* Linha separadora branca fina no centro */}
      <div className="flex justify-center px-4">
        <div className="w-full max-w-md h-[1px] bg-white/20"></div>
      </div>
    </div>
  );
}
