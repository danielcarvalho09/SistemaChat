import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';
import { socketService } from '../../lib/socket';
import { useWebSocketContext } from '../../contexts/WebSocketContext';

export function ConnectionStatus() {
  const { isConnected } = useWebSocketContext();
  const [status, setStatus] = useState<{
    connected: boolean;
    lastPong: number;
    lastSync: number;
    pageVisible: boolean;
    reconnectAttempts: number;
  }>({
    connected: false,
    lastPong: 0,
    lastSync: 0,
    pageVisible: true,
    reconnectAttempts: 0,
  });

  useEffect(() => {
    const updateStatus = () => {
      const currentStatus = socketService.getConnectionStatus();
      setStatus(currentStatus);
    };

    // Atualizar status a cada segundo
    const interval = setInterval(updateStatus, 1000);
    updateStatus();

    return () => clearInterval(interval);
  }, []);

  const handleForceSync = () => {
    socketService.forceSyncNow();
  };

  const handleForceReconnect = () => {
    socketService.forceReconnect();
  };

  // Determinar cor do indicador
  const getIndicatorColor = () => {
    if (status.connected && status.lastPong < 30000) {
      return 'bg-green-500'; // Verde - tudo OK
    } else if (status.connected && status.lastPong < 60000) {
      return 'bg-yellow-500'; // Amarelo - conectado mas pong atrasado
    } else if (status.reconnectAttempts > 0) {
      return 'bg-orange-500 animate-pulse'; // Laranja piscando - reconectando
    } else {
      return 'bg-red-500'; // Vermelho - desconectado
    }
  };

  const getStatusText = () => {
    if (status.connected && status.lastPong < 30000) {
      return 'Conectado';
    } else if (status.connected && status.lastPong < 60000) {
      return 'Conectado (lento)';
    } else if (status.reconnectAttempts > 0) {
      return `Reconectando... (${status.reconnectAttempts})`;
    } else {
      return 'Desconectado';
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Indicador compacto */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          {/* Indicador visual */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getIndicatorColor()}`} />
            {status.connected ? (
              <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
          </div>

          {/* Status */}
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-900 dark:text-white">
              {getStatusText()}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              <span>Sync: {formatTime(status.lastSync)}</span>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-1">
            <button
              onClick={handleForceSync}
              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="Forçar sincronização"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {!status.connected && (
              <button
                onClick={handleForceReconnect}
                className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                title="Forçar reconexão"
              >
                <WifiOff className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Detalhes expandidos (debug) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <div className="grid grid-cols-2 gap-1">
              <span>Último pong:</span>
              <span className="text-right">{formatTime(status.lastPong)}</span>
              <span>Página visível:</span>
              <span className="text-right">{status.pageVisible ? 'Sim' : 'Não'}</span>
              <span>Tentativas:</span>
              <span className="text-right">{status.reconnectAttempts}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
