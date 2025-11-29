import { useState, useRef } from 'react';
import { Send, Mic, X, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EmojiPicker } from './EmojiPicker';
import { FileUpload } from './FileUpload';
import type { Message } from '../../types';

interface MessageInputProps {
  onSendMessage: (content: string, file?: File) => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  contactName?: string;
}

export function MessageInput({ onSendMessage, replyingTo, onCancelReply, contactName }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getReplyPreview = (message: Message) => {
    if (message.messageType === 'text') {
      return message.content;
    }

    const labelMap: Record<Message['messageType'], string> = {
      text: 'Mensagem',
      image: 'Imagem',
      audio: 'Áudio',
      video: 'Vídeo',
      document: 'Documento',
      location: 'Localização',
    };

    const label = labelMap[message.messageType] || 'Mensagem';

    if (message.content) {
      return `${label}: ${message.content}`;
    }

    return label;
  };

  const replyTargetName = replyingTo
    ? replyingTo.isFromContact
      ? contactName || 'Contato'
      : replyingTo.sender?.name || 'Você'
    : null;
  const replyHeading = replyTargetName
    ? `Respondendo a ${replyTargetName}`
    : 'Respondendo mensagem';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() || selectedFile) {
      onSendMessage(message.trim(), selectedFile || undefined);
      setMessage('');
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  const handleFileSelect = (file: File) => {
    console.log('[MessageInput] 📎 File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      isImage: file.type.startsWith('image/'),
    });
    
    setSelectedFile(file);
    
    // Criar preview para imagens
    if (file.type.startsWith('image/')) {
      console.log('[MessageInput] 🖼️ Creating image preview...');
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('[MessageInput] ✅ Preview created, length:', result?.length || 0);
        setPreviewUrl(result);
      };
      reader.onerror = (error) => {
        console.error('[MessageInput] ❌ Error reading file for preview:', error);
        setPreviewUrl(null);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Tentar usar codec de áudio preferido, com fallback
      const options: MediaRecorderOptions = {};
      const audioMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/mpeg',
      ];
      
      // Encontrar o primeiro tipo MIME suportado
      let selectedMimeType = 'audio/webm'; // Fallback padrão
      for (const mimeType of audioMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          options.mimeType = mimeType;
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Determinar o tipo MIME correto baseado no que foi gravado
        const recordedMimeType = mediaRecorder.mimeType || selectedMimeType;
        
        // Se o MediaRecorder gerou video/webm, tratar como áudio
        let finalMimeType = recordedMimeType;
        if (recordedMimeType.startsWith('video/webm')) {
          // Converter para audio/webm se for um áudio gravado
          finalMimeType = 'audio/webm';
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        
        // Determinar extensão baseada no tipo MIME
        let extension = '.webm';
        if (finalMimeType.includes('ogg')) {
          extension = '.ogg';
        } else if (finalMimeType.includes('mp4')) {
          extension = '.mp4';
        } else if (finalMimeType.includes('mpeg')) {
          extension = '.mp3';
        }
        
        const audioFile = new File([audioBlob], `audio-${Date.now()}${extension}`, { 
          type: finalMimeType.split(';')[0] // Remover codecs do tipo
        });
        setSelectedFile(audioFile);
        
        // Parar todas as tracks do stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Iniciar timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#202c33] border-t border-[#2a3942]">
      {replyingTo && (
        <div className="px-4 pt-3 pb-2 border-b border-[#2a3942]">
          <div className="flex items-start gap-3 bg-[#2a3942] rounded-lg p-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#00a884] uppercase">
                {replyHeading}
              </p>
              <p className="text-sm text-gray-200 line-clamp-2 break-words">
                {getReplyPreview(replyingTo)}
              </p>
            </div>
            {onCancelReply && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelReply}
                className="text-gray-300 hover:text-white"
                aria-label="Cancelar resposta"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Preview de arquivo */}
      {selectedFile && (
        <div className="px-4 pt-3 pb-2 border-b border-[#2a3942]">
          <div className="flex items-start gap-3 bg-[#2a3942] rounded-lg p-3">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-20 h-20 object-cover rounded"
              />
            ) : (
              <div className="w-20 h-20 bg-[#0b141a] rounded flex items-center justify-center">
                <span className="text-xs text-gray-400">
                  {selectedFile.type.startsWith('audio/') ? '🎵' : '📄'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-400">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Indicador de gravação */}
      {isRecording && (
        <div className="px-4 pt-3 pb-2 border-b border-[#2a3942]">
          <div className="flex items-center gap-3 bg-red-50 rounded-lg p-3">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-red-600">
              Gravando... {formatRecordingTime(recordingTime)}
            </span>
          </div>
        </div>
      )}

      {/* Input de mensagem */}
      <div className="px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          <FileUpload onFileSelect={handleFileSelect} />

          <Input
            type="text"
            placeholder="Digite uma mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-[#2a3942] border-[#2a3942] text-white placeholder:text-gray-400"
          />

          {message.trim() || selectedFile ? (
            <Button type="submit" size="sm" className="bg-[#00a884] hover:bg-[#008069] w-10 h-10 p-0">
              <Send className="w-5 h-5" />
            </Button>
          ) : isRecording ? (
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={stopRecording}
              className="text-red-600 hover:bg-red-50"
            >
              <Square className="w-5 h-5 fill-current" />
            </Button>
          ) : (
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={startRecording}
            >
              <Mic className="w-5 h-5 text-gray-400" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
