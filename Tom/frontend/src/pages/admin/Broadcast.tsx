import { useState, useEffect, useRef } from 'react';
import { Send, Image, FileText, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface ContactList {
  id: string;
  name: string;
  description?: string;
  _count: {
    contacts: number;
  };
}

interface Connection {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
}

interface BroadcastHistory {
  id: string;
  message: string;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  list: {
    name: string;
  };
}

export function Broadcast() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [selectedList, setSelectedList] = useState('');
  const [selectedConnection, setSelectedConnection] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | ''>('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [listsRes, connectionsRes, historyRes] = await Promise.all([
        api.get('/contact-lists'),
        api.get('/connections'),
        api.get('/broadcast/history'),
      ]);

      // Extrair data das respostas (backend retorna { success, data })
      const lists = listsRes.data?.data || listsRes.data || [];
      const connections = connectionsRes.data?.data || connectionsRes.data || [];
      const history = historyRes.data?.data || historyRes.data || [];

      setLists(Array.isArray(lists) ? lists : []);
      setConnections(Array.isArray(connections) ? connections.filter((c: Connection) => c.status === 'connected') : []);
      setHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const handleSendBroadcast = async () => {
    if (!selectedList || !selectedConnection || !message.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await api.post('/broadcast', {
        listId: selectedList,
        connectionId: selectedConnection,
        message,
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaType || undefined,
      });

      toast.success('Disparo iniciado com sucesso!');
      setMessage('');
      setMediaUrl('');
      setMediaType('');
      setSelectedList('');
      loadData();
    } catch (error: any) {
      console.error('Erro ao enviar broadcast:', error);
      toast.error(error.response?.data?.message || 'Erro ao enviar broadcast');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Pendente',
      in_progress: 'Em andamento',
      completed: 'Concluído',
      cancelled: 'Cancelado',
      failed: 'Falhou',
    };
    return statusMap[status] || status;
  };

  // Função para inserir variável na posição do cursor
  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = message.substring(0, start);
    const textAfter = message.substring(end);
    const newText = textBefore + variable + textAfter;

    setMessage(newText);

    // Restaurar foco e posição do cursor após a variável inserida
    setTimeout(() => {
      textarea.focus();
      const newCursorPosition = start + variable.length;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Disparo de Mensagens</h1>
          <p className="text-gray-600 mt-1">Envie mensagens em massa para suas listas de contatos</p>
        </div>

        {/* Formulário de Disparo */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Nova Campanha</h2>

          {/* Seleção de Lista */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lista de Contatos *
            </label>
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent"
            >
              <option value="">Selecione uma lista</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list._count.contacts} contatos)
                </option>
              ))}
            </select>
          </div>

          {/* Seleção de Conexão */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conexão WhatsApp *
            </label>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent"
            >
              <option value="">Selecione uma conexão</option>
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} - {conn.phoneNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensagem *
            </label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Digite sua mensagem aqui... Use os botões abaixo para inserir variáveis."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent resize-none"
            />
            
            {/* Botões para inserir variáveis */}
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600 font-medium">Inserir variável:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable('{{name}}')}
                  className="text-xs"
                >
                  {'{{name}}'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable('{{nome}}')}
                  className="text-xs"
                >
                  {'{{nome}}'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable('{{phone}}')}
                  className="text-xs"
                >
                  {'{{phone}}'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable('{{telefone}}')}
                  className="text-xs"
                >
                  {'{{telefone}}'}
                </Button>
              </div>
              
              <div className="flex items-start justify-between">
                <div className="text-xs text-gray-500">
                  <p className="text-gray-400">
                    💡 Clique nos botões acima para inserir variáveis na posição do cursor. As variáveis serão substituídas automaticamente pelo nome/telefone de cada contato.
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  {message.length} caracteres
                </p>
              </div>
            </div>
          </div>

          {/* Mídia (Opcional) */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Mídia (Opcional)
            </label>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mediaType === 'image' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaType(mediaType === 'image' ? '' : 'image')}
              >
                <Image className="w-4 h-4 mr-2" />
                Imagem
              </Button>
              <Button
                type="button"
                variant={mediaType === 'document' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaType(mediaType === 'document' ? '' : 'document')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Documento
              </Button>
            </div>

            {mediaType && (
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="URL da mídia"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent"
              />
            )}
          </div>

          {/* Botão de Envio */}
          <Button
            onClick={handleSendBroadcast}
            disabled={loading || !selectedList || !selectedConnection || !message.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Iniciar Disparo
              </>
            )}
          </Button>
        </div>

        {/* Histórico */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Histórico de Disparos</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {history.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nenhum disparo realizado ainda
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(item.status)}
                        <span className="font-medium text-gray-900">
                          {item.list.name}
                        </span>
                        <span className="text-sm text-gray-500">
                          {getStatusText(item.status)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {item.message}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Total: {item.totalContacts}</span>
                        <span className="text-green-600">Enviados: {item.sentCount}</span>
                        {item.failedCount > 0 && (
                          <span className="text-red-600">Falhas: {item.failedCount}</span>
                        )}
                        <span>{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
