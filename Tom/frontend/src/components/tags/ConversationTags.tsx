import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ConversationTag {
  id: string;
  tag: Tag;
}

interface ConversationTagsProps {
  conversationId: string;
  maxTags?: number;
}

export function ConversationTags({
  conversationId,
  maxTags = 2,
}: ConversationTagsProps) {
  const [tags, setTags] = useState<ConversationTag[]>([]);

  useEffect(() => {
    loadTags();
  }, [conversationId]);

  const loadTags = async () => {
    try {
      const response = await api.get(`/conversations/${conversationId}/tags`);
      setTags(response.data);
    } catch (error) {
      console.error('Error loading conversation tags:', error);
    }
  };

  if (tags.length === 0) return null;

  const visibleTags = tags.slice(0, maxTags);
  const remainingCount = tags.length - maxTags;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleTags.map((ct) => (
        <span
          key={ct.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${ct.tag.color}20`,
            color: ct.tag.color,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: ct.tag.color }}
          />
          {ct.tag.name}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-gray-500">+{remainingCount}</span>
      )}
    </div>
  );
}
