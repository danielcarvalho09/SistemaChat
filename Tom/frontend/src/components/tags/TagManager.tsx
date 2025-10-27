import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag as TagIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface Tag {
  id: string;
  name: string;
  color: string;
  isGlobal: boolean;
  createdBy: string | null;
  _count?: {
    conversations: number;
  };
}

export function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6',
    isGlobal: false,
  });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const response = await api.get('/tags');
      setTags(response.data);
    } catch (error) {
      console.error('Error loading tags:', error);
      toast.error('Erro ao carregar tags');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTag) {
        await api.put(`/tags/${editingTag.id}`, formData);
        toast.success('Tag atualizada com sucesso!');
      } else {
        await api.post('/tags', formData);
        toast.success('Tag criada com sucesso!');
      }

      setIsOpen(false);
      setEditingTag(null);
      setFormData({ name: '', color: '#3b82f6', isGlobal: false });
      loadTags();
    } catch (error: any) {
      console.error('Error saving tag:', error);
      if (error.response?.status === 409) {
        toast.error('Já existe uma tag com este nome');
      } else {
        toast.error('Erro ao salvar tag');
      }
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
      isGlobal: tag.isGlobal,
    });
    setIsOpen(true);
  };

  const handleDelete = async (tagId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tag?')) return;

    try {
      await api.delete(`/tags/${tagId}`);
      toast.success('Tag excluída com sucesso!');
      loadTags();
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Erro ao excluir tag');
    }
  };

  const handleOpenNew = () => {
    setEditingTag(null);
    setFormData({ name: '', color: '#3b82f6', isGlobal: false });
    setIsOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Tags</h2>
          <p className="text-sm text-gray-500 mt-1">
            Crie tags personalizadas para organizar suas conversas
          </p>
        </div>
        <Button onClick={handleOpenNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Tag
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="font-medium">{tag.name}</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(tag)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(tag.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {tag._count?.conversations || 0} conversa(s)
              </span>
              {tag.isGlobal && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  Global
                </span>
              )}
            </div>
          </div>
        ))}

        {tags.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <TagIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma tag criada ainda</p>
            <p className="text-sm mt-1">Clique em "Nova Tag" para começar</p>
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTag ? 'Editar Tag' : 'Nova Tag'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Tag</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Urgente, VIP, Suporte..."
                required
                maxLength={50}
              />
            </div>

            <div>
              <Label htmlFor="color">Cor</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  id="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="w-12 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  placeholder="#3b82f6"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isGlobal"
                checked={formData.isGlobal}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isGlobal: checked as boolean })
                }
              />
              <Label htmlFor="isGlobal" className="cursor-pointer">
                Tag global (visível para todos os usuários)
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingTag ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
