import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, FileText, Download, ExternalLink, Image as ImageIcon, Loader2, CornerDownLeft, Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Message as ChatMessage, QuotedMessage } from '../../types';

// Componente para carregar imagem sob demanda
function ImageMessage({ mediaUrl, toAbsoluteUrl, messageId }: { mediaUrl: string; toAbsoluteUrl: (url: string) => string; messageId: string }) {
  const absoluteUrl = toAbsoluteUrl(mediaUrl);
  // ✅ Se a URL já é absoluta e válida, carregar automaticamente
  const isAbsoluteUrl = mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://');
  const [loaded, setLoaded] = useState(isAbsoluteUrl); // Auto-load se for URL absoluta
  const [imageExists, setImageExists] = useState<boolean | null>(isAbsoluteUrl ? true : null);
  const [imageError, setImageError] = useState(false);
  const [isRedownloading, setIsRedownloading] = useState(false);

  // Verificar se imagem existe no servidor (apenas para URLs relativas)
  const checkImageExists = async () => {
    if (isAbsoluteUrl) {
      // Para URLs absolutas, assumir que existe e tentar carregar
      setImageExists(true);
      return;
    }
    
    try {
      const filename = mediaUrl.split('/').pop()?.split('?')[0];
      if (!filename) {
        setImageExists(false);
        return;
      }
      
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`${API_URL}/api/v1/upload/check/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      const exists = data.data?.exists || false;
      setImageExists(exists);
      
      // Se existe, carregar automaticamente
      if (exists) {
        setLoaded(true);
      }
    } catch (error) {
      console.error('Error checking image:', error);
      setImageExists(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Se imagem não existe, tentar re-baixar do WhatsApp
    if (imageExists === false) {
      setIsRedownloading(true);
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const token = localStorage.getItem('accessToken');
        
        const response = await fetch(`${API_URL}/api/v1/upload/redownload/${messageId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Imagem re-baixada com sucesso
          setImageExists(true);
          alert('Imagem baixada com sucesso!');
          // Recarregar para mostrar a imagem
          window.location.reload();
        } else {
          alert(data.message || 'Não foi possível baixar a imagem novamente');
        }
      } catch (error) {
        console.error('Error re-downloading:', error);
        alert('Erro ao tentar baixar imagem novamente');
      } finally {
        setIsRedownloading(false);
      }
      return;
    }
    
    // Download normal
    const url = toAbsoluteUrl(mediaUrl);
    const link = document.createElement('a');
    link.href = url;
    link.download = mediaUrl.split('/').pop() || 'imagem.jpg';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Verificar se imagem existe ao montar (apenas para URLs relativas)
  useEffect(() => {
    if (imageExists === null && !isAbsoluteUrl) {
      checkImageExists();
    }
  }, [mediaUrl]); // ✅ Adicionar mediaUrl como dependência para reagir a mudanças

  // Se houve erro ao carregar a imagem
  if (imageError && !loaded) {
    return (
      <div 
        className="w-full bg-gray-800 rounded-t-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors relative group"
        style={{ minHeight: '200px' }}
      >
        <div className="text-center text-gray-400" onClick={() => {
          setImageError(false);
          setLoaded(true);
        }}>
          <ImageIcon className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm">⚠️ Erro ao carregar imagem</p>
          <p className="text-xs mt-1">Clique para tentar novamente</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={isRedownloading}
          className="absolute top-2 right-2 bg-gray-900/80 hover:bg-gray-900 text-white p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Baixar imagem"
        >
          {isRedownloading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }

  if (!loaded) {
    // Verificar se imagem existe ao montar
    if (imageExists === null) {
      checkImageExists();
    }

    return (
      <div 
        className="w-full bg-gray-800 rounded-t-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors relative group"
        style={{ minHeight: '200px' }}
      >
        <div className="text-center text-gray-400" onClick={() => {
          if (imageExists !== false) {
            setLoaded(true);
          }
        }}>
          <ImageIcon className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm">
            {imageExists === false ? '⚠️ Imagem expirada (7+ dias)' : 'Clique para visualizar'}
          </p>
          {imageExists === false && (
            <p className="text-xs mt-1">Clique no botão de download para baixar novamente</p>
          )}
        </div>
        <button
          onClick={handleDownload}
          disabled={isRedownloading}
          className="absolute top-2 right-2 bg-gray-900/80 hover:bg-gray-900 text-white p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={imageExists === false ? 'Baixar novamente do WhatsApp' : 'Baixar imagem'}
        >
          {isRedownloading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="relative group w-full">
      <img
        src={absoluteUrl}
        alt="Imagem"
        className="w-full h-auto rounded-t-lg block"
        style={{ maxHeight: '300px', objectFit: 'contain' }}
        onError={() => {
          console.error('[ImageMessage] ❌ Error loading image:', absoluteUrl);
          setImageError(true);
          setLoaded(false);
        }}
        onLoad={() => {
          console.log('[ImageMessage] ✅ Image loaded successfully:', absoluteUrl);
          setImageError(false);
        }}
        loading="lazy"
      />
      <button
        onClick={handleDownload}
        className="absolute top-2 right-2 bg-gray-900/80 hover:bg-gray-900 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        title="Baixar imagem"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}

// Componente de áudio customizado estilo WhatsApp
function AudioMessage({ 
  mediaUrl, 
  toAbsoluteUrl, 
  isFromMe 
}: { 
  mediaUrl: string; 
  toAbsoluteUrl: (url: string) => string;
  isFromMe: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3",
      isFromMe ? "bg-[#005c4b]" : "bg-[#202c33]"
    )}>
      {/* Player invisível */}
      <audio 
        ref={audioRef} 
        preload="metadata" 
        className="hidden"
        crossOrigin="anonymous"
        onError={(e) => {
          console.error('❌ Erro ao carregar áudio:', e);
          console.error('URL do áudio:', toAbsoluteUrl(mediaUrl));
        }}
        onLoadStart={() => {
          console.log('🔄 Iniciando carregamento do áudio:', toAbsoluteUrl(mediaUrl));
        }}
        onCanPlay={() => {
          console.log('✅ Áudio pronto para reprodução:', toAbsoluteUrl(mediaUrl));
        }}
      >
        <source src={toAbsoluteUrl(mediaUrl)} type="audio/ogg; codecs=opus" />
        <source src={toAbsoluteUrl(mediaUrl)} type="audio/mpeg" />
        <source src={toAbsoluteUrl(mediaUrl)} type="audio/mp4" />
        <source src={toAbsoluteUrl(mediaUrl)} type="audio/webm" />
        <source src={toAbsoluteUrl(mediaUrl)} type="audio/wav" />
        Seu navegador não suporta áudio.
      </audio>

      {/* Botão Play/Pause */}
      <button
        onClick={togglePlayPause}
        disabled={isLoading}
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50",
          isFromMe 
            ? "bg-white/20 hover:bg-white/30 text-white" 
            : "bg-white/10 hover:bg-white/20 text-white"
        )}
        title={isPlaying ? 'Pausar' : 'Reproduzir'}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      {/* Barra de progresso e tempo */}
      <div className="flex-1 min-w-0">
        {/* Barra de progresso */}
        <div
          onClick={handleProgressClick}
          className={cn(
            "h-1 rounded-full cursor-pointer mb-1.5 relative",
            isFromMe ? "bg-white/30" : "bg-white/20"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-100",
              isFromMe ? "bg-white" : "bg-[#00a884]"
            )}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Tempo */}
        <div className="flex items-center justify-between text-xs">
          <span className={cn(
            "font-medium",
            isFromMe ? "text-white/70" : "text-gray-300"
          )}>
            {formatTime(currentTime)}
          </span>
          <span className={cn(
            "font-medium",
            isFromMe ? "text-white/50" : "text-gray-400"
          )}>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Ícone de áudio */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 flex items-center justify-center",
        isFromMe ? "text-white/70" : "text-gray-300"
      )}>
        <Volume2 className="w-5 h-5" />
      </div>
    </div>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  onReply?: (message: ChatMessage) => void;
}

// Função para gerar cor consistente baseada no nome
function getColorFromName(name: string): string {
  // Paleta de cores vibrantes e distintas
  const colors = [
    '#FF6B6B', // Vermelho
    '#4ECDC4', // Turquesa
    '#45B7D1', // Azul
    '#FFA07A', // Salmão
    '#98D8C8', // Verde água
    '#F7DC6F', // Amarelo
    '#BB8FCE', // Roxo
    '#85C1E2', // Azul claro
    '#F8B739', // Laranja
    '#52BE80', // Verde
    '#EC7063', // Coral
    '#5DADE2', // Azul médio
    '#F1948A', // Rosa
    '#7FB3D3', // Azul acinzentado
    '#F4D03F', // Amarelo dourado
    '#A569BD', // Roxo médio
  ];
  
  // Gerar hash simples do nome para escolher cor consistente
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Função para formatar número de telefone
function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remover caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Se começa com 55 (Brasil), formatar como (XX) XXXXX-XXXX
  if (cleaned.startsWith('55') && cleaned.length === 13) {
    return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  
  // Se tem 11 dígitos, formatar como (XX) XXXXX-XXXX
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  
  // Se tem 10 dígitos, formatar como (XX) XXXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  // Caso contrário, retornar como está
  return phone;
}

export function MessageList({ messages, onReply }: MessageListProps) {
  const getQuotedPreview = (quoted: QuotedMessage) => {
    if (quoted.messageType === 'text') {
      return quoted.content || '';
    }

    const labelMap: Record<ChatMessage['messageType'], string> = {
      text: 'Mensagem',
      image: 'Imagem',
      audio: 'Áudio',
      video: 'Vídeo',
      document: 'Documento',
      location: 'Localização',
    };

    const label = labelMap[quoted.messageType] || 'Mensagem';

    if (quoted.content) {
      return `${label}: ${quoted.content}`;
    }

    return label;
  };

  const renderQuotedMessage = (message: ChatMessage, isFromMe: boolean) => {
    if (!message.quotedMessage) return null;

    const quoted = message.quotedMessage;
    const quotedTitle =
      quoted.senderName ||
      (quoted.isFromContact ? 'Contato' : 'Você');

    const preview = getQuotedPreview(quoted);

    const containerClasses = cn(
      'mb-2 rounded-md border-l-4 px-2 py-1.5 bg-black/20',
      isFromMe ? 'border-[#06cf9c]' : 'border-[#8696a0]'
    );

    return (
      <div className={containerClasses}>
        <p className="text-xs font-semibold mb-0.5" style={{ color: isFromMe ? '#06cf9c' : '#8696a0' }}>
          {quotedTitle}
        </p>
        <p className="text-[13px] text-gray-200 line-clamp-2 break-words">
          {preview}
        </p>
      </div>
    );
  };

  const formatTime = (date: string) => {
    try {
      return format(new Date(date), 'HH:mm');
    } catch {
      return '';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />;
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
        
        // Verificar se é grupo: usar campo isGroup do contato OU verificar se tem senderName
        const isGroup = conversation?.contact?.isGroup || (message.senderName && message.isFromContact);
        
        return (
          <div
            key={message.id}
            className={cn(
              'flex w-full',
              isFromMe ? 'justify-end' : 'justify-start'
            )}
          >
            <div className="relative group" style={{ maxWidth: '70%' }}>
              {/* Nome do remetente em grupos com cor e número */}
              {isGroup && message.senderName && (
                <div className="mb-1 px-1">
                  <div 
                    className="text-xs font-medium mb-0.5"
                    style={{ color: getColorFromName(message.senderName) }}
                  >
                    {message.senderName}
                  </div>
                  {message.senderPhone && (
                    <div className="text-[10px] text-gray-500">
                      {formatPhoneNumber(message.senderPhone)}
                    </div>
                  )}
                </div>
              )}
              <div
                className={cn(
                  'rounded-lg shadow-sm relative',
                  isFromMe
                    ? 'bg-[#005c4b] text-white rounded-br-none'
                    : 'bg-[#202c33] text-white rounded-bl-none'
                )}
                onDoubleClick={() => onReply?.(message)}
              >
                {/* Citação da mensagem */}
                {message.quotedMessage && (
                  <div className="px-3 pt-3">
                    {renderQuotedMessage(message, isFromMe)}
                  </div>
                )}

                {/* Renderizar mídia */}
                {message.messageType === 'image' && message.mediaUrl && (
                  <div className={message.quotedMessage ? 'overflow-hidden' : 'pt-1 overflow-hidden'}>
                    <ImageMessage mediaUrl={message.mediaUrl} toAbsoluteUrl={toAbsoluteUrl} messageId={message.id} />
                  </div>
                )}

                {message.messageType === 'audio' && message.mediaUrl && (
                  <div className={cn(message.quotedMessage ? 'pt-2' : 'pt-1')}>
                    <AudioMessage 
                      mediaUrl={message.mediaUrl} 
                      toAbsoluteUrl={toAbsoluteUrl}
                      isFromMe={isFromMe}
                    />
                  </div>
                )}

                {message.messageType === 'video' && message.mediaUrl && (
                  <div className={cn("px-3 pb-2", message.quotedMessage ? 'pt-2' : 'pt-3')}>
                    <video controls className="w-full h-auto rounded-lg" style={{ maxHeight: '300px' }}>
                      <source src={toAbsoluteUrl(message.mediaUrl)} type="video/mp4" />
                      Seu navegador não suporta vídeo.
                    </video>
                  </div>
                )}

                {message.messageType === 'document' && message.mediaUrl && (
                  <div className={cn("px-3 pb-2", message.quotedMessage ? 'pt-2' : 'pt-3')}>
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
                  <div className="px-3 py-2 min-w-0">
                    {/* Nome do usuário em negrito (apenas para mensagens enviadas) */}
                    {isFromMe && message.sender && (
                      <p className="text-[13px] font-bold text-[#00a884] mb-1 break-words">
                        {message.sender.name}:
                      </p>
                    )}
                    <p 
                      className="text-[14px] whitespace-pre-wrap break-words leading-5"
                      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                    >
                      {message.content}
                    </p>
                  </div>
                )}

                {/* Hora e status */}
                <div className={cn(
                  "flex items-center justify-end gap-1 px-3 pb-2",
                  !message.content || message.messageType === 'document' ? 'pt-2' : ''
                )}>
                  <span className="text-[11px] text-gray-400">
                    {formatTime(message.timestamp || message.createdAt)}
                  </span>
                  {isFromMe && (
                    <span className="ml-1">{getStatusIcon(message.status)}</span>
                  )}
                </div>
              </div>
              {onReply && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReply(message);
                  }}
                  className="absolute -top-3 right-2 rounded-full bg-[#111b21] p-1 text-gray-300 opacity-0 shadow-lg transition-opacity hover:text-white group-hover:opacity-100"
                  title="Responder mensagem"
                >
                  <CornerDownLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
