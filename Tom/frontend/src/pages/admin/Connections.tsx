import { useState, useEffect, useRef } from 'react';
import { Plus, Smartphone, QrCode, Power, Trash2, RefreshCw, X, Edit } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/axios';
import socketService from '../../lib/socket';

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
      console.log('🔄 WhatsApp conectando:', data.connectionId);
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === data.connectionId ? { ...conn, status: 'connecting' } : conn
        )
      );
      
      // Atualizar modal se estiver aberto para esta conexão
      setSelectedConnection((prev) =>
        prev?.id === data.connectionId ? { ...prev, status: 'connecting' } : prev
      );
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
      setConnections(response.data.data || []);
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conexões WhatsApp</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie suas conexões com o WhatsApp Business
            </p>
          </div>
          <Button 
            className="bg-[#008069] hover:bg-[#006d5b]"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Conexão
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Carregando...</div>
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-4xl mb-4">📱</div>
            <div className="text-gray-500 mb-2">Nenhuma conexão configurada</div>
            <p className="text-sm text-gray-400 mb-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{connection.name}</h3>
                      <p className="text-sm text-gray-500">WhatsApp Business</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="mb-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      connection.status
                    )}`}
                  >
                    {getStatusLabel(connection.status)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  {connection.status === 'disconnected' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnect(connection.id)}
                      className="flex-1"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Conectar
                    </Button>
                  ) : connection.status === 'connecting' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelConnection(connection.id)}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                    >
                      <Power className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(connection.id)}
                      className="flex-1"
                    >
                      <Power className="w-4 h-4 mr-2" />
                      Desconectar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClick(connection)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchConnections()}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(connection.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Nova Conexão WhatsApp</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModal(false)}
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
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Telefone
                </label>
                <Input
                  type="text"
                  placeholder="Ex: 5516992009906"
                  value={newConnection.phoneNumber}
                  onChange={(e) =>
                    setNewConnection({ ...newConnection, phoneNumber: e.target.value })
                  }
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

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddConnection}
                className="flex-1 bg-[#008069] hover:bg-[#006d5b]"
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedConnection?.qrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Escaneie o QR Code</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQRModal(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4 flex items-center justify-center">
              {selectedConnection.qrCode ? (
                <img
                  src={selectedConnection.qrCode}
                  alt="QR Code"
                  className="w-64 h-64"
                  onError={() => {
                    console.error('❌ Erro ao carregar imagem do QR Code');
                    console.log('QR Code URL:', selectedConnection.qrCode);
                  }}
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-4xl mb-2">⏳</div>
                    <p>Gerando QR Code...</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900 font-medium mb-2">
                📱 Como conectar:
              </p>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Abra o WhatsApp no seu celular</li>
                <li>Toque em Menu (⋮) ou Configurações</li>
                <li>Toque em "Aparelhos conectados"</li>
                <li>Toque em "Conectar um aparelho"</li>
                <li>Aponte seu celular para esta tela</li>
              </ol>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Aguardando escaneamento...
            </div>
          </div>
        </div>
      )}

      {/* Edit Connection Modal */}
      {showEditModal && selectedConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Editar Conexão</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditModal(false)}
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

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateConnection}
                className="flex-1 bg-[#008069] hover:bg-[#006d5b]"
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
