import { useRef, useState } from 'react';
import { Paperclip, Image, File, Video } from 'lucide-react';
import { Button } from '../ui/button';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export function FileUpload({ onFileSelect }: FileUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('[FileUpload] 📎 File selected from input:', {
      hasFile: !!file,
      name: file?.name,
      type: file?.type,
      size: file?.size,
    });
    
    if (file) {
      console.log('[FileUpload] ✅ Calling onFileSelect...');
      onFileSelect(file);
      setIsOpen(false);
    } else {
      console.warn('[FileUpload] ⚠️ No file selected');
    }
    
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    if (e.target) {
      e.target.value = '';
    }
  };

  const openFileDialog = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Paperclip className="w-5 h-5 text-gray-400" />
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-12 left-0 z-20 bg-[#202c33] rounded-lg shadow-lg border border-[#2a3942] p-2 w-48">
            <button
              type="button"
              onClick={() => openFileDialog('image/*')}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#2a3942] rounded transition-colors text-left"
            >
              <Image className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-300">Imagem</span>
            </button>
            <button
              type="button"
              onClick={() => openFileDialog('video/*')}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#2a3942] rounded transition-colors text-left"
            >
              <Video className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-300">Vídeo</span>
            </button>
            <button
              type="button"
              onClick={() => openFileDialog('.pdf,.doc,.docx,.xls,.xlsx')}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#2a3942] rounded transition-colors text-left"
            >
              <File className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-300">Documento</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
