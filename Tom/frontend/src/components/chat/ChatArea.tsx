import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Phone, Video, Search, ArrowRightLeft, Archive, Trash2, Clock, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { useConversationStore } from '../../store/conversationStore';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TransferModal } from './TransferModal';
import { ConversationTagMenu } from '../tags/ConversationTagMenu';
import { ObservationModal } from './ObservationModal';
import { ObservationCard } from './ObservationCard';
import './whatsapp-bg.css';
import type { Message } from '../../types';
import api from '../../lib/axios';

interface ChatAreaProps {
  conversationId: string;
  onToggleDetails: () => void;
}

export function ChatArea({ conversationId, onToggleDetails }: ChatAreaProps) {
  const { conversations, messages, fetchMessages, sendMessage, clearUnread, fetchConversations, updateConversationStatus } = useConversationStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightObservation, setHighlightObservation] = useState(false);

  const conversation = conversations.find((c) => c.id === conversationId);

  // Detectar quando conversa transferida é aceita e destacar observação
  useEffect(() => {
    if (conversation?.status === 'in_progress' && conversation?.internalNotes) {
      // Verificar se foi recentemente transferida e aceita
      const wasTransferred = localStorage.getItem(`transferred_${conversationId}`);
      if (wasTransferred) {
        setHighlightObservation(true);
        localStorage.removeItem(`transferred_${conversationId}`);
        // Remover destaque após 5 segundos
        setTimeout(() => setHighlightObservation(false), 5000);
      }
    }
  }, [conversation, conversationId]);

  useEffect(() => {
    if (conversationId) {
      // ✅ Buscar mensagens apenas quando a conversa muda (force = true)
      // O WebSocket vai atualizar em tempo real, então não precisa buscar constantemente
      fetchMessages(conversationId, true); // force = true apenas quando muda de conversa
      // Limpar contador de não lidas ao abrir a conversa
      clearUnread(conversationId);
    }
  }, [conversationId]); // Remover fetchMessages e clearUnread das dependências

  useEffect(() => {
    setReplyingTo(null);
  }, [conversationId]);

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
        // Upload do arquivo usando Axios (headers de usuário já são aplicados pelo authStore)
        const formData = new FormData();
        formData.append('file', file);

        console.log('[ChatArea] 📤 Uploading file:', {
          name: file.name,
          type: file.type,
          size: file.size,
          isFormData: formData instanceof FormData,
        });

        // IMPORTANTE: NÃO definir Content-Type manualmente para FormData
        // O navegador define automaticamente com o boundary correto
        // O interceptor do axios já remove o Content-Type automaticamente
        console.log('[ChatArea] 📤 Sending upload request...');
        const uploadResponse = await api.post('/upload', formData, {
          headers: {
            // Garantir que não há Content-Type definido
            'Content-Type': undefined,
          },
        });

        console.log('[ChatArea] 📥 Upload response:', {
          success: uploadResponse.data?.success,
          message: uploadResponse.data?.message,
          url: uploadResponse.data?.data?.url,
          status: uploadResponse.status,
        });

        if (!uploadResponse.data?.success) {
          console.error('[ChatArea] ❌ Upload failed:', uploadResponse.data);
          throw new Error(uploadResponse.data?.message || 'Erro ao fazer upload do arquivo');
        }

        const mediaUrl = uploadResponse.data.data?.url as string;
        
        if (!mediaUrl) {
          console.error('[ChatArea] ❌ No mediaUrl in response:', uploadResponse.data);
          throw new Error('URL da mídia não retornada pelo servidor');
        }

        console.log('[ChatArea] ✅ Upload successful, mediaUrl:', mediaUrl);

        // Determinar tipo de mensagem
        let messageType = 'document';
        if (file.type.startsWith('image/')) {
          messageType = 'image';
        } else if (file.type.startsWith('audio/') || file.type === 'video/webm') {
          // video/webm pode ser usado para gravação de áudio no navegador
          messageType = 'audio';
        } else if (file.type.startsWith('video/')) {
          messageType = 'video';
        }

        console.log('[ChatArea] 📨 Sending message with media:', {
          conversationId,
          messageType,
          mediaUrl,
          content: content || '',
        });

        // Enviar mensagem com mídia via API (user/sender resolvido pelo backend)
        const messageResponse = await api.post(`/conversations/${conversationId}/messages`, {
          content: content || '', // Não usar file.name como fallback
          messageType,
          mediaUrl,
          quotedMessageId: replyingTo?.id || undefined,
        });

        console.log('[ChatArea] ✅ Message sent successfully:', messageResponse.data);
        
        // Não adicionar manualmente - deixar o WebSocket fazer isso para evitar duplicação
        setReplyingTo(null);
      } else {
        await sendMessage(conversationId, content, replyingTo?.id || undefined);
        setReplyingTo(null);
      }
    } catch (error: any) {
      console.error('[ChatArea] ❌ Error sending message:', {
        error: error?.message || String(error),
        response: error?.response?.data,
        status: error?.response?.status,
        stack: error?.stack,
      });
      
      const errorMessage = error?.response?.data?.message 
        || error?.response?.data?.error
        || error?.message 
        || 'Erro ao enviar mensagem. Tente novamente.';
      
      alert(errorMessage);
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
            onTagsChange={() => fetchConversations(false)} // WebSocket já atualiza, usar cache
          />
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:bg-[#2a3942]"
            onClick={() => setShowObservationModal(true)}
            title="Adicionar observação"
          >
            <FileText className="w-5 h-5 text-gray-400" />
          </Button>
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
                        fetchConversations(false); // WebSocket já atualiza, usar cache
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
                        fetchConversations(false); // WebSocket já atualiza, usar cache
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

      {/* Observation Card - Logo abaixo do header */}
      {conversation?.internalNotes && (
        <div className="w-full px-4 pt-3 pb-2 bg-[#0b141a] border-b border-[#2a3942]">
          <ObservationCard 
            observation={conversation.internalNotes}
            conversationId={conversationId}
            onUpdate={() => fetchConversations(false)} // WebSocket já atualiza, usar cache
            isHighlighted={highlightObservation}
          />
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 whatsapp-bg-dark">
        <MessageList
          messages={messages[conversationId] || []}
          onReply={(message) => setReplyingTo(message)}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        contactName={
          conversation?.contact.name ||
          conversation?.contact.pushName ||
          conversation?.contact.phoneNumber ||
          'Contato'
        }
      />

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

      {/* Observation Modal */}
      {showObservationModal && (
        <ObservationModal
          conversationId={conversationId}
          currentObservation={conversation?.internalNotes || ''}
          onClose={() => setShowObservationModal(false)}
          onSave={() => {
            setShowObservationModal(false);
            fetchConversations();
            fetchMessages(conversationId);
          }}
        />
      )}
    </div>
  );
}
