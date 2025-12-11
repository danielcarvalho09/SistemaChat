import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Target,
  Users,
  Mail,
  Phone,
  CheckCircle,
  DollarSign,
  Star,
  Gift,
  Plus,
  Save,
  Trash2,
  Edit2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import api from '../../lib/axios';
import { toast } from 'sonner';

// Mapeamento de ícones
const iconMap: Record<string, any> = {
  target: Target,
  users: Users,
  mail: Mail,
  phone: Phone,
  'check-circle': CheckCircle,
  'dollar-sign': DollarSign,
  star: Star,
  gift: Gift,
  circle: Target,
};

interface Funnel {
  id: string;
  name: string;
  niche: string;
  description: string | null;
  userId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stages: FunnelStage[];
}

interface FunnelStage {
  id: string;
  funnelId: string;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  order: number;
  positionX: number;
  positionY: number;
  connectionsFrom: FunnelConnection[];
  connectionsTo?: FunnelConnection[];
}

interface FunnelConnection {
  id: string;
  fromStageId: string;
  toStageId: string;
  label: string | null;
  toStage?: { id: string; title: string };
  fromStage?: { id: string; title: string };
}

// Componente customizado para os nodes
function CustomNode({ data }: { data: any }) {
  const Icon = iconMap[data.icon] || Target;

  return (
    <div
      className="px-6 py-4 rounded-xl shadow-lg border-2 min-w-[200px] cursor-move"
      style={{
        backgroundColor: data.color,
        borderColor: data.color,
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5 text-white" />
        <h3 className="text-white font-semibold text-sm">{data.title}</h3>
      </div>
      {data.description && (
        <p className="text-white/90 text-xs leading-relaxed">{data.description}</p>
      )}
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

export function Funnels() {
  const navigate = useNavigate();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnel, setSelectedFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [niche, setNiche] = useState('');
  const [funnelName, setFunnelName] = useState('');
  const [generating, setGenerating] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    loadFunnels();
  }, []);

  const loadFunnels = async () => {
    try {
      setLoading(true);
      const response = await api.get('/funnels');
      setFunnels(response.data.data || []);
    } catch (error) {
      console.error('Error loading funnels:', error);
      toast.error('Erro ao carregar funis');
    } finally {
      setLoading(false);
    }
  };

  const generateFunnel = async () => {
    if (!niche.trim()) {
      toast.error('Por favor, informe o nicho de mercado');
      return;
    }

    try {
      setGenerating(true);
      const response = await api.post('/funnels/generate', {
        niche: niche.trim(),
        name: funnelName.trim() || undefined,
      });

      const newFunnel = response.data.data;
      setFunnels([newFunnel, ...funnels]);
      setSelectedFunnel(newFunnel);
      loadFunnelToCanvas(newFunnel);
      setShowGenerateModal(false);
      setNiche('');
      setFunnelName('');
      toast.success('Funil gerado com sucesso!');
    } catch (error: any) {
      console.error('Error generating funnel:', error);
      toast.error(error.response?.data?.message || 'Erro ao gerar funil');
    } finally {
      setGenerating(false);
    }
  };

  const loadFunnelToCanvas = useCallback((funnel: Funnel) => {
    // Converter stages para nodes do ReactFlow
    const newNodes: Node[] = funnel.stages.map((stage, index) => {
      // Se as posições forem 0 ou muito próximas, aplicar layout automático
      let x = stage.positionX;
      let y = stage.positionY;
      
      // Verificar se precisa aplicar layout automático
      if (x === 0 && y === 0 || (index > 0 && Math.abs(x - funnel.stages[index - 1].positionX) < 50)) {
        // Aplicar layout orgânico similar ao n8n
        const horizontalSpacing = 300;
        const startX = 100;
        const startY = 150;
        
        x = startX + index * horizontalSpacing;
        // Criar padrão ondulado para Y
        const waveOffset = Math.sin(index * 0.8) * 120;
        y = startY + waveOffset + (index % 3) * 40;
      }
      
      return {
        id: stage.id,
        type: 'custom',
        position: { x, y },
        data: {
          title: stage.title,
          description: stage.description,
          icon: stage.icon,
          color: stage.color,
        },
      };
    });

    // Converter connections para edges do ReactFlow
    const newEdges: Edge[] = [];
    funnel.stages.forEach((stage) => {
      stage.connectionsFrom.forEach((conn) => {
        newEdges.push({
          id: conn.id,
          source: conn.fromStageId,
          target: conn.toStageId,
          label: conn.label || undefined,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#94a3b8',
          },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const deleteFunnel = async (funnelId: string) => {
    if (!confirm('Tem certeza que deseja deletar este funil?')) return;

    try {
      await api.delete(`/funnels/${funnelId}`);
      setFunnels(funnels.filter((f) => f.id !== funnelId));
      if (selectedFunnel?.id === funnelId) {
        setSelectedFunnel(null);
        setNodes([]);
        setEdges([]);
      }
      toast.success('Funil deletado com sucesso!');
    } catch (error) {
      console.error('Error deleting funnel:', error);
      toast.error('Erro ao deletar funil');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando funis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-blue-600" />
              Funis Inteligentes
            </h1>
            <p className="text-gray-600 mt-1">
              Crie funis de vendas automaticamente com IA
            </p>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Sparkles className="w-5 h-5" />
            Gerar Funil com IA
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Lista de funis */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Meus Funis</h2>
            
            {funnels.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhum funil criado ainda</p>
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Criar primeiro funil
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {funnels.map((funnel) => (
                  <div
                    key={funnel.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedFunnel?.id === funnel.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedFunnel(funnel);
                      loadFunnelToCanvas(funnel);
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm">{funnel.name}</h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFunnel(funnel.id);
                        }}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      <span className="font-medium">Nicho:</span> {funnel.niche}
                    </p>
                    <p className="text-xs text-gray-500">
                      {funnel.stages.length} etapas
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Canvas - ReactFlow */}
        <div className="flex-1 relative">
          {selectedFunnel ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              className="bg-gray-50"
            >
              <Background color="#e5e7eb" gap={16} />
              <Controls />
              <MiniMap
                nodeColor={(node) => node.data.color || '#3B82F6'}
                maskColor="rgba(0, 0, 0, 0.1)"
              />
              <Panel position="top-left" className="bg-white rounded-lg shadow-md p-4 m-4">
                <h3 className="font-semibold text-gray-900 mb-1">{selectedFunnel.name}</h3>
                <p className="text-xs text-gray-600">{selectedFunnel.niche}</p>
                {selectedFunnel.description && (
                  <p className="text-xs text-gray-500 mt-2">{selectedFunnel.description}</p>
                )}
              </Panel>
            </ReactFlow>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">Selecione ou crie um funil</p>
                <p className="text-gray-400 text-sm">
                  Use a IA para gerar funis de vendas automaticamente
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de geração */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Gerar Funil com IA</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nicho de Mercado *
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Ex: E-commerce de moda, SaaS B2B, Infoprodutos..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={generating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Funil (opcional)
                </label>
                <input
                  type="text"
                  value={funnelName}
                  onChange={(e) => setFunnelName(e.target.value)}
                  placeholder="Ex: Funil de Vendas Principal"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={generating}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  <strong>💡 Dica:</strong> Seja específico sobre o nicho. A IA criará um funil
                  personalizado com etapas otimizadas para conversão.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setNiche('');
                  setFunnelName('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={generating}
              >
                Cancelar
              </button>
              <button
                onClick={generateFunnel}
                disabled={generating || !niche.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar Funil
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

