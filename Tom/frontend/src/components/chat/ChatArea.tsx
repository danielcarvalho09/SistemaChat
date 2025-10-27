import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Phone, Video, Search, ArrowRightLeft, Archive, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useConversationStore } from '../../store/conversationStore';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TransferModal } from './TransferModal';
import { ConversationTagMenu } from '../tags/ConversationTagMenu';
import './whatsapp-bg.css';

interface ChatAreaProps {
  conversationId: string;
  onToggleDetails: () => void;
}

export function ChatArea({ conversationId, onToggleDetails }: ChatAreaProps) {
  const { conversations, messages, fetchMessages, sendMessage, clearUnread, fetchConversations, updateConversationStatus } = useConversationStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const conversation = conversations.find((c) => c.id === conversationId);

  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId);
      // Limpar contador de não lidas ao abrir a conversa
      clearUnread(conversationId);
    }
  }, [conversationId, fetchMessages, clearUnread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showMenu && !target.closest('.relative')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleSendMessage = async (content: string, file?: File) => {
    try {
      if (file) {
        // Upload do arquivo
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('accessToken');
        if (!token) {
          throw new Error('Token não encontrado. Faça login novamente.');
        }

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const uploadResponse = await fetch(`${API_URL}/api/v1/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Erro ao fazer upload do arquivo');
        }

        const uploadData = await uploadResponse.json();
        const mediaUrl = `${API_URL}${uploadData.data.url}`;

        // Determinar tipo de mensagem
        let messageType = 'document';
        if (file.type.startsWith('image/')) {
          messageType = 'image';
        } else if (file.type.startsWith('audio/')) {
          messageType = 'audio';
        } else if (file.type.startsWith('video/')) {
          messageType = 'video';
        }

        // Enviar mensagem com mídia
        const messageResponse = await fetch(`${API_URL}/api/v1/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: content || file.name,
            messageType,
            mediaUrl,
          }),
        });

        if (!messageResponse.ok) {
          throw new Error('Erro ao enviar mensagem');
        }
        // Não adicionar manualmente - deixar o WebSocket fazer isso para evitar duplicação
      } else {
        await sendMessage(conversationId, content);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem. Tente novamente.');
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Conversa não encontrada</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b141a]">
      {/* Chat Header */}
      <div className="bg-[#202c33] border-b border-[#2a3942] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0 ">
          <div className='relative flex-shrink-0'>
          <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center cursor-pointer" onClick={onToggleDetails}>
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user w-7 h-7 stroke-[1.5] text-gray-900 translate-y-[0.5px]"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white truncate">{conversation.contact.name}</h2>
            <p className="text-sm text-gray-400">{conversation.contact.phoneNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ConversationTagMenu 
            conversationId={conversationId}
            onTagsChange={() => fetchConversations()}
          />
          <Button variant="ghost" size="sm" className="hover:bg-[#2a3942]">
            <Search className="w-5 h-5 text-gray-400" />
          </Button>
          <Button variant="ghost" size="sm" className="hover:bg-[#2a3942]">
            <Phone className="w-5 h-5 text-gray-400" />
          </Button>
          <Button variant="ghost" size="sm" className="hover:bg-[#2a3942]">
            <Video className="w-5 h-5 text-gray-400" />
          </Button>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowMenu(!showMenu)}
              className="hover:bg-[#2a3942]"
            >
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </Button>
            
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#202c33] rounded-lg shadow-lg border border-[#2a3942] z-50">
                <button
                  onClick={() => {
                    setShowTransferModal(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#2a3942] flex items-center gap-2 rounded-t-lg"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Transferir Conversa
                </button>
                {conversation?.status === 'in_progress' && (
                  <button
                    onClick={async () => {
                      try {
                        await updateConversationStatus(conversationId, 'resolved');
                        fetchConversations();
                        setShowMenu(false);
                        alert('Conversa finalizada com sucesso');
                      } catch (error) {
                        console.error('Erro ao finalizar conversa:', error);
                        alert('Erro ao finalizar conversa');
                      }
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-[#2a3942] flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar Conversa
                  </button>
                )}
                {conversation?.status !== 'waiting' && (
                  <button
                    onClick={async () => {
                      try {
                        await updateConversationStatus(conversationId, 'waiting');
                        fetchConversations();
                        setShowMenu(false);
                        alert('Conversa voltou para Aguardando');
                      } catch (error) {
                        console.error('Erro ao voltar para aguardando:', error);
                        alert('Erro ao voltar conversa para aguardando');
                      }
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#2a3942] flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    Voltar para Aguardando
                  </button>
                )}
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#2a3942] flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  Arquivar
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#2a3942] flex items-center gap-2 rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Conversa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 whatsapp-bg-dark">
        <MessageList messages={messages[conversationId] || []} />
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput onSendMessage={handleSendMessage} />

      {/* Transfer Modal */}
      {showTransferModal && (
        <TransferModal
          conversationId={conversationId}
          onClose={() => setShowTransferModal(false)}
          onTransfer={() => {
            setShowTransferModal(false);
            // Recarregar lista de conversas e mensagens
            fetchConversations();
            fetchMessages(conversationId);
          }}
        />
      )}
    </div>
  );
}
