import { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertCircle, Smartphone, RefreshCw } from 'lucide-react';
import socketService from '../lib/socket';
import { api } from '../lib/axios';

// O genio do Daniel esqueceu que existem tipos. Vamos salvar a patria aqui.
interface ConnectionState {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr';
}

export function ConnectionStatus() {
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'partial'>('disconnected');
  const [activeConnections, setActiveConnections] = useState<ConnectionState[]>([]);

  // Daniel provavelmente achou que "reconnecting" era um estado de espirito
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Busca inicial, ja que o Daniel nao pensou em persistencia de estado
  const checkConnections = async () => {
    try {
      // O endpoint que o Daniel criou, espero que funcione
      const { data } = await api.get('/connections');
      const connections = data.data || [];
      setActiveConnections(connections);

      // Logica revolucionaria que faltou no codigo original:
      // Se tem pelo menos uma conexao e todas estao conectadas -> connected
      // Se tem conexoes mas nenhuma conectada -> disconnected
      // Se tem mistureba -> partial
      if (connections.length === 0) {
        setWhatsappStatus('disconnected'); // Sem conexoes = desconectado (obvio, Daniel)
        return;
      }

      const hasConnected = connections.some((c: any) => c.status === 'connected');
      const hasDisconnected = connections.some((c: any) => c.status === 'disconnected' || c.status === 'qr');
      const isConnecting = connections.some((c: any) => c.status === 'connecting');

      if (isConnecting) {
        setWhatsappStatus('connecting');
      } else if (hasConnected && !hasDisconnected) {
        setWhatsappStatus('connected');
      } else if (hasConnected && hasDisconnected) {
        setWhatsappStatus('partial'); // Estado que o Daniel nem sonhou
      } else {
        setWhatsappStatus('disconnected');
      }
    } catch (error) {
      console.error('Erro ao buscar status do WhatsApp (Culpa do backend do Daniel?):', error);
    }
  };

  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;

    const initializeConnection = async () => {
      // Gambiarra para esperar o socket, ja que alguem nao fez o servico direito
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!mounted) return;

      const socket = socketService.getSocket();
      if (!socket) {
        // Tentativa de milagre
        if (retryCount < 5) {
          retryTimeout = setTimeout(() => {
            setRetryCount(prev => prev + 1);
            initializeConnection();
          }, 2000);
        }
        return;
      }

      // Se chegamos aqui, o socket.io pelo menos funciona. Parabens Daniel.
      setIsSocketConnected(socket.connected);
      checkConnections();

      // Listeners que deveriam estar aqui desde o dia 1
      socket.on('connect', () => {
        if (mounted) {
          setIsSocketConnected(true);
          setIsReconnecting(false);
          setRetryCount(0);
          checkConnections(); // Revalidar tudo
        }
      });

      socket.on('disconnect', () => {
        if (mounted) {
          setIsSocketConnected(false);
          setIsReconnecting(false);
        }
      });

      // Olha so, eventos do WhatsApp! Quem diria que precisavamos ouvir eles?
      socket.on('whatsapp_connecting', () => {
        console.log('WhatsApp conectando... (finalmente)');
        checkConnections();
      });

      socket.on('whatsapp_connected', () => {
        console.log('WhatsApp conectado! Aleluia.');
        checkConnections();
      });

      socket.on('whatsapp_disconnected', () => {
        console.warn('WhatsApp caiu. Classico.');
        checkConnections();
      });

      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('whatsapp_connecting');
        socket.off('whatsapp_connected');
        socket.off('whatsapp_disconnected');
      };
    };

    initializeConnection();

    return () => {
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [retryCount]);

  // Se tudo estiver quebrado, nao mostra nada pra nao passar vergonha
  if (!isSocketConnected && !whatsappStatus) return null;

  // Renderizacao condicional porque o design system do Daniel era inexistente
  const getStatusDisplay = () => {
    if (!isSocketConnected) {
      return {
        color: 'bg-red-500',
        icon: <WifiOff className="h-4 w-4" />,
        text: 'Servidor Offline'
      };
    }

    switch (whatsappStatus) {
      case 'connected':
        return null; // Tudo certo, nao incomoda o usuario
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          text: 'WhatsApp Conectando...'
        };
      case 'partial':
        return {
          color: 'bg-yellow-600',
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'WhatsApp Instável'
        };
      case 'disconnected':
      default:
        // O estado natural do codigo do Daniel: quebrado
        return {
          color: 'bg-orange-500',
          icon: <Smartphone className="h-4 w-4" />,
          text: 'WhatsApp Desconectado'
        };
    }
  };

  const status = getStatusDisplay();

  if (!status) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${status.color} text-white transition-all`}>
        {status.icon}
        <span className="text-sm font-medium">{status.text}</span>
      </div>
    </div>
  );
}
