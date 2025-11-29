import { useState, useEffect } from 'react';
import { X, Building, User, ChevronLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { api } from '../../lib/axios';

interface TransferModalProps {
  conversationId: string;
  onClose: () => void;
  onTransfer: () => void;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export function TransferModal({ conversationId, onClose, onTransfer }: TransferModalProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [step, setStep] = useState<'department' | 'user'>('department');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartmentId && step === 'user') {
      fetchDepartmentUsers(selectedDepartmentId);
    }
  }, [selectedDepartmentId, step]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
    }
  };

  const fetchDepartmentUsers = async (departmentId: string) => {
    setIsLoadingUsers(true);
    try {
      const response = await api.get(`/departments/${departmentId}/users`);
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários do departamento:', error);
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleDepartmentSelect = () => {
    if (!selectedDepartmentId) {
      alert('Por favor, selecione um departamento.');
      return;
    }
    setStep('user');
  };

  const handleBack = () => {
    setStep('department');
    setSelectedUserId('');
  };

  const handleTransfer = async () => {
    // Validar se usuário foi selecionado
    if (!selectedUserId) {
      alert('Por favor, selecione um usuário para transferir.');
      return;
    }

    // Montar body com usuário específico
    const body: any = {
      toUserId: selectedUserId,
    };
    if (reason) {
      body.reason = reason;
    }

    console.log('📤 Body que será enviado:', body);

    setIsLoading(true);
    try {
      await api.post(`/conversations/${conversationId}/transfer`, body);
      
      const user = users.find(u => u.id === selectedUserId);
      alert(`Conversa transferida para ${user?.name} com sucesso!`);
      onTransfer();
      onClose();
    } catch (error: any) {
      console.error('❌ Erro ao transferir conversa:', error);
      console.error('📥 Resposta do servidor:', error.response?.data);
      console.error('📊 Erros detalhados:', JSON.stringify(error.response?.data?.errors, null, 2));
      console.error('📤 Body enviado:', body);
      
      const errorMessage = error.response?.data?.errors?.[0]?.message || error.response?.data?.message || 'Erro ao transferir conversa. Tente novamente.';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {step === 'user' && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <h2 className="text-lg font-semibold">
              {step === 'department' ? 'Transferir Conversa' : 'Selecione o Usuário'}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {step === 'department' ? (
            <>
              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Building className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Selecione o Setor</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Primeiro selecione o setor, depois escolha o usuário específico para transferir.
                    </p>
                  </div>
                </div>
              </div>

              {/* Department Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Setor
                </label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione um setor...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              {/* Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <User className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Selecione o Usuário</p>
                    <p className="text-xs text-green-700 mt-1">
                      A conversa será transferida apenas para o usuário selecionado e ficará visível para ele e administradores.
                    </p>
                  </div>
                </div>
              </div>

              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usuário do Setor
                </label>
                {isLoadingUsers ? (
                  <div className="text-center py-4 text-gray-500">Carregando usuários...</div>
                ) : users.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">Nenhum usuário encontrado neste setor.</div>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Selecione um usuário...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo (opcional)
                </label>
                <Input
                  type="text"
                  placeholder="Digite o motivo da transferência..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          {step === 'department' ? (
            <Button
              onClick={handleDepartmentSelect}
              disabled={!selectedDepartmentId}
              className="flex-1 bg-[#008069] hover:bg-[#006d5b]"
            >
              Próximo
            </Button>
          ) : (
            <Button
              onClick={handleTransfer}
              disabled={isLoading || !selectedUserId}
              className="flex-1 bg-[#008069] hover:bg-[#006d5b]"
            >
              {isLoading ? 'Transferindo...' : 'Transferir'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
