import { useState, useEffect } from 'react';
import { Trash2, Users, Plus, Edit, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/axios';

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  isActive: boolean;
  _count?: {
    users: number;
  };
}

export function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', color: '#008069' });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (deptId: string) => {
    if (!confirm('Tem certeza que deseja excluir este departamento?')) return;
    
    try {
      await api.delete(`/departments/${deptId}`);
      fetchDepartments();
    } catch (error) {
      console.error('Erro ao excluir departamento:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.name) {
      alert('Preencha o nome do departamento');
      return;
    }

    try {
      await api.post('/departments', formData);
      setShowCreateModal(false);
      setFormData({ name: '', description: '', color: '#008069' });
      fetchDepartments();
    } catch (error: any) {
      console.error('Erro ao criar departamento:', error);
      alert(error.response?.data?.message || 'Erro ao criar departamento');
    }
  };

  const handleEdit = async () => {
    if (!selectedDept || !formData.name) {
      alert('Preencha o nome do departamento');
      return;
    }

    try {
      await api.patch(`/departments/${selectedDept.id}`, formData);
      setShowEditModal(false);
      setSelectedDept(null);
      setFormData({ name: '', description: '', color: '#008069' });
      fetchDepartments();
    } catch (error: any) {
      console.error('Erro ao atualizar departamento:', error);
      alert(error.response?.data?.message || 'Erro ao atualizar departamento');
    }
  };

  const openEditModal = (dept: Department) => {
    setSelectedDept(dept);
    setFormData({ name: dept.name, description: dept.description || '', color: dept.color });
    setShowEditModal(true);
  };

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Departamentos</h1>
            <p className="text-sm text-gray-500 mt-1">
              Visualize e gerencie os setores do sistema
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#008069] hover:bg-[#006d5b]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Departamento
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <Input
          type="text"
          placeholder="Buscar departamentos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Carregando...</div>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-4xl mb-4">🏢</div>
            <div className="text-gray-500">Nenhum departamento encontrado</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDepartments.map((dept) => (
              <div
                key={dept.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: dept.color || '#008069' }}
                  >
                    {dept.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(dept)}
                      title="Editar departamento"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(dept.id)}
                      title="Excluir departamento"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{dept.name}</h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                  {dept.description || 'Sem descrição'}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{dept._count?.users || 0} usuários</span>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      dept.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {dept.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Criar Departamento */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Novo Departamento</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Comercial" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição do setor" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                <input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full h-10 rounded border" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleCreate} className="flex-1 bg-[#008069] hover:bg-[#006d5b]">Criar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Departamento */}
      {showEditModal && selectedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Editar Departamento</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowEditModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                <input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full h-10 rounded border" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleEdit} className="flex-1 bg-[#008069] hover:bg-[#006d5b]">Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
