import { useState, useCallback } from 'react';
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
  NodeMouseHandler,
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
  X,
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

const availableIcons = [
  { name: 'target', icon: Target },
  { name: 'users', icon: Users },
  { name: 'mail', icon: Mail },
  { name: 'phone', icon: Phone },
  { name: 'check-circle', icon: CheckCircle },
  { name: 'dollar-sign', icon: DollarSign },
  { name: 'star', icon: Star },
  { name: 'gift', icon: Gift },
];

const availableColors = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Green
  '#F59E0B', // Orange
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
];

interface FunnelEditorProps {
  funnel: any;
  onUpdate: () => void;
}

// Componente customizado para os nodes
function CustomNode({ data, selected }: { data: any; selected: boolean }) {
  const Icon = iconMap[data.icon] || Target;

  return (
    <div
      className={`px-6 py-4 rounded-xl shadow-lg border-2 min-w-[200px] cursor-move transition-all ${
        selected ? 'ring-4 ring-blue-400 ring-opacity-50' : ''
      }`}
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

export function FunnelEditor({ funnel, onUpdate }: FunnelEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState('target');
  const [editColor, setEditColor] = useState('#3B82F6');

  // Carregar funil no canvas
  useEffect(() => {
    if (!funnel) return;

    const newNodes: Node[] = funnel.stages.map((stage: any) => ({
      id: stage.id,
      type: 'custom',
      position: { x: stage.positionX, y: stage.positionY },
      data: {
        title: stage.title,
        description: stage.description,
        icon: stage.icon,
        color: stage.color,
      },
    }));

    const newEdges: Edge[] = [];
    funnel.stages.forEach((stage: any) => {
      stage.connectionsFrom.forEach((conn: any) => {
        newEdges.push({
          id: conn.id,
          source: conn.fromStageId,
          target: conn.toStageId,
          label: conn.label || undefined,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#94a3b8',
          },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [funnel]);

  const onConnect = useCallback(
    async (params: Connection) => {
      try {
        // Criar conexão no backend
        await api.post('/funnels/connections', {
          fromStageId: params.source,
          toStageId: params.target,
          label: null,
        });

        setEdges((eds) =>
          addEdge(
            {
              ...params,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#94a3b8',
              },
            },
            eds
          )
        );

        toast.success('Conexão criada!');
        onUpdate();
      } catch (error) {
        console.error('Error creating connection:', error);
        toast.error('Erro ao criar conexão');
      }
    },
    [setEdges, onUpdate]
  );

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    setSelectedNode(node);
    setEditTitle(node.data.title);
    setEditDescription(node.data.description || '');
    setEditIcon(node.data.icon);
    setEditColor(node.data.color);
    setShowEditModal(true);
  }, []);

  const updateStage = async () => {
    if (!selectedNode) return;

    try {
      await api.patch(`/funnels/stages/${selectedNode.id}`, {
        title: editTitle,
        description: editDescription,
        icon: editIcon,
        color: editColor,
      });

      // Atualizar node localmente
      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  title: editTitle,
                  description: editDescription,
                  icon: editIcon,
                  color: editColor,
                },
              }
            : node
        )
      );

      setShowEditModal(false);
      toast.success('Etapa atualizada!');
      onUpdate();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Erro ao atualizar etapa');
    }
  };

  const deleteStage = async () => {
    if (!selectedNode) return;
    if (!confirm('Tem certeza que deseja deletar esta etapa?')) return;

    try {
      await api.delete(`/funnels/stages/${selectedNode.id}`);

      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id)
      );

      setShowEditModal(false);
      setSelectedNode(null);
      toast.success('Etapa deletada!');
      onUpdate();
    } catch (error) {
      console.error('Error deleting stage:', error);
      toast.error('Erro ao deletar etapa');
    }
  };

  const addNewStage = async () => {
    if (!editTitle.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    try {
      const response = await api.post(`/funnels/${funnel.id}/stages`, {
        title: editTitle,
        description: editDescription,
        icon: editIcon,
        color: editColor,
        positionX: 100 + nodes.length * 250,
        positionY: 100,
      });

      const newStage = response.data.data;

      setNodes((nds) => [
        ...nds,
        {
          id: newStage.id,
          type: 'custom',
          position: { x: newStage.positionX, y: newStage.positionY },
          data: {
            title: newStage.title,
            description: newStage.description,
            icon: newStage.icon,
            color: newStage.color,
          },
        },
      ]);

      setShowAddModal(false);
      setEditTitle('');
      setEditDescription('');
      setEditIcon('target');
      setEditColor('#3B82F6');
      toast.success('Etapa adicionada!');
      onUpdate();
    } catch (error) {
      console.error('Error adding stage:', error);
      toast.error('Erro ao adicionar etapa');
    }
  };

  const savePositions = async () => {
    try {
      // Atualizar posições de todos os nodes
      for (const node of nodes) {
        await api.patch(`/funnels/stages/${node.id}`, {
          positionX: node.position.x,
          positionY: node.position.y,
        });
      }

      toast.success('Posições salvas!');
      onUpdate();
    } catch (error) {
      console.error('Error saving positions:', error);
      toast.error('Erro ao salvar posições');
    }
  };

  return (
    <div className="h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
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
        
        {/* Painel de ações */}
        <Panel position="top-right" className="flex gap-2 m-4">
          <button
            onClick={() => {
              setEditTitle('');
              setEditDescription('');
              setEditIcon('target');
              setEditColor('#3B82F6');
              setShowAddModal(true);
            }}
            className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg shadow-md border border-gray-200 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Etapa
          </button>
          <button
            onClick={savePositions}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            Salvar Posições
          </button>
        </Panel>

        {/* Info do funil */}
        <Panel position="top-left" className="bg-white rounded-lg shadow-md p-4 m-4 max-w-xs">
          <h3 className="font-semibold text-gray-900 mb-1">{funnel.name}</h3>
          <p className="text-xs text-gray-600 mb-1">
            <span className="font-medium">Nicho:</span> {funnel.niche}
          </p>
          {funnel.description && (
            <p className="text-xs text-gray-500 mt-2">{funnel.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">{nodes.length} etapas</p>
        </Panel>
      </ReactFlow>

      {/* Modal de edição */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="w-6 h-6 text-blue-600" />
                Editar Etapa
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ícone</label>
                <div className="grid grid-cols-4 gap-2">
                  {availableIcons.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => setEditIcon(item.name)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          editIcon === item.name
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5 mx-auto text-gray-700" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                <div className="grid grid-cols-4 gap-2">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={`w-full h-10 rounded-lg border-2 transition-all ${
                        editColor === color ? 'border-gray-900 ring-2 ring-gray-300' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={deleteStage}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={updateStage}
                disabled={!editTitle.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de adição */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-6 h-6 text-blue-600" />
                Nova Etapa
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ex: Qualificação de Leads"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descreva o objetivo desta etapa..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ícone</label>
                <div className="grid grid-cols-4 gap-2">
                  {availableIcons.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => setEditIcon(item.name)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          editIcon === item.name
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5 mx-auto text-gray-700" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                <div className="grid grid-cols-4 gap-2">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={`w-full h-10 rounded-lg border-2 transition-all ${
                        editColor === color ? 'border-gray-900 ring-2 ring-gray-300' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={addNewStage}
                disabled={!editTitle.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

