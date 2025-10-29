import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Brain, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../lib/axios';
import { toast } from 'react-hot-toast';

interface AIAssistant {
  id: string;
  name: string;
  model: string;
  temperature: number;
  maxTokens: number;
  memoryContext: number;
  memoryCacheDays: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    connections: number;
  };
}

const AI_MODELS = [
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

export function AIAssistants() {
  const [assistants, setAssistants] = useState<AIAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    apiKey: '',
    model: 'gpt-4',
    instructions: '',
    temperature: 0.7,
    maxTokens: 500,
    memoryContext: 20,
    memoryCacheDays: 1,
  });

  useEffect(() => {
    loadAssistants();
  }, []);

  const loadAssistants = async () => {
    try {
      const response = await api.get('/ai');
      setAssistants(response.data);
    } catch (error) {
      toast.error('Erro ao carregar assistentes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        await api.patch(`/ai/${editingId}`, formData);
        toast.success('Assistente atualizado com sucesso!');
      } else {
        await api.post('/ai', formData);
        toast.success('Assistente criado com sucesso!');
      }
      
      loadAssistants();
      handleCancel();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar assistente');
    }
  };

  const handleEdit = (assistant: AIAssistant) => {
    setEditingId(assistant.id);
    setFormData({
      name: assistant.name,
      apiKey: '', // Não carregar API Key por segurança
      model: assistant.model,
      instructions: '',
      temperature: assistant.temperature,
      maxTokens: assistant.maxTokens,
      memoryContext: assistant.memoryContext,
      memoryCacheDays: assistant.memoryCacheDays,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este assistente?')) return;
    
    try {
      await api.delete(`/ai/${id}`);
      toast.success('Assistente deletado com sucesso!');
      loadAssistants();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao deletar assistente');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      apiKey: '',
      model: 'gpt-4',
      instructions: '',
      temperature: 0.7,
      maxTokens: 500,
      memoryContext: 20,
      memoryCacheDays: 1,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-purple-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assistentes de IA</h1>
            <p className="text-sm text-gray-500">Gerenciar inteligências artificiais</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Assistente
          </button>
        )}
      </div>

      {showForm ? (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Editar Assistente' : 'Novo Assistente'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Assistente *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex: Atendente Virtual Loja"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key da OpenAI *
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                  placeholder="sk-proj-..."
                  required={!editingId}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {editingId && (
                <p className="text-xs text-gray-500 mt-1">
                  Deixe em branco para manter a API Key atual
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modelo *
              </label>
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {AI_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instruções do Sistema *
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Ex: Você é um atendente virtual de uma loja online. Seja educado, prestativo e sempre termine oferecendo ajuda adicional."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Descreva como a IA deve se comportar e que tipo de conhecimento ela deve ter
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temperature (Criatividade)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">0 = Preciso, 2 = Criativo</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Máximo de Tokens
                </label>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Tamanho da resposta</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contexto de Memória
                </label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={formData.memoryContext}
                  onChange={(e) => setFormData({ ...formData, memoryContext: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Mensagens lembradas (20 recomendado)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cache de Memória (dias)
                </label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={formData.memoryCacheDays}
                  onChange={(e) => setFormData({ ...formData, memoryCacheDays: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Duração no Redis</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                {editingId ? 'Atualizar' : 'Criar'} Assistente
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assistants.map((assistant) => (
          <div
            key={assistant.id}
            className="bg-white rounded-lg shadow-sm p-6 border-2 border-gray-100 hover:border-purple-200 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Brain className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{assistant.name}</h3>
                  <p className="text-xs text-gray-500">{assistant.model}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Temperature:</span>
                <span className="font-medium">{assistant.temperature}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Max Tokens:</span>
                <span className="font-medium">{assistant.maxTokens}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Memória:</span>
                <span className="font-medium">{assistant.memoryContext} msgs</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Conexões:</span>
                <span className="font-medium">{assistant._count?.connections || 0}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={() => handleEdit(assistant)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => handleDelete(assistant.id)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Deletar
              </button>
            </div>
          </div>
        ))}
      </div>

      {assistants.length === 0 && !showForm && (
        <div className="text-center py-12">
          <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum assistente criado
          </h3>
          <p className="text-gray-500 mb-4">
            Crie seu primeiro assistente de IA para começar
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Criar Primeiro Assistente
          </button>
        </div>
      )}
    </div>
  );
}
