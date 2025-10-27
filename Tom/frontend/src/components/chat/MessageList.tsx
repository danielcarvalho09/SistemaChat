import { useState } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, FileText, Download, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

// Componente para carregar imagem sob demanda
function ImageMessage({ mediaUrl, toAbsoluteUrl }: { mediaUrl: string; toAbsoluteUrl: (url: string) => string }) {
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    return (
      <div 
        className="mb-1 bg-gray-800 rounded-t-lg flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"
        style={{ minHeight: '200px', minWidth: '250px' }}
        onClick={() => setLoaded(true)}
      >
        <div className="text-center text-gray-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm">Clique para carregar imagem</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-1">
      <img
        src={toAbsoluteUrl(mediaUrl)}
        alt="Imagem"
        className="max-w-full h-auto rounded-t-lg"
        style={{ maxHeight: '300px', objectFit: 'cover' }}
      />
    </div>
  );
}

interface Message {
  id: string;
  content: string;
  isFromContact: boolean;
  createdAt: string;
  timestamp?: string;
  status?: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location';
  mediaUrl?: string | null;
  sender?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const formatTime = (date: string) => {
    try {
      return format(new Date(date), 'HH:mm');
    } catch {
      return '';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-500" />;
      case 'sent':
        return <Check className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  // Normalizar URL absoluta para mídias
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const toAbsoluteUrl = (url?: string | null) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url; // já é absoluta
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Ordenar mensagens por timestamp asc (mais antigas em cima, mais novas embaixo)
  const orderedMessages = [...messages].sort((a, b) => {
    const aTime = new Date(a.timestamp || a.createdAt).getTime();
    const bTime = new Date(b.timestamp || b.createdAt).getTime();
    return aTime - bTime;
  });

  if (orderedMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-6xl mb-4">💬</div>
        <div>Nenhuma mensagem ainda</div>
        <div className="text-sm mt-2">Envie a primeira mensagem para iniciar a conversa</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {orderedMessages.map((message) => {
        // isFromContact = true -> mensagem do cliente (esquerda, branco)
        // isFromContact = false -> mensagem do agente (direita, verde)
        const isFromMe = !message.isFromContact;
        
        return (
          <div
            key={message.id}
            className={cn(
              'flex',
              isFromMe ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[70%] rounded-lg shadow-sm relative overflow-hidden',
                isFromMe
                  ? 'bg-[#005c4b] text-white rounded-br-none'
                  : 'bg-[#202c33] text-white rounded-bl-none'
              )}
            >
              {/* Renderizar mídia */}
              {message.messageType === 'image' && message.mediaUrl && (
                <ImageMessage mediaUrl={message.mediaUrl} toAbsoluteUrl={toAbsoluteUrl} />
              )}

              {message.messageType === 'audio' && message.mediaUrl && (
                <div className="mb-1">
                  <audio 
                    controls 
                    className="w-full" 
                    preload="metadata"
                    controlsList="nodownload"
                  >
                    <source src={toAbsoluteUrl(message.mediaUrl)} type="audio/ogg; codecs=opus" />
                    <source src={toAbsoluteUrl(message.mediaUrl)} type="audio/mpeg" />
                    <source src={toAbsoluteUrl(message.mediaUrl)} type="audio/mp4" />
                    <source src={toAbsoluteUrl(message.mediaUrl)} type="audio/webm" />
                    Seu navegador não suporta áudio.
                  </audio>
                </div>
              )}

              {message.messageType === 'video' && message.mediaUrl && (
                <div className="mb-1">
                  <video controls className="max-w-full h-auto rounded-t-lg" style={{ maxHeight: '300px' }}>
                    <source src={toAbsoluteUrl(message.mediaUrl)} type="video/mp4" />
                    Seu navegador não suporta vídeo.
                  </video>
                </div>
              )}

              {message.messageType === 'document' && message.mediaUrl && (
                <div className="mb-1">
                  {(() => {
                    const fileUrl = toAbsoluteUrl(message.mediaUrl);
                    const extension = (message.mediaUrl || '').split('.').pop()?.toLowerCase();
                    
                    // PDF - Visualização robusta com fallback
                    if (extension === 'pdf') {
                      return (
                        <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                          <div className="flex items-center justify-between bg-gray-100 px-3 py-2 border-b">
                            <span className="text-xs text-gray-700 truncate max-w-[70%]">
                              {message.content || 'Documento PDF'}
                            </span>
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Abrir
                            </a>
                          </div>
                          <div className="w-full" style={{ height: '500px' }}>
                            <object data={`${fileUrl}#view=FitH`} type="application/pdf" width="100%" height="100%">
                              <iframe src={fileUrl} className="w-full h-full" title="PDF Viewer" />
                            </object>
                          </div>
                        </div>
                      );
                    }
                    
                    // TXT - Visualização direta
                    if (extension === 'txt') {
                      return (
                        <div className="bg-white rounded-t-lg overflow-hidden border border-gray-200">
                          <iframe
                            src={fileUrl}
                            className="w-full"
                            style={{ height: '300px', border: 'none' }}
                            title="Text Viewer"
                          />
                        </div>
                      );
                    }
                    
                    // DOCX, XLSX, PPTX - Google Docs Viewer
                    if (['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(extension || '')) {
                      const encodedUrl = encodeURIComponent(fileUrl);
                      return (
                        <div className="bg-gray-100 rounded-t-lg overflow-hidden">
                          <iframe
                            src={`https://docs.google.com/gview?url=${encodedUrl}&embedded=true`}
                            className="w-full"
                            style={{ height: '500px', border: 'none' }}
                            title="Document Viewer"
                          />
                          <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 flex items-center justify-between">
                            <span className="text-xs text-gray-600">
                              {message.content || 'Documento'} • {extension?.toUpperCase()}
                            </span>
                            <a
                              href={fileUrl}
                              download
                              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              Baixar
                            </a>
                          </div>
                        </div>
                      );
                    }
                    
                    // Outros documentos - Card com download
                    return (
                      <div className="bg-gray-100 p-4 rounded-t-lg flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {message.content || 'Documento'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {extension?.toUpperCase()} • Clique para baixar
                          </p>
                        </div>
                        <a
                          href={fileUrl}
                          download
                          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <Download className="w-5 h-5 text-gray-600" />
                        </a>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Texto/Caption */}
              {message.content && message.messageType !== 'document' && (
                <div className="px-3 py-2">
                  {/* Nome do usuário em negrito (apenas para mensagens enviadas) */}
                  {isFromMe && message.sender && (
                    <p className="text-[13px] font-bold text-[#00a884] mb-1">
                      {message.sender.name}:
                    </p>
                  )}
                  <p className="text-[14px] whitespace-pre-wrap break-words leading-5">
                    {message.content}
                  </p>
                </div>
              )}

              {/* Hora e status */}
              <div className="flex items-center justify-end gap-1 px-3 pb-2">
                <span className="text-[11px] text-gray-400">
                  {formatTime(message.timestamp || message.createdAt)}
                </span>
                {isFromMe && (
                  <span className="ml-1">{getStatusIcon(message.status)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
