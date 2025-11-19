import { useState, useEffect } from 'react';
import { X, Send, Paperclip, Image as ImageIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { formatPhoneNumber } from '../../utils/formatPhone';

interface MessageModalProps {
  conversation: {
    id: string;
    contact: {
      id: string;
      name?: string;
      phoneNumber: string;
    };
  };
  onClose: () => void;
  onMessageSent?: () => void;
}

export function MessageModal({ conversation, onClose, onMessageSent }: MessageModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Criar preview para imagens
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    // Resetar input file
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSend = async () => {
    if (!message.trim() && !selectedFile) {
      toast.error('Digite uma mensagem ou selecione um arquivo');
      return;
    }

    setSending(true);

    try {
      if (selectedFile) {
        // Upload do arquivo primeiro
        const formData = new FormData();
        formData.append('file', selectedFile);

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
        if (selectedFile.type.startsWith('image/')) {
          messageType = 'image';
        } else if (selectedFile.type.startsWith('audio/')) {
          messageType = 'audio';
        } else if (selectedFile.type.startsWith('video/')) {
          messageType = 'video';
        }

        // Enviar mensagem com mídia
        await api.post(`/conversations/${conversation.id}/messages`, {
          content: message.trim() || selectedFile.name,
          messageType,
          mediaUrl,
        });
      } else {
        // Enviar mensagem de texto
        await api.post(`/conversations/${conversation.id}/messages`, {
          content: message.trim(),
          messageType: 'text',
        });
      }

      toast.success('Mensagem enviada com sucesso!');
      setMessage('');
      setSelectedFile(null);
      setPreviewUrl(null);
      
      // Resetar input file
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Enviar Mensagem
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {conversation.contact.name || 'Sem nome'} • {formatPhoneNumber(conversation.contact.phoneNumber)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Preview de imagem */}
        {previewUrl && (
          <div className="p-4 border-b border-gray-200">
            <div className="relative inline-block">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-64 rounded-lg"
              />
              <button
                onClick={handleRemoveFile}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {selectedFile && (
              <p className="text-sm text-gray-600 mt-2">{selectedFile.name}</p>
            )}
          </div>
        )}

        {/* Preview de arquivo não-imagem */}
        {selectedFile && !previewUrl && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-900">{selectedFile.name}</span>
              </div>
              <button
                onClick={handleRemoveFile}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Área de mensagem */}
        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            className="w-full min-h-[200px] p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-900"
            disabled={sending}
          />
        </div>

        {/* Footer com ações */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            {/* Botão de anexo */}
            <label className="cursor-pointer">
              <input
                id="file-input"
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <div className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Paperclip className="w-5 h-5 text-gray-600" />
              </div>
            </label>

            {/* Botão de imagem */}
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*"
              />
              <div className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ImageIcon className="w-5 h-5 text-gray-600" />
              </div>
            </label>

            {/* Botão enviar */}
            <button
              onClick={handleSend}
              disabled={sending || (!message.trim() && !selectedFile)}
              className="ml-auto flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      </div>
    </div>
  );
}

