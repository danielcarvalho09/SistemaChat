import { useState, useEffect } from 'react';
import { X, Send, ChevronRight } from 'lucide-react';
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
    };
  };
  isOpen: boolean;
  onClose: () => void;
  onMessageSent?: () => void;
}

export function MessageSidebar({ conversation, isOpen, onClose, onMessageSent }: MessageSidebarProps) {
  const [message, setMessage] = useState('');
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadQuickMessages();
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-[60] flex flex-col border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Enviar Mensagem</h3>
          <p className="text-sm text-gray-600 truncate">
            {conversation.contact.name || 'Sem nome'}
          </p>
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
      <div className="flex-1 flex flex-col p-4">
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
  );
}

