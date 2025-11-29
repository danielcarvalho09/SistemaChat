import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import api from '../../lib/axios';

interface ObservationModalProps {
  conversationId: string;
  currentObservation: string;
  onClose: () => void;
  onSave: () => void;
}

export function ObservationModal({ conversationId, currentObservation, onClose, onSave }: ObservationModalProps) {
  const [observation, setObservation] = useState(currentObservation);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setObservation(currentObservation);
  }, [currentObservation]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await api.patch(`/conversations/${conversationId}/notes`, {
        internalNotes: observation || null,
      });
      onSave();
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      alert('Erro ao salvar observação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Observação da Conversa</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observação
            </label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Digite uma observação sobre esta conversa..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[120px] resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-gray-500 mt-1">
              {observation.length}/1000 caracteres
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 bg-[#008069] hover:bg-[#006d5b]"
          >
            {isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

