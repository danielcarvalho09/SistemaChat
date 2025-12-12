import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, MessageCircle, Paperclip, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface Task {
  id: string;
  title: string;
  subtitle?: string; // Para número formatado (quando não for grupo)
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignee?: {
    name: string;
    avatar?: string;
  };
  tags?: string[];
  dueDate?: string;
  attachments?: number;
  comments?: number;
  conversation?: any; // Para armazenar dados da conversa
  contactInitial?: string; // Primeira letra do pushName para o avatar
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
  color?: string;
}

interface KanbanBoardProps {
  columns: Column[];
  onTaskMove?: (taskId: string, fromColumnId: string, toColumnId: string) => void;
  onTaskClick?: (task: Task, columnId: string, event: React.MouseEvent) => void;
  className?: string;
}

export function KanbanBoard({ columns: initialColumns, onTaskMove, onTaskClick, className }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const handleDragStart = (e: React.DragEvent, task: Task, columnId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ task, sourceColumnId: columnId }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const { task, sourceColumnId } = data;

    if (sourceColumnId === targetColumnId) return;

    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === sourceColumnId) {
          return { ...col, tasks: col.tasks.filter((t) => t.id !== task.id) };
        }
        if (col.id === targetColumnId) {
          return { ...col, tasks: [...col.tasks, task] };
        }
        return col;
      }),
    );

    onTaskMove?.(task.id, sourceColumnId, targetColumnId);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMM', { locale: ptBR });
    } catch {
      return null;
    }
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {columns.map((column) => (
          <div
            key={column.id}
            className="bg-white/20 dark:bg-neutral-900/20 backdrop-blur-xl rounded-3xl p-5 border border-border dark:border-neutral-700/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: column.color || '#8B7355' }} />
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {column.title}
                </h3>
                <Badge className="bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200 border-neutral-200/50 dark:border-neutral-600/50">
                  {column.tasks.length}
                </Badge>
              </div>
              <button className="p-1 rounded-full bg-white/30 dark:bg-neutral-800/30 hover:bg-white/50 dark:hover:bg-neutral-700/50 transition-colors">
                <Plus className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
              </button>
            </div>

            <div className="space-y-4">
              {column.tasks.map((task) => (
                <Card
                  key={task.id}
                  data-card-id={task.id}
                  className="cursor-pointer transition-all duration-300 border bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm hover:bg-white/70 dark:hover:bg-neutral-700/70"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task, column.id)}
                  onClick={(e) => onTaskClick?.(task, column.id, e)}
                >
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                            {task.title}
                          </h4>
                          {task.subtitle && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                              {task.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {task.tags.map((tag) => (
                            <Badge
                              key={tag}
                              className="text-xs bg-neutral-100/60 dark:bg-neutral-700/60 text-neutral-800 dark:text-neutral-200 border-neutral-200/50 dark:border-neutral-600/50 backdrop-blur-sm"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-200/30 dark:border-neutral-700/30">
                        <div className="flex items-center gap-4 text-neutral-600 dark:text-neutral-400">
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span className="text-xs font-medium">{formatDate(task.dueDate)}</span>
                            </div>
                          )}
                          {task.comments !== undefined && task.comments > 0 && (
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-4 h-4" />
                              <span className="text-xs font-medium">{task.comments}</span>
                            </div>
                          )}
                          {task.attachments !== undefined && task.attachments > 0 && (
                            <div className="flex items-center gap-1">
                              <Paperclip className="w-4 h-4" />
                              <span className="text-xs font-medium">{task.attachments}</span>
                            </div>
                          )}
                        </div>

                        {task.contactInitial && (
                          <Avatar className="w-8 h-8 ring-2 ring-white/50 dark:ring-neutral-700/50">
                            <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                              {task.contactInitial}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

