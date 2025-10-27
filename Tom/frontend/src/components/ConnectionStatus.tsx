import { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import socketService from '../lib/socket';

export function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false); // Iniciar como false para evitar flash
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;

    const initializeConnection = async () => {
      try {
        // Aguardar um pouco para o socket ser inicializado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!mounted) return;

        const socket = socketService.getSocket();
        if (!socket) {
          console.warn('⚠️ Socket não disponível, tentando novamente...');
          if (retryCount < 5) {
            retryTimeout = setTimeout(() => {
              setRetryCount(prev => prev + 1);
              initializeConnection();
            }, 2000);
          } else {
            setConnectionError('Falha ao conectar após múltiplas tentativas');
          }
          return;
        }

        const handleConnect = () => {
          console.log('✅ WebSocket conectado');
          if (mounted) {
            setIsConnected(true);
            setIsReconnecting(false);
            setConnectionError(null);
            setRetryCount(0);
          }
        };

        const handleDisconnect = (reason: string) => {
          console.warn('⚠️ WebSocket desconectado:', reason);
          if (mounted) {
            setIsConnected(false);
            setIsReconnecting(false);
            setConnectionError(`Desconectado: ${reason}`);
          }
        };

        const handleReconnecting = (attemptNumber: number) => {
          console.log(`🔄 Tentando reconectar... (tentativa ${attemptNumber})`);
          if (mounted) {
            setIsReconnecting(true);
            setConnectionError(null);
          }
        };

        const handleConnectError = (error: Error) => {
          console.error('❌ Erro de conexão:', error);
          if (mounted) {
            setConnectionError(`Erro: ${error.message}`);
            setIsReconnecting(false);
          }
        };

        // Configurar listeners
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('reconnect_attempt', handleReconnecting);
        socket.on('connect_error', handleConnectError);

        // Estado inicial
        if (mounted) {
          setIsConnected(socket.connected);
          if (!socket.connected) {
            console.log('🔄 Socket não conectado, aguardando conexão...');
          }
        }

        return () => {
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
          socket.off('reconnect_attempt', handleReconnecting);
          socket.off('connect_error', handleConnectError);
        };
      } catch (error) {
        console.error('❌ Erro ao inicializar conexão:', error);
        if (mounted) {
          setConnectionError('Erro ao inicializar conexão');
        }
      }
    };

    initializeConnection();

    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [retryCount]);

  // Não mostrar nada se estiver conectado e sem problemas
  if (isConnected && !isReconnecting && !connectionError) {
    return null;
  }

  const getStatusColor = () => {
    if (connectionError) return 'bg-red-500';
    if (isReconnecting) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusIcon = () => {
    if (connectionError) return <AlertCircle className="h-5 w-5" />;
    if (isReconnecting) return <Wifi className="h-5 w-5 animate-pulse" />;
    return <WifiOff className="h-5 w-5" />;
  };

  const getStatusText = () => {
    if (connectionError) return connectionError;
    if (isReconnecting) return 'Reconectando...';
    return 'Desconectado';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${getStatusColor()} text-white`}
      >
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
        {retryCount > 0 && (
          <span className="text-xs opacity-75">({retryCount}/5)</span>
        )}
      </div>
    </div>
  );
}
