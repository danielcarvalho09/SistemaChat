import { useState, useEffect, useRef } from 'react';
import { Plus, Smartphone, QrCode, Power, Trash2, RefreshCw, X, Edit } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/axios';
import socketService from '../../lib/socket';

// Componente do ícone WhatsApp em cinza escuro
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    fill="#374151" 
    viewBox="0 0 32 32" 
    version="1.1" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M26.576 5.363c-2.69-2.69-6.406-4.354-10.511-4.354-8.209 0-14.865 6.655-14.865 14.865 0 2.732 0.737 5.291 2.022 7.491l-0.038-0.070-2.109 7.702 7.879-2.067c2.051 1.139 4.498 1.809 7.102 1.809h0.006c8.209-0.003 14.862-6.659 14.862-14.868 0-4.103-1.662-7.817-4.349-10.507l0 0zM16.062 28.228h-0.005c-0 0-0.001 0-0.001 0-2.319 0-4.489-0.64-6.342-1.753l0.056 0.031-0.451-0.267-4.675 1.227 1.247-4.559-0.294-0.467c-1.185-1.862-1.889-4.131-1.889-6.565 0-6.822 5.531-12.353 12.353-12.353s12.353 5.531 12.353 12.353c0 6.822-5.53 12.353-12.353 12.353h-0zM22.838 18.977c-0.371-0.186-2.197-1.083-2.537-1.208-0.341-0.124-0.589-0.185-0.837 0.187-0.246 0.371-0.958 1.207-1.175 1.455-0.216 0.249-0.434 0.279-0.805 0.094-1.15-0.466-2.138-1.087-2.997-1.852l0.010 0.009c-0.799-0.74-1.484-1.587-2.037-2.521l-0.028-0.052c-0.216-0.371-0.023-0.572 0.162-0.757 0.167-0.166 0.372-0.434 0.557-0.65 0.146-0.179 0.271-0.384 0.366-0.604l0.006-0.017c0.043-0.087 0.068-0.188 0.068-0.296 0-0.131-0.037-0.253-0.101-0.357l0.002 0.003c-0.094-0.186-0.836-2.014-1.145-2.758-0.302-0.724-0.609-0.625-0.836-0.637-0.216-0.010-0.464-0.012-0.712-0.012-0.395 0.010-0.746 0.188-0.988 0.463l-0.001 0.002c-0.802 0.761-1.3 1.834-1.3 3.023 0 0.026 0 0.053 0.001 0.079l-0-0.004c0.131 1.467 0.681 2.784 1.527 3.857l-0.012-0.015c1.604 2.379 3.742 4.282 6.251 5.564l0.094 0.043c0.548 0.248 1.25 0.513 1.968 0.74l0.149 0.041c0.442 0.14 0.951 0.221 1.479 0.221 0.303 0 0.601-0.027 0.889-0.078l-0.031 0.004c1.069-0.223 1.956-0.868 2.497-1.749l0.009-0.017c0.165-0.366 0.261-0.793 0.261-1.242 0-0.185-0.016-0.366-0.047-0.542l0.003 0.019c-0.092-0.155-0.34-0.247-0.712-0.434z"></path>
  </svg>
);

interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  isActive: boolean;
}

interface Connection {
  id: string;
  name: string;
  phoneNumber: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr';
  qrCode?: string;
  isActive: boolean;
  isMatriz?: boolean;
  departmentIds?: string[];
  lastSeen?: string;
  createdAt?: string;
}

export function Connections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [editConnection, setEditConnection] = useState<{
    name: string;
    isMatriz: boolean;
  }>({ name: '', isMatriz: false });
  const [newConnection, setNewConnection] = useState({ 
    name: '', 
    phoneNumber: '',
    isMatriz: false,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const socketRef = useRef<any>(null);
  const hasSetupListeners = useRef(false);
  const connectionTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map()); // ✅ Timeouts por conexão
  const connectingConnections = useRef<Set<string>>(new Set()); // ✅ Rastrear conexões em andamento

  useEffect(() => {
    fetchConnections();
    fetchDepartments();
    
    // Evitar setup duplicado em Strict Mode
    if (hasSetupListeners.current) return;
    hasSetupListeners.current = true;
    
    // Aguardar socket estar pronto
    const setupSocket = () => {
      const socket = socketService.getSocket();
      if (!socket) {
        console.warn('⚠️ Socket ainda não está conectado, aguardando...');
        setTimeout(setupSocket, 500);
        return;
      }

      socketRef.current = socket;
      console.log('✅ Usando WebSocket global');

    // Evento: QR Code gerado
    socket.on('whatsapp_qr_code', (data: { connectionId: string; qrCode: string }) => {
      console.log('✅ QR Code recebido para:', data.connectionId);

      // ✅ Limpar do set de conexões em andamento (conexão iniciada com sucesso)
      connectingConnections.current.delete(data.connectionId);

      // Atualizar conexões
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === data.connectionId
            ? { ...conn, status: 'qr' as const, qrCode: data.qrCode }
            : conn
        )
      );

      // Buscar conexão e abrir/atualizar modal
      setConnections((prev) => {
        const conn = prev.find((c) => c.id === data.connectionId);
        if (conn) {
          console.log('🎯 Abrindo/atualizando modal com QR Code para:', conn.name);
          setSelectedConnection(conn);
          setShowQRModal(true);
        }
        return prev;
      });
    });

    // Evento: WhatsApp conectando
    socket.on('whatsapp_connecting', (data: { connectionId: string }) => {
      // ✅ CRÍTICO: Verificar se já está conectando/conectado antes de atualizar
      setConnections((prev) => {
        const connection = prev.find(c => c.id === data.connectionId);
        
        // Ignorar se já está conectado (evitar loops de reconexão)
        if (connection?.status === 'connected') {
          console.warn(`⚠️ Evento 'whatsapp_connecting' recebido mas conexão ${data.connectionId} já está conectada - ignorando`);
          return prev; // Não atualizar
        }
        
        // Se já está conectando, apenas logar (evitar múltiplas atualizações)
        if (connection?.status === 'connecting') {
          console.debug(`ℹ️ Evento 'whatsapp_connecting' recebido mas conexão ${data.connectionId} já está conectando - ignorando duplicata`);
          return prev; // Não atualizar novamente
        }
        
        // Atualizar apenas se realmente precisa mudar de status
        console.log('🔄 WhatsApp conectando:', data.connectionId);
        return prev.map((conn) =>
          conn.id === data.connectionId ? { ...conn, status: 'connecting' } : conn
        );
      });
      
      // Atualizar modal apenas se realmente mudou de status
      setSelectedConnection((prev) => {
        if (prev?.id === data.connectionId && prev.status !== 'connected' && prev.status !== 'connecting') {
          return { ...prev, status: 'connecting' };
        }
        return prev;
      });
    });

    // Evento: WhatsApp conectado
    socket.on('whatsapp_connected', (data: { connectionId: string }) => {
      console.log('✅ WhatsApp conectado:', data.connectionId);
      
      // ✅ Limpar do set de conexões em andamento
      connectingConnections.current.delete(data.connectionId);
      
      // ✅ Limpar timeout ao conectar com sucesso
      const timeoutId = connectionTimeouts.current.get(data.connectionId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        connectionTimeouts.current.delete(data.connectionId);
      }
      
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === data.connectionId ? { ...conn, status: 'connected' } : conn
        )
      );
      
      // Fechar modal se estiver aberto para esta conexão
      setSelectedConnection((prev) => {
        if (prev?.id === data.connectionId) {
          console.log('✅ Fechando modal - conexão estabelecida');
          setShowQRModal(false);
          return null;
        }
        return prev;
      });
    });

    // Evento: WhatsApp desconectado
    socket.on('whatsapp_disconnected', (data: { connectionId: string }) => {
      console.log('❌ WhatsApp desconectado:', data.connectionId);
      
      // ✅ Limpar do set de conexões em andamento
      connectingConnections.current.delete(data.connectionId);
      
      // ✅ Limpar timeout ao desconectar
      const timeoutId = connectionTimeouts.current.get(data.connectionId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        connectionTimeouts.current.delete(data.connectionId);
      }
      
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === data.connectionId ? { ...conn, status: 'disconnected' } : conn
        )
      );
      
      // Fechar modal se estiver aberto para esta conexão
      setSelectedConnection((prev) => {
        if (prev?.id === data.connectionId) {
          setShowQRModal(false);
          return null;
        }
        return prev;
      });
    });

    // ✅ Evento: WhatsApp falhou ao conectar (novo)
    socket.on('whatsapp_connection_failed', (data: { connectionId: string; error?: string }) => {
      console.error('❌ WhatsApp falhou ao conectar:', data.connectionId, data.error);
      
      // ✅ Limpar do set de conexões em andamento
      connectingConnections.current.delete(data.connectionId);
      
      // ✅ Limpar timeout ao falhar
      const timeoutId = connectionTimeouts.current.get(data.connectionId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        connectionTimeouts.current.delete(data.connectionId);
      }
      
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === data.connectionId ? { ...conn, status: 'disconnected' } : conn
        )
      );
      
      // Fechar modal se estiver aberto
      setSelectedConnection((prev) => {
        if (prev?.id === data.connectionId) {
          setShowQRModal(false);
          return null;
        }
        return prev;
      });

      // Mostrar alerta de erro
      alert(`Falha ao conectar WhatsApp: ${data.error || 'Erro desconhecido'}`);
    });

      return () => {
        // Remover listeners ao desmontar
        socket.off('whatsapp_qr_code');
        socket.off('whatsapp_connecting');
        socket.off('whatsapp_connected');
        socket.off('whatsapp_disconnected');
        socket.off('whatsapp_connection_failed');
      };
    };

    // Iniciar setup
    setupSocket();

    return () => {
      hasSetupListeners.current = false;
      // ✅ Limpar todos os timeouts ao desmontar
      connectionTimeouts.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      connectionTimeouts.current.clear();
    };
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await api.get('/connections');
      const fetchedConnections = response.data.data || [];
      
      // ✅ IMPORTANTE: Não sobrescrever status de conexões que estão conectando/conectadas
      // se ainda estiverem em estado de conexão ativa no frontend
      setConnections((prevConnections) => {
        return fetchedConnections.map((fetched: Connection) => {
          const existing = prevConnections.find(c => c.id === fetched.id);
          
          // Se existe uma conexão no estado anterior e está conectando ou conectada,
          // manter o status do estado anterior se o banco diz que está desconectada
          // (pode ser um problema de sincronização)
          if (existing && (existing.status === 'connecting' || existing.status === 'connected')) {
            // Se o banco diz desconectado mas o frontend diz conectado/conectando,
            // manter o status do frontend (mais recente)
            if (fetched.status === 'disconnected') {
              console.warn(`⚠️ Status mismatch para ${fetched.id}: Frontend=${existing.status}, Banco=disconnected - mantendo status do frontend`);
              return existing;
            }
          }
          
          return fetched;
        });
      });
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Erro ao buscar setores:', error);
    }
  };

  const handleEditClick = async (connection: Connection) => {
    try {
      // Buscar dados completos da conexão
      const response = await api.get(`/connections/${connection.id}`);
      const fullConnection = response.data.data;
      
      setSelectedConnection(fullConnection);
      setEditConnection({
        name: fullConnection.name,
        isMatriz: fullConnection.isMatriz || false,
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Erro ao buscar conexão:', error);
      alert('Erro ao carregar dados da conexão');
    }
  };

  const handleUpdateConnection = async () => {
    if (!selectedConnection) return;
    
    if (!editConnection.name) {
      alert('Preencha o nome da conexão');
      return;
    }

    try {
      await api.patch(`/connections/${selectedConnection.id}`, {
        name: editConnection.name,
        isMatriz: editConnection.isMatriz,
      });
      
      setShowEditModal(false);
      setSelectedConnection(null);
      setEditConnection({ name: '', isMatriz: false });
      fetchConnections();
    } catch (error) {
      console.error('Erro ao atualizar conexão:', error);
      alert('Erro ao atualizar conexão');
    }
  };

  const handleAddConnection = async () => {
    if (!newConnection.name) {
      alert('Preencha o nome da conexão');
      return;
    }

    if (!newConnection.phoneNumber) {
      alert('Preencha o número de telefone');
      return;
    }

    try {
      const cleanPhone = newConnection.phoneNumber.replace(/\D/g, '');
      
      if (cleanPhone.length < 10) {
        alert('Número de telefone inválido (mínimo 10 dígitos)');
        return;
      }

      await api.post('/connections', {
        name: newConnection.name,
        phoneNumber: cleanPhone,
        isMatriz: newConnection.isMatriz,
      });
      
      setShowAddModal(false);
      setNewConnection({ 
        name: '', 
        phoneNumber: '',
        isMatriz: false,
      });
      fetchConnections();
    } catch (error) {
      console.error('Erro ao adicionar conexão:', error);
      alert('Erro ao adicionar conexão');
    }
  };

  const handleConnect = async (connectionId: string) => {
    // ✅ PROTEÇÃO: Evitar múltiplas chamadas simultâneas
    if (connectingConnections.current.has(connectionId)) {
      console.warn(`⚠️ Conexão ${connectionId} já está em processo de conexão, ignorando...`);
      return;
    }

    const connection = connections.find(c => c.id === connectionId);
    if (connection?.status === 'connecting') {
      console.warn(`⚠️ Conexão ${connectionId} já está em processo de conexão (status), ignorando...`);
      return;
    }

    // Marcar como em processo de conexão
    connectingConnections.current.add(connectionId);

    try {
      // ✅ Limpar timeout anterior se existir
      const existingTimeout = connectionTimeouts.current.get(connectionId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        connectionTimeouts.current.delete(connectionId);
      }

      // Atualizar status para "connecting"
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === connectionId ? { ...conn, status: 'connecting' } : conn
        )
      );

      console.log(`🔄 Iniciando conexão: ${connectionId}`);

      // ✅ Timeout de 30 segundos para conexão
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: Conexão demorou mais de 30 segundos')), 30000);
      });

      // ✅ Requisição com timeout
      await Promise.race([
        api.post(`/connections/${connectionId}/connect`),
        timeoutPromise,
      ]) as Promise<any>;
      
      console.log(`✅ Requisição de conexão enviada`);
      
      // ✅ Timeout automático: se após 60s ainda estiver "connecting", voltar para "disconnected"
      const timeoutId = setTimeout(() => {
        setConnections((prev) =>
          prev.map((conn) => {
            if (conn.id === connectionId && conn.status === 'connecting') {
              console.warn(`⚠️ Conexão ${connectionId} travada em "connecting" há mais de 60s, resetando para "disconnected"`);
              return { ...conn, status: 'disconnected' };
            }
            return conn;
          })
        );
        connectionTimeouts.current.delete(connectionId);
      }, 60000); // 60 segundos
      
      connectionTimeouts.current.set(connectionId, timeoutId);

      // O QR Code virá via WebSocket
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      
      // ✅ Limpar timeout em caso de erro
      const timeoutId = connectionTimeouts.current.get(connectionId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        connectionTimeouts.current.delete(connectionId);
      }
      
      // ✅ Mensagem de erro mais descritiva
      const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido ao conectar';
      alert(`Erro ao conectar: ${errorMessage}`);
      
      // ✅ Sempre voltar para "disconnected" em caso de erro
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === connectionId ? { ...conn, status: 'disconnected' } : conn
        )
      );
    } finally {
      // ✅ SEMPRE remover do set de conexões em andamento
      connectingConnections.current.delete(connectionId);
    }
  };

  const handleCancelConnection = async (connectionId: string) => {
    try {
      // ✅ Limpar timeout ao cancelar
      const timeoutId = connectionTimeouts.current.get(connectionId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        connectionTimeouts.current.delete(connectionId);
      }

      // ✅ Cancelar conexão em andamento
      console.log(`🛑 Cancelando conexão ${connectionId}...`);
      
      // Atualizar status para "disconnected" imediatamente
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === connectionId ? { ...conn, status: 'disconnected' } : conn
        )
      );
      
      // Tentar desconectar no backend (pode estar em processo de conexão)
      try {
        await api.post(`/connections/${connectionId}/disconnect`);
      } catch (error) {
        console.warn('⚠️ Erro ao cancelar conexão no backend (pode ser normal):', error);
        // Não mostrar erro se a conexão não existir ainda
      }
      
      // Fechar modal se estiver aberto
      setSelectedConnection((prev) => {
        if (prev?.id === connectionId) {
          setShowQRModal(false);
          return null;
        }
        return prev;
      });
      
      console.log(`✅ Conexão ${connectionId} cancelada`);
    } catch (error) {
      console.error('Erro ao cancelar conexão:', error);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Tem certeza que deseja desconectar?')) return;
    
    try {
      // ✅ Se estiver em "connecting", cancelar primeiro
      const connection = connections.find(c => c.id === connectionId);
      if (connection?.status === 'connecting') {
        await handleCancelConnection(connectionId);
        return;
      }
      
      await api.post(`/connections/${connectionId}/disconnect`);
      fetchConnections();
    } catch (error) {
      console.error('Erro ao desconectar:', error);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conexão? Todas as conversas e mensagens associadas serão perdidas.')) return;
    
    try {
      await api.delete(`/connections/${connectionId}`);
      alert('Conexão excluída com sucesso!');
      fetchConnections();
    } catch (error: any) {
      console.error('Erro ao excluir conexão:', error);
      alert(`Erro ao excluir conexão: ${error.response?.data?.message || error.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800';
      case 'disconnected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando...';
      case 'disconnected':
        return 'Desconectado';
      default:
        return status;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header - Responsivo */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Conexões WhatsApp</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Gerencie suas conexões com o WhatsApp Business
            </p>
          </div>
          <Button 
            className="bg-[#008069] hover:bg-[#006d5b] w-full sm:w-auto"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Conexão</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      {/* Content - Responsivo */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Carregando...</div>
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-4">
            <WhatsAppIcon className="w-16 h-16 mb-4 text-gray-700" />
            <div className="text-gray-700 font-semibold mb-2 text-center">Nenhuma conexão configurada</div>
            <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
              Adicione uma nova conexão para começar a usar o WhatsApp
            </p>
            <Button 
              className="bg-[#008069] hover:bg-[#006d5b]"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeira Conexão
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-200"
              >
                {/* Header - Responsivo */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                      <Smartphone className="w-6 h-6 sm:w-7 sm:h-7 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate mb-1">{connection.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">{connection.phoneNumber || 'WhatsApp Business'}</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="mb-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      connection.status
                    )}`}
                  >
                    {getStatusLabel(connection.status)}
                  </span>
                </div>

                {/* Actions - Responsivo e Touch-Friendly */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                  {connection.status === 'disconnected' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnect(connection.id)}
                      disabled={connectingConnections.current.has(connection.id) || connection.status === 'connecting'}
                      className="flex-1 min-w-[120px] h-9 sm:h-8 touch-manipulation"
                    >
                      <QrCode className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">
                        {(connectingConnections.current.has(connection.id) || connection.status === 'connecting') ? 'Conectando...' : 'Conectar'}
                      </span>
                    </Button>
                  ) : connection.status === 'connecting' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelConnection(connection.id)}
                      className="flex-1 min-w-[120px] h-9 sm:h-8 bg-red-50 hover:bg-red-100 text-red-700 border-red-300 touch-manipulation"
                    >
                      <Power className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">Cancelar</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(connection.id)}
                      className="flex-1 min-w-[120px] h-9 sm:h-8 touch-manipulation"
                    >
                      <Power className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">Desconectar</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClick(connection)}
                    className="h-9 sm:h-8 w-9 sm:w-8 p-0 touch-manipulation"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchConnections()}
                    className="h-9 sm:h-8 w-9 sm:w-8 p-0 touch-manipulation"
                    title="Atualizar"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(connection.id)}
                    className="h-9 sm:h-8 w-9 sm:w-8 p-0 touch-manipulation"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Connection Modal - Responsivo */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold">Nova Conexão WhatsApp</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModal(false)}
                className="touch-manipulation"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Conexão
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Atendimento Principal"
                  value={newConnection.name}
                  onChange={(e) =>
                    setNewConnection({ ...newConnection, name: e.target.value })
                  }
                  className="text-base sm:text-sm min-h-[44px] touch-manipulation"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Telefone
                </label>
                <Input
                  type="tel"
                  placeholder="Ex: 5516992009906"
                  value={newConnection.phoneNumber}
                  onChange={(e) =>
                    setNewConnection({ ...newConnection, phoneNumber: e.target.value })
                  }
                  className="text-base sm:text-sm min-h-[44px] touch-manipulation"
                  inputMode="numeric"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Apenas números (com código do país). Ex: 5516992009906
                </p>
              </div>
              
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newConnection.isMatriz}
                    onChange={(e) =>
                      setNewConnection({ ...newConnection, isMatriz: e.target.checked })
                    }
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Conexão Matriz (vê todas as conversas)
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Marque se esta conexão deve ter acesso a todas as conversas, independente do setor
                </p>
                <p className="text-xs text-gray-500 mt-2 ml-6">
                  👉 Após criar, associe esta conexão a um usuário em "Gerenciamento de Usuários"
                </p>
              </div>
              
              <p className="text-xs text-gray-500">
                Após adicionar, clique em "Conectar" para escanear o QR Code
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="flex-1 touch-manipulation"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddConnection}
                className="flex-1 bg-[#008069] hover:bg-[#006d5b] touch-manipulation"
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal - Responsivo */}
      {showQRModal && selectedConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold">Escaneie o QR Code</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQRModal(false)}
                className="touch-manipulation"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="bg-white p-2 sm:p-4 rounded-lg border-2 border-gray-200 mb-4 flex items-center justify-center">
              {/* ✅ Verificar se conexão ainda está em status que precisa de QR */}
              {(() => {
                const connection = connections.find(c => c.id === selectedConnection.id);
                // Se conexão não existe mais ou não está mais em status 'qr'/'connecting', fechar modal
                if (!connection || (connection.status !== 'qr' && connection.status !== 'connecting')) {
                  setTimeout(() => setShowQRModal(false), 100);
                  return (
                    <div className="w-64 h-64 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <div className="text-4xl mb-2">✅</div>
                        <p>Conexão já estabelecida</p>
                      </div>
                    </div>
                  );
                }
                
                // Se tem QR code, mostrar
                if (selectedConnection.qrCode) {
                  // ✅ Verificar se é data URL (base64) ou URL de API
                  const isDataUrl = selectedConnection.qrCode.startsWith('data:image');
                  return (
                    <img
                      src={selectedConnection.qrCode}
                      alt="QR Code"
                      className="w-full max-w-[256px] h-auto aspect-square"
                      onError={(e) => {
                        console.error('❌ Erro ao carregar imagem do QR Code');
                        // ✅ Prevenir recarregamento automático - esconder imagem e não tentar novamente
                        e.currentTarget.style.display = 'none';
                        // Se não é data URL e falhou, pode ser que a URL não existe mais
                        if (!isDataUrl) {
                          console.log('⚠️ QR Code URL não encontrada, aguardando novo QR code via WebSocket...');
                        }
                      }}
                      loading="eager"
                      decoding="async"
                    />
                  );
                }
                
                // Se não tem QR code ainda, mostrar loading
                return (
                  <div className="w-full max-w-[256px] aspect-square flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-4xl mb-2">⏳</div>
                      <p className="text-sm">Gerando QR Code...</p>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
              <p className="text-xs sm:text-sm text-blue-900 font-medium mb-2">
                📱 Como conectar:
              </p>
              <ol className="text-xs sm:text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Abra o WhatsApp no seu celular</li>
                <li>Toque em Menu (⋮) ou Configurações</li>
                <li>Toque em "Aparelhos conectados"</li>
                <li>Toque em "Conectar um aparelho"</li>
                <li>Aponte seu celular para esta tela</li>
              </ol>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Aguardando escaneamento...
            </div>
          </div>
        </div>
      )}

      {/* Edit Connection Modal - Responsivo */}
      {showEditModal && selectedConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold">Editar Conexão</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditModal(false)}
                className="touch-manipulation"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Conexão
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Atendimento Principal"
                  value={editConnection.name}
                  onChange={(e) =>
                    setEditConnection({ ...editConnection, name: e.target.value })
                  }
                  className="text-base sm:text-sm min-h-[44px] touch-manipulation"
                />
              </div>
              
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editConnection.isMatriz}
                    onChange={(e) =>
                      setEditConnection({ ...editConnection, isMatriz: e.target.checked })
                    }
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Conexão Matriz (vê todas as conversas)
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Marque se esta conexão deve ter acesso a todas as conversas, independente do setor
                </p>
                <p className="text-xs text-gray-500 mt-2 ml-6">
                  👉 Gerencie a associação desta conexão com usuários em "Gerenciamento de Usuários"
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1 touch-manipulation"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateConnection}
                className="flex-1 bg-[#008069] hover:bg-[#006d5b] touch-manipulation"
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
