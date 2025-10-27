import { useState, useEffect } from 'react';
import { X, Building } from 'lucide-react';
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

export function TransferModal({ conversationId, onClose, onTransfer }: TransferModalProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
    }
  };

  const handleTransfer = async () => {
    // Validar se departamento foi selecionado
    if (!selectedDepartmentId) {
      alert('Por favor, selecione um departamento para transferir.');
      return;
    }

    // Montar body apenas com campos preenchidos
    const body: any = {};
    if (selectedDepartmentId) {
      body.toDepartmentId = selectedDepartmentId;
    }
    if (reason) {
      body.reason = reason;
    }

    console.log('📤 Body que será enviado:', body);

    setIsLoading(true);
    try {
      await api.post(`/conversations/${conversationId}/transfer`, body);
      
      const dept = departments.find(d => d.id === selectedDepartmentId);
      alert(`Conversa transferida para o setor ${dept?.name} com sucesso!`);
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
          <h2 className="text-lg font-semibold">Transferir Conversa</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Building className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Transferir para Setor</p>
                <p className="text-xs text-blue-700 mt-1">
                  A conversa será colocada na fila do setor selecionado e ficará aguardando atendimento.
                </p>
              </div>
            </div>
          </div>

          {/* Department Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o setor
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
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isLoading || !selectedDepartmentId}
            className="flex-1 bg-[#008069] hover:bg-[#006d5b]"
          >
            {isLoading ? 'Transferindo...' : 'Transferir'}
          </Button>
        </div>
      </div>
    </div>
  );
}
