import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import socketService from '../lib/socket';

export function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleReconnecting = () => {
      setIsReconnecting(true);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect_attempt', handleReconnecting);

    // Estado inicial
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect_attempt', handleReconnecting);
    };
  }, []);

  // Não mostrar nada se estiver conectado
  if (isConnected && !isReconnecting) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${
          isReconnecting
            ? 'bg-yellow-500 text-white'
            : 'bg-red-500 text-white'
        }`}
      >
        {isReconnecting ? (
          <>
            <Wifi className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-medium">Reconectando...</span>
          </>
        ) : (
          <>
            <WifiOff className="h-5 w-5" />
            <span className="text-sm font-medium">Desconectado</span>
          </>
        )}
      </div>
    </div>
  );
}
