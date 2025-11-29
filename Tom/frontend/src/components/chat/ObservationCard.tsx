import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Edit } from 'lucide-react';
import { Button } from '../ui/button';
import { ObservationModal } from './ObservationModal';

interface ObservationCardProps {
  observation: string;
  conversationId: string;
  onUpdate: () => void;
  isHighlighted?: boolean; // Para destacar quando aceitar conversa transferida
}

export function ObservationCard({ observation, conversationId, onUpdate, isHighlighted = false }: ObservationCardProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [shouldHighlight, setShouldHighlight] = useState(isHighlighted);

  // Efeito para destacar quando receber conversa transferida
  useEffect(() => {
    if (isHighlighted) {
      setShouldHighlight(true);
      // Remover destaque após 5 segundos
      const timer = setTimeout(() => {
        setShouldHighlight(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  if (!observation) return null;

  return (
    <>
      <div
        className={`mb-4 rounded-lg border transition-all duration-300 ${
          shouldHighlight
            ? 'bg-gray-700/90 border-yellow-500 shadow-lg shadow-yellow-500/20 animate-pulse'
            : 'bg-gray-800/80 border-gray-600'
        }`}
      >
        <div className="flex items-start justify-between p-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">
                Observação
              </span>
              {shouldHighlight && (
                <span className="text-xs text-yellow-400 font-semibold animate-pulse">
                  ✨ Nova observação
                </span>
              )}
            </div>
            {!isMinimized && (
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">
                {observation}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="h-7 w-7 p-0 hover:bg-gray-700/50"
              title="Editar observação"
            >
              <Edit className="w-4 h-4 text-white/70" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
              className="h-7 w-7 p-0 hover:bg-gray-700/50"
              title={isMinimized ? 'Expandir' : 'Minimizar'}
            >
              {isMinimized ? (
                <ChevronDown className="w-4 h-4 text-white/70" />
              ) : (
                <ChevronUp className="w-4 h-4 text-white/70" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {showEditModal && (
        <ObservationModal
          conversationId={conversationId}
          currentObservation={observation}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false);
            onUpdate();
          }}
        />
      )}
    </>
  );
}

