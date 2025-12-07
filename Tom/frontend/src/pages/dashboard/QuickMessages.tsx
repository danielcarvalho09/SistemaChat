import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface QuickMessage {
  id: string;
  name: string;
  content: string;
  category?: string;
  order: number;
}

export function QuickMessages() {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: '',
  });

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const response = await api.get('/quick-messages');
      setMessages(response.data?.data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens prontas:', error);
      toast.error('Erro ao carregar mensagens prontas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Preencha nome e conteúdo');
      return;
    }

    try {
      await api.post('/quick-messages', {
        name: formData.name,
        content: formData.content,
        category: formData.category || null,
      });
      toast.success('Mensagem criada com sucesso!');
      setFormData({ name: '', content: '', category: '' });
      setShowForm(false);
      loadMessages();
    } catch (error: any) {
      console.error('Erro ao criar mensagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar mensagem');
    }
  };

  const handleUpdate = async (id: string) => {
    const message = messages.find(m => m.id === id);
    if (!message) return;

    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Preencha nome e conteúdo');
      return;
    }

    try {
      await api.patch(`/quick-messages/${id}`, {
        name: formData.name,
        content: formData.content,
        category: formData.category || null,
      });
      toast.success('Mensagem atualizada com sucesso!');
      setEditingId(null);
      setFormData({ name: '', content: '', category: '' });
      loadMessages();
    } catch (error: any) {
      console.error('Erro ao atualizar mensagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao atualizar mensagem');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta mensagem?')) return;

    try {
      await api.delete(`/quick-messages/${id}`);
      toast.success('Mensagem deletada com sucesso!');
      loadMessages();
    } catch (error: any) {
      console.error('Erro ao deletar mensagem:', error);
      toast.error(error.response?.data?.message || 'Erro ao deletar mensagem');
    }
  };

  const startEdit = (message: QuickMessage) => {
    setEditingId(message.id);
    setFormData({
      name: message.name,
      content: message.content,
      category: message.category || '',
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', content: '', category: '' });
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mensagens Prontas</h1>
            <p className="text-gray-600 mt-1">Configure mensagens rápidas para uso no Kanban</p>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setFormData({ name: '', content: '', category: '' });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Mensagem
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {showForm && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Editar Mensagem' : 'Nova Mensagem'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Saudação"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conteúdo
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Digite o conteúdo da mensagem..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria (opcional)
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: saudacao, encerramento"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={editingId ? () => handleUpdate(editingId) : handleCreate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              Nenhuma mensagem pronta. Clique em "Nova Mensagem" para criar.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">{message.name}</h4>
                      {message.category && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          {message.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => startEdit(message)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(message.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

