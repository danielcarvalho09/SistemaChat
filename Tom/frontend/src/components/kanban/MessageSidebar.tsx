import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface QuickMessage {
  id: string;
  name: string;
  content: string;
  category?: string;
}

interface MessageSidebarProps {
  conversation: {
    id: string;
    contact: {
      id: string;
      name?: string;
      phoneNumber: string;
      pushName?: string;
      avatar?: string;
    };
  };
  isOpen: boolean;
  onClose: () => void;
  onMessageSent?: () => void;
  cardRef?: React.RefObject<HTMLDivElement> | null; // Referência ao card clicado para posicionamento
}

export function MessageSidebar({ conversation, isOpen, onClose, onMessageSent, cardRef }: MessageSidebarProps) {
  const [message, setMessage] = useState('');
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadQuickMessages();
      // Calcular posição do card flutuante baseado no card clicado
      if (cardRef?.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const cardWidth = 384; // w-96 = 384px
        const spacing = 12; // Espaçamento entre card e flutuante
        const padding = 16; // Padding da tela
        
        let left = rect.right + spacing;
        let top = rect.top;
        
        // Se o card flutuante sair da tela à direita, posicionar à esquerda do card
        if (left + cardWidth > window.innerWidth - padding) {
          left = rect.left - cardWidth - spacing;
        }
        
        // Se ainda sair (card muito à direita), posicionar no lado direito da tela
        if (left < padding) {
          left = window.innerWidth - cardWidth - padding;
        }
        
        // Ajustar verticalmente se sair da tela
        const maxHeight = 600;
        if (top + maxHeight > window.innerHeight - padding) {
          top = window.innerHeight - maxHeight - padding;
        }
        if (top < padding) {
          top = padding;
        }
        
        setPosition({ top, left });
      } else {
        // Fallback: posicionar no centro da tela
        setPosition({
          top: window.innerHeight / 2 - 200,
          left: window.innerWidth / 2 - 200,
        });
      }
    } else {
      setPosition(null);
    }
  }, [isOpen, cardRef]);

  const loadQuickMessages = async () => {
    try {
      const response = await api.get('/quick-messages');
      setQuickMessages(response.data?.data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens prontas:', error);
    }
  };

  const handleQuickMessageClick = (content: string) => {
    setMessage(content);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }

    setSending(true);
    try {
      await api.post(`/conversations/${conversation.id}/messages`, {
        content: message.trim(),
        messageType: 'text',
      });

      toast.success('Mensagem enviada com sucesso!');
      setMessage('');
      onMessageSent?.();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen || !position) return null;

  return (
    <>
      {/* Overlay para fechar ao clicar fora */}
      <div
        className="fixed inset-0 bg-black bg-opacity-20 z-[59]"
        onClick={onClose}
      />
      {/* Card flutuante */}
      <div
        className="fixed w-96 bg-white shadow-2xl z-[60] flex flex-col border border-gray-200 rounded-lg overflow-hidden"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          maxHeight: '600px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar */}
          {conversation.contact.avatar ? (
            <img
              src={conversation.contact.avatar}
              alt={conversation.contact.name || 'Contato'}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium flex-shrink-0">
              {(conversation.contact.pushName || conversation.contact.name || conversation.contact.phoneNumber).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {conversation.contact.pushName || conversation.contact.name || 'Sem nome'}
            </h3>
            <p className="text-xs text-gray-500 truncate">
              {conversation.contact.phoneNumber}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Messages */}
      {quickMessages.length > 0 && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <p className="text-xs font-medium text-gray-700 mb-2">Mensagens Prontas</p>
          <div className="flex flex-wrap gap-2">
            {quickMessages.map((qm) => (
              <button
                key={qm.id}
                onClick={() => handleQuickMessageClick(qm.content)}
                className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors text-gray-700"
              >
                {qm.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite sua mensagem..."
          className="flex-1 w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-900"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Enviar
            </>
          )}
        </button>
      </div>
      </div>
    </>
  );
}

