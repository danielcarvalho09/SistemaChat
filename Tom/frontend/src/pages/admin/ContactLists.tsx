import { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Upload, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name?: string;
  phone: string;
}

interface ContactList {
  id: string;
  name: string;
  description?: string;
  contacts: Contact[];
  createdAt: string;
  _count?: {
    contacts: number;
  };
}

interface InvalidContact {
  phone: string;
  name?: string;
  reason: string;
}

export function ContactLists() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInvalidContactsModal, setShowInvalidContactsModal] = useState(false);
  const [invalidContacts, setInvalidContacts] = useState<InvalidContact[]>([]);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [contactForm, setContactForm] = useState({ name: '', phone: '' });
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      const response = await api.get('/contact-lists');
      const lists = response.data?.data || response.data || [];
      setLists(Array.isArray(lists) ? lists : []);
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
      toast.error('Erro ao carregar listas');
    }
  };

  const handleCreateList = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome da lista é obrigatório');
      return;
    }

    try {
      await api.post('/contact-lists', formData);
      toast.success('Lista criada com sucesso!');
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      loadLists();
    } catch (error: any) {
      console.error('Erro ao criar lista:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar lista');
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta lista?')) return;

    try {
      await api.delete(`/contact-lists/${listId}`);
      toast.success('Lista excluída com sucesso!');
      setSelectedList(null);
      loadLists();
    } catch (error: any) {
      console.error('Erro ao excluir lista:', error);
      toast.error(error.response?.data?.message || 'Erro ao excluir lista');
    }
  };

  // Função para validar número de telefone
  const validatePhoneNumber = (phone: string): { isValid: boolean; reason?: string } => {
    if (!phone || !phone.trim()) {
      return { isValid: false, reason: 'Número vazio' };
    }

    // Remover caracteres não numéricos para validação
    const cleanPhone = phone.replace(/\D/g, '');

    // Verificar se tem pelo menos 10 dígitos (formato mínimo)
    if (cleanPhone.length < 10) {
      return { isValid: false, reason: 'Muito curto (mínimo 10 dígitos)' };
    }

    // Verificar se tem mais de 15 dígitos (formato máximo internacional)
    if (cleanPhone.length > 15) {
      return { isValid: false, reason: 'Muito longo (máximo 15 dígitos)' };
    }

    // Verificar se começa com 0 (formato inválido)
    if (cleanPhone.startsWith('0')) {
      return { isValid: false, reason: 'Não pode começar com 0' };
    }

    // Verificar se tem apenas números após limpeza
    if (!/^\d+$/.test(cleanPhone)) {
      return { isValid: false, reason: 'Contém caracteres inválidos' };
    }

    return { isValid: true };
  };

  const handleAddContact = async () => {
    if (!selectedList || !contactForm.phone.trim()) {
      toast.error('Telefone é obrigatório');
      return;
    }

    // Validar número antes de enviar
    const validation = validatePhoneNumber(contactForm.phone);
    if (!validation.isValid) {
      toast.error(`Número inválido: ${validation.reason}`);
      return;
    }

    try {
      await api.post(`/contact-lists/${selectedList.id}/contacts`, {
        contacts: [contactForm],
      });
      toast.success('Contato adicionado com sucesso!');
      setShowAddContactModal(false);
      setContactForm({ name: '', phone: '' });
      loadListDetails(selectedList.id);
    } catch (error: any) {
      console.error('Erro ao adicionar contato:', error);
      toast.error(error.response?.data?.message || 'Erro ao adicionar contato');
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!selectedList || !confirm('Remover este contato?')) return;

    try {
      await api.delete(`/contact-lists/${selectedList.id}/contacts/${contactId}`);
      toast.success('Contato removido!');
      loadListDetails(selectedList.id);
    } catch (error: any) {
      console.error('Erro ao remover contato:', error);
      toast.error(error.response?.data?.message || 'Erro ao remover contato');
    }
  };

  const handleImportCSV = async () => {
    if (!selectedList || !importFile) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    // Validar arquivo antes de enviar
    const fileText = await importFile.text();
    const lines = fileText.split('\n').filter(line => line.trim().length > 0);
    const invalid: InvalidContact[] = [];
    const validContacts: { name?: string; phone: string }[] = [];

    // Processar linhas
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Pular cabeçalho
      if (i === 0 && (line.toLowerCase().includes('nome') || line.toLowerCase().includes('name'))) {
        continue;
      }

      const parts = line.split(',').map(p => p.trim());
      let name: string | undefined;
      let phone: string;

      if (parts.length >= 2) {
        name = parts[0] || undefined;
        phone = parts[1];
      } else if (parts.length === 1) {
        phone = parts[0];
      } else {
        continue;
      }

      // Validar número
      const validation = validatePhoneNumber(phone);
      if (!validation.isValid) {
        invalid.push({
          phone,
          name,
          reason: validation.reason || 'Inválido',
        });
      } else {
        validContacts.push({ name, phone });
      }
    }

    // Se houver números inválidos, mostrar modal
    if (invalid.length > 0) {
      setInvalidContacts(invalid);
      setShowInvalidContactsModal(true);
      
      // Perguntar se deseja continuar mesmo assim
      const shouldContinue = confirm(
        `Foram encontrados ${invalid.length} número(s) mal formatado(s). Deseja continuar importando apenas os ${validContacts.length} número(s) válido(s)?`
      );

      if (!shouldContinue) {
        setShowImportModal(false);
        setImportFile(null);
        return;
      }
    }

    // Se não houver contatos válidos, não importar
    if (validContacts.length === 0) {
      toast.error('Nenhum contato válido encontrado no arquivo');
      setShowImportModal(false);
      setImportFile(null);
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      // NÃO definir Content-Type manualmente - deixar o navegador definir com boundary
      const response = await api.post(`/contact-lists/${selectedList.id}/import`, formData);
      
      if (invalid.length > 0) {
        toast.success(`${response.data.message}. ${invalid.length} número(s) inválido(s) foram ignorados.`);
      } else {
      toast.success(response.data.message);
      }
      
      setShowImportModal(false);
      setShowInvalidContactsModal(false);
      setImportFile(null);
      setInvalidContacts([]);
      loadListDetails(selectedList.id);
    } catch (error: any) {
      console.error('Erro ao importar contatos:', error);
      toast.error(error.response?.data?.message || 'Erro ao importar contatos');
    }
  };

  const loadListDetails = async (listId: string) => {
    try {
      const response = await api.get(`/contact-lists/${listId}`);
      const listData = response.data?.data || response.data;
      
      // Garantir que contacts é um array
      if (listData && !Array.isArray(listData.contacts)) {
        listData.contacts = [];
      }
      
      setSelectedList(listData);
      
      // Atualizar na lista também
      setLists(prev => prev.map(l => l.id === listId ? listData : l));
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Listas de Contatos</h1>
            <p className="text-gray-600 mt-1">Gerencie suas listas para disparo de mensagens</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Lista
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Listas */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Minhas Listas</h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {lists.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Nenhuma lista criada
                </div>
              ) : (
                lists.map((list) => (
                  <div
                    key={list.id}
                    onClick={() => loadListDetails(list.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedList?.id === list.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{list.name}</h3>
                        {list.description && (
                          <p className="text-sm text-gray-500 mt-1">{list.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                          <Users className="w-4 h-4" />
                          <span>{list._count?.contacts || list.contacts?.length || 0} contatos</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detalhes da Lista */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            {!selectedList ? (
              <div className="p-12 text-center text-gray-500">
                Selecione uma lista para ver os detalhes
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedList.name}</h2>
                      {selectedList.description && (
                        <p className="text-gray-600 mt-1">{selectedList.description}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteList(selectedList.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setShowAddContactModal(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Contato
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowImportModal(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Importar CSV
                    </Button>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Contatos ({selectedList.contacts?.length || 0})
                  </h3>
                  
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {selectedList.contacts?.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        Nenhum contato nesta lista
                      </div>
                    ) : (
                      selectedList.contacts?.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {contact.name || 'Sem nome'}
                            </p>
                            <p className="text-sm text-gray-600">{contact.phone}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveContact(contact.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Criar Lista */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Nova Lista</h3>
              <button onClick={() => setShowCreateModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent"
                  placeholder="Ex: Clientes VIP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent resize-none"
                  placeholder="Descrição opcional"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateList} className="flex-1">
                  Criar Lista
                </Button>
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Contato */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Adicionar Contato</h3>
              <button onClick={() => setShowAddContactModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent"
                  placeholder="Nome do contato"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent ${
                    contactForm.phone && !validatePhoneNumber(contactForm.phone).isValid
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="5516999999999"
                />
                {contactForm.phone && !validatePhoneNumber(contactForm.phone).isValid && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ {validatePhoneNumber(contactForm.phone).reason}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Formato: apenas números, mínimo 10 dígitos, máximo 15 dígitos
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddContact} className="flex-1">
                  Adicionar
                </Button>
                <Button variant="outline" onClick={() => setShowAddContactModal(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar CSV */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Importar Contatos</h3>
              <button onClick={() => setShowImportModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arquivo CSV
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Formato: nome,telefone (uma linha por contato)
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleImportCSV} className="flex-1" disabled={!importFile}>
                  Importar
                </Button>
                <Button variant="outline" onClick={() => setShowImportModal(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Números Mal Formatados */}
      {showInvalidContactsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-600">
                ⚠️ Números Mal Formatados ({invalidContacts.length})
              </h3>
              <button onClick={() => setShowInvalidContactsModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-4">
              <div className="space-y-2">
                {invalidContacts.map((contact, index) => (
                  <div
                    key={index}
                    className="p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {contact.name && (
                          <p className="font-medium text-gray-900">{contact.name}</p>
                        )}
                        <p className="text-sm text-gray-700 font-mono">{contact.phone}</p>
                        <p className="text-xs text-red-600 mt-1">❌ {contact.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowInvalidContactsModal(false);
                  setInvalidContacts([]);
                }}
                className="flex-1"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
