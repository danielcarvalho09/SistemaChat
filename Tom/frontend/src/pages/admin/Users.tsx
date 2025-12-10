import { useState, useEffect } from 'react';
import { Trash2, Shield, ShieldOff, Users as UsersIcon, X, Plus, Edit, Phone } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/axios';

interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  roles: { name: string }[];
}

interface Department {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface Connection {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
  isActive: boolean;
}

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDepartmentsModal, setShowDepartmentsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' as 'admin' | 'user' | 'gerente', connectionId: '' });
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id: string; name: string } | null>(null);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [userConnection, setUserConnection] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchConnections();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await api.patch(`/users/${userId}`, { isActive: !isActive });
      fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir (desativar) este usuário?')) return;
    
    try {
      const response = await api.delete(`/users/${userId}`);
      console.log('Resposta do servidor:', response.data);
      
      // Verificar se a resposta indica sucesso
      if (response.data?.success || response.status === 200) {
      fetchUsers();
        alert('Usuário desativado com sucesso!');
      } else {
        throw new Error(response.data?.message || 'Resposta inesperada do servidor');
      }
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      console.error('Detalhes do erro:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message
      });
      
      // Mostrar mensagem de erro mais detalhada
      let errorMessage = 'Erro ao excluir usuário';
      
      if (error?.response?.status === 403) {
        errorMessage = 'Você não tem permissão para excluir usuários';
      } else if (error?.response?.status === 404) {
        errorMessage = 'Usuário não encontrado';
      } else if (error?.response?.status === 409) {
        errorMessage = error?.response?.data?.message || 'Não é possível excluir este usuário (pode ser o último admin ativo)';
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      alert(`Erro: ${errorMessage}`);
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

  const fetchConnections = async () => {
    try {
      const response = await api.get('/connections');
      setConnections(response.data.data || []);
    } catch (error) {
      console.error('Erro ao buscar conexões:', error);
    }
  };

  const handleManageConnections = async (user: User) => {
    setSelectedUser(user);
    try {
      const response = await api.get(`/users/${user.id}/connections`);
      const userConns = response.data.data || [];
      setUserConnection(userConns.length > 0 ? userConns[0].id : null);
      setShowConnectionsModal(true);
    } catch (error) {
      console.error('Erro ao buscar conexões do usuário:', error);
    }
  };

  const handleAssignConnection = async (connectionId: string) => {
    if (!selectedUser) return;
    
    try {
      // Remover conexão antiga se existir
      if (userConnection) {
        await api.delete(`/users/${selectedUser.id}/connections/${userConnection}`);
      }
      
      // Adicionar nova conexão
      await api.post(`/users/${selectedUser.id}/connections`, { connectionId });
      setUserConnection(connectionId);
      alert('Conexão atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atribuir conexão:', error);
      alert(error.response?.data?.message || 'Erro ao atribuir conexão');
    }
  };

  const handleRemoveConnection = async () => {
    if (!selectedUser || !userConnection) return;
    
    try {
      await api.delete(`/users/${selectedUser.id}/connections/${userConnection}`);
      setUserConnection(null);
      alert('Conexão removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover conexão:', error);
      alert('Erro ao remover conexão');
    }
  };

  const handleManageRole = async (user: User) => {
    setSelectedUserForRole(user);
    setShowRoleModal(true);
  };

  const handleUpdateRole = async (role: 'admin' | 'user' | 'gerente') => {
    if (!selectedUserForRole) return;
    
    const roleNames = {
      admin: 'ADMINISTRADOR',
      user: 'USUÁRIO',
      gerente: 'GERENTE'
    };
    
    const confirmMsg = `Tem certeza que deseja tornar este usuário ${roleNames[role]}?`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
      await api.patch(`/users/${selectedUserForRole.id}/role`, { role });
      setShowRoleModal(false);
      setSelectedUserForRole(null);
      fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar role:', error);
      alert('Erro ao atualizar permissão do usuário');
    }
  };

  const handleManageDepartments = async (user: User) => {
    setSelectedUser(user);
    try {
      const response = await api.get(`/users/${user.id}/departments`);
      setUserDepartments(response.data.data?.map((d: Department) => d.id) || []);
      setShowDepartmentsModal(true);
    } catch (error) {
      console.error('Erro ao buscar setores do usuário:', error);
    }
  };

  const handleToggleDepartment = async (departmentId: string) => {
    if (!selectedUser) return;
    
    try {
      if (userDepartments.includes(departmentId)) {
        await api.delete(`/users/${selectedUser.id}/departments/${departmentId}`);
        setUserDepartments(userDepartments.filter(id => id !== departmentId));
      } else {
        await api.post(`/users/${selectedUser.id}/departments`, { departmentId });
        setUserDepartments([...userDepartments, departmentId]);
      }
    } catch (error) {
      console.error('Erro ao atualizar setores:', error);
      alert('Erro ao atualizar setores do usuário');
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      alert('Preencha todos os campos');
      return;
    }
    if (!newUser.connectionId) {
      alert('Selecione uma conexão para o usuário');
      return;
    }

    try {
      // Criar usuário
      const response = await api.post('/users', {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
      });
      
      // Verificar se a resposta foi bem-sucedida e tem dados
      if (!response.data?.success || !response.data?.data) {
        throw new Error(response.data?.message || 'Erro ao criar usuário');
      }
      
      // Se foi selecionada uma conexão, associá-la
      if (newUser.connectionId && response.data.data?.id) {
        const userId = response.data.data.id;
        await api.post(`/users/${userId}/connections`, { connectionId: newUser.connectionId });
      }
      
      setShowCreateModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'user', connectionId: '' });
      fetchUsers();
      alert('Usuário criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao criar usuário';
      alert(errorMessage);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser({ id: user.id, name: user.name });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    try {
      await api.patch(`/users/${editingUser.id}`, { name: editingUser.name });
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
      alert('Nome atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar nome:', error);
      alert('Erro ao atualizar nome do usuário');
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie usuários, permissões e acessos aos setores
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#008069] hover:bg-[#006d5b]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <Input
          type="text"
          placeholder="Buscar usuários por nome ou email..."
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
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-4xl mb-4">👥</div>
            <div className="text-gray-500">Nenhum usuário encontrado</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center text-white font-semibold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-1">
                        {user.roles.map((role, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {role.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          title="Editar Nome"
                        >
                          <Edit className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageRole(user)}
                          title="Gerenciar Role"
                        >
                          <Shield className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageConnections(user)}
                          title="Gerenciar Conexões"
                        >
                          <Phone className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageDepartments(user)}
                          title="Gerenciar Setores"
                        >
                          <UsersIcon className="w-4 h-4 text-purple-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(user.id, user.isActive)}
                          title={user.isActive ? 'Desativar' : 'Ativar'}
                        >
                          {user.isActive ? (
                            <ShieldOff className="w-4 h-4 text-red-500" />
                          ) : (
                            <Shield className="w-4 h-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Gerenciamento de Setores */}
      {showDepartmentsModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Gerenciar Setores</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDepartmentsModal(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Usuário: <span className="font-semibold">{selectedUser.name}</span>
              </p>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {departments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhum setor disponível
                </p>
              ) : (
                departments.map((dept) => (
                  <label
                    key={dept.id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={userDepartments.includes(dept.id)}
                      onChange={() => handleToggleDepartment(dept.id)}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <span
                      className="inline-block w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dept.color }}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{dept.name}</div>
                      {dept.description && (
                        <div className="text-xs text-gray-500">{dept.description}</div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setShowDepartmentsModal(false)}
                className="bg-[#008069] hover:bg-[#006d5b]"
              >
                Concluído
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criar Usuário */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Novo Usuário</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                <Input
                  type="text"
                  placeholder="Nome completo"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
                <Input
                  type="password"
                  placeholder="Senha"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissão</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' | 'gerente' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="user">Usuário</option>
                  <option value="gerente">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conexão</label>
                <select
                  value={newUser.connectionId}
                  onChange={(e) => setNewUser({ ...newUser, connectionId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione uma conexão...</option>
                  {connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} - {conn.phoneNumber} ({conn.status})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Obrigatório selecionar uma conexão para o usuário
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateUser}
                className="flex-1 bg-[#008069] hover:bg-[#006d5b]"
              >
                Criar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Nome */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Editar Nome do Usuário</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                <Input
                  type="text"
                  placeholder="Nome do usuário"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="flex-1 bg-[#008069] hover:bg-[#006d5b]"
                disabled={!editingUser.name.trim()}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Conexões */}
      {showConnectionsModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Gerenciar Conexão</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConnectionsModal(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Usuário: <span className="font-semibold">{selectedUser.name}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Cada usuário pode ter apenas uma conexão ativa
              </p>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {connections.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhuma conexão disponível
                </p>
              ) : (
                connections.map((conn) => (
                  <label
                    key={conn.id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="connection"
                      checked={userConnection === conn.id}
                      onChange={() => handleAssignConnection(conn.id)}
                      className="w-4 h-4 text-green-600 focus:ring-green-500"
                    />
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{conn.name}</div>
                      <div className="text-xs text-gray-500">{conn.phoneNumber}</div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                          conn.status === 'connected'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {conn.status}
                      </span>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="mt-6 flex gap-2">
              {userConnection && (
                <Button
                  variant="outline"
                  onClick={handleRemoveConnection}
                  className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                >
                  Remover Conexão
                </Button>
              )}
              <Button
                onClick={() => setShowConnectionsModal(false)}
                className="flex-1 bg-[#008069] hover:bg-[#006d5b]"
              >
                Concluído
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Role */}
      {showRoleModal && selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Gerenciar Role</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUserForRole(null);
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Usuário: <span className="font-semibold">{selectedUserForRole.name}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Role atual: <span className="font-semibold">{selectedUserForRole.roles[0]?.name || 'user'}</span>
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleUpdateRole('admin')}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  selectedUserForRole.roles[0]?.name === 'admin'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="font-semibold text-gray-900">Administrador</div>
                <div className="text-xs text-gray-500 mt-1">Acesso completo a todas as funcionalidades</div>
              </button>

              <button
                onClick={() => handleUpdateRole('gerente')}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  selectedUserForRole.roles[0]?.name === 'gerente'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                }`}
              >
                <div className="font-semibold text-gray-900">Gerente</div>
                <div className="text-xs text-gray-500 mt-1">Acesso a disparo de mensagens, listas de contatos e configurações</div>
              </button>

              <button
                onClick={() => handleUpdateRole('user')}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  selectedUserForRole.roles[0]?.name === 'user'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                }`}
              >
                <div className="font-semibold text-gray-900">Usuário</div>
                <div className="text-xs text-gray-500 mt-1">Acesso básico ao sistema de atendimento</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
