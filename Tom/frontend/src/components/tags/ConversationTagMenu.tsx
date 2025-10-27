import { useState, useEffect } from 'react';
import { Tag as TagIcon, Plus, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface Tag {
  id: string;
  name: string;
  color: string;
  isGlobal: boolean;
}

interface ConversationTag {
  id: string;
  tagId: string;
  tag: Tag;
}

interface ConversationTagMenuProps {
  conversationId: string;
  onTagsChange?: () => void;
}

export function ConversationTagMenu({
  conversationId,
  onTagsChange,
}: ConversationTagMenuProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [conversationTags, setConversationTags] = useState<ConversationTag[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTags();
      loadConversationTags();
    }
  }, [isOpen, conversationId]);

  const loadTags = async () => {
    try {
      const response = await api.get('/tags');
      setAvailableTags(response.data);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadConversationTags = async () => {
    try {
      const response = await api.get(`/conversations/${conversationId}/tags`);
      setConversationTags(response.data);
    } catch (error) {
      console.error('Error loading conversation tags:', error);
    }
  };

  const handleAddTag = async (tagId: string) => {
    try {
      await api.post('/conversations/tags', {
        conversationId,
        tagId,
      });
      toast.success('Tag adicionada!');
      loadConversationTags();
      onTagsChange?.();
    } catch (error: any) {
      console.error('Error adding tag:', error);
      if (error.response?.status === 409) {
        toast.error('Tag já adicionada a esta conversa');
      } else {
        toast.error('Erro ao adicionar tag');
      }
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await api.delete(`/conversations/${conversationId}/tags/${tagId}`);
      toast.success('Tag removida!');
      loadConversationTags();
      onTagsChange?.();
    } catch (error) {
      console.error('Error removing tag:', error);
      toast.error('Erro ao remover tag');
    }
  };

  const isTagAdded = (tagId: string) => {
    return conversationTags.some((ct) => ct.tagId === tagId);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <TagIcon className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Tags da Conversa</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {conversationTags.length > 0 && (
          <>
            <div className="px-2 py-2 space-y-1">
              {conversationTags.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ct.tag.color }}
                    />
                    <span className="text-sm">{ct.tag.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTag(ct.tagId)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className="text-xs text-gray-500">
          Adicionar Tag
        </DropdownMenuLabel>

        {availableTags.filter((tag) => !isTagAdded(tag.id)).length > 0 ? (
          availableTags
            .filter((tag) => !isTagAdded(tag.id))
            .map((tag) => (
              <DropdownMenuItem
                key={tag.id}
                onClick={() => handleAddTag(tag.id)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                  {tag.isGlobal && (
                    <span className="text-xs text-gray-500">(Global)</span>
                  )}
                </div>
              </DropdownMenuItem>
            ))
        ) : (
          <div className="px-2 py-3 text-sm text-gray-500 text-center">
            {availableTags.length === 0
              ? 'Nenhuma tag disponível'
              : 'Todas as tags já foram adicionadas'}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
