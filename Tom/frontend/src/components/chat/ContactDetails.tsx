import { useState } from 'react';
import { X, Phone, Mail, MessageSquare, Building, Calendar, Tag, User as UserIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { useConversationStore } from '../../store/conversationStore';
import { TransferModal } from './TransferModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactDetailsProps {
  conversationId: string;
  onClose: () => void;
}

export function ContactDetails({ conversationId, onClose }: ContactDetailsProps) {
  const { conversations, fetchConversations } = useConversationStore();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const conversation = conversations.find((c) => c.id === conversationId);

  if (!conversation) {
    return null;
  }

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return date;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Informações do Contato</h2>
        <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-100 transition-all duration-200">
          <X className="w-5 h-5 text-gray-900" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {/* Profile */}
        <div className="bg-white p-6 text-center border-b border-gray-200">
          <div className="w-24 h-24 mx-auto rounded-full bg-white border-2 border-gray-200 flex items-center justify-center mb-4">
            <UserIcon className="w-12 h-12 stroke-[1.5] text-gray-900" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">
            {conversation.contact.name}
          </h3>
          <p className="text-sm text-gray-400">{conversation.contact.phoneNumber}</p>
        </div>

        {/* Details */}
        <div className="bg-white mt-2 p-4 space-y-4">
          <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200">
            <Phone className="w-5 h-5 text-gray-900 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">Telefone</div>
              <div className="text-sm text-gray-900">{conversation.contact.phoneNumber}</div>
            </div>
          </div>

          {conversation.contact.email && (
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200">
              <Mail className="w-5 h-5 text-gray-900 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Email</div>
                <div className="text-sm text-gray-900">{conversation.contact.email}</div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200">
            <MessageSquare className="w-5 h-5 text-gray-900 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">Status da Conversa</div>
              <div className="text-sm text-gray-900 capitalize">
                {conversation.status === 'waiting' && 'Aguardando'}
                {conversation.status === 'in_progress' && 'Em Atendimento'}
                {conversation.status === 'resolved' && 'Resolvida'}
                {conversation.status === 'closed' && 'Fechada'}
              </div>
            </div>
          </div>

          {conversation.department && (
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200">
              <Building className="w-5 h-5 text-gray-900 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Departamento</div>
                <div className="text-sm text-gray-900">{conversation.department.name}</div>
              </div>
            </div>
          )}

          {conversation.createdAt && (
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200">
              <Calendar className="w-5 h-5 text-gray-900 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Primeira Mensagem</div>
                <div className="text-sm text-gray-900">{formatDate(conversation.createdAt)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white mt-2 p-4 space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start border-gray-200 text-gray-900 hover:bg-gray-100 transition-all duration-200"
            onClick={() => setShowTransferModal(true)}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Transferir Conversa
          </Button>
          <Button variant="outline" className="w-full justify-start border-gray-200 text-gray-900 hover:bg-gray-100 transition-all duration-200">
            <X className="w-4 h-4 mr-2" />
            Encerrar Atendimento
          </Button>
        </div>

        {/* Transfer Modal */}
        {showTransferModal && (
          <TransferModal
            conversationId={conversationId}
            onClose={() => setShowTransferModal(false)}
            onTransfer={() => {
              setShowTransferModal(false);
              // Recarregar lista de conversas para atualizar dados
              fetchConversations();
            }}
          />
        )}

        {/* Internal Notes */}
        {conversation.internalNotes && (
          <div className="bg-white mt-2 p-4 border border-gray-200 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Notas Internas</h4>
            <p className="text-sm text-gray-400 whitespace-pre-wrap">
              {conversation.internalNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
