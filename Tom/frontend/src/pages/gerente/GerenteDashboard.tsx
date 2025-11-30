import { useState, useEffect } from 'react';
import { Send, ListChecks, Clock, TrendingUp } from 'lucide-react';
import { api } from '../../lib/axios';
import { cn } from '../../lib/utils';

interface GerenteStats {
  totalBroadcasts: number;
  activeBroadcasts: number;
  totalContactLists: number;
  totalContacts: number;
  avgIntervalMinutes: number;
}

export function GerenteDashboard() {
  const [stats, setStats] = useState<GerenteStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Buscar apenas dados relacionados a broadcasts e listas de contatos
      const [broadcastsResponse, contactListsResponse] = await Promise.all([
        api.get('/broadcast/history').catch(() => ({ data: { data: [] } })),
        api.get('/contact-lists').catch(() => ({ data: { data: [] } })),
      ]);

      const broadcasts = broadcastsResponse.data?.data || [];
      const contactLists = contactListsResponse.data?.data || [];
      
      // Calcular total de contatos em todas as listas
      let totalContacts = 0;
      if (Array.isArray(contactLists)) {
        contactLists.forEach((list: any) => {
          if (list.contacts && Array.isArray(list.contacts)) {
            totalContacts += list.contacts.length;
          }
        });
      }

      // Buscar configuração de intervalos
      let avgIntervalMinutes = 60; // Padrão
      try {
        const intervalResponse = await api.get('/broadcast/interval-config');
        if (intervalResponse.data?.data) {
          avgIntervalMinutes = intervalResponse.data.data.intervalMinutes || 60;
        }
      } catch (error) {
        // Usar padrão se não conseguir buscar
      }

      const activeBroadcasts = broadcasts.filter((b: any) => 
        b.status === 'sending' || b.status === 'scheduled'
      ).length;

      setStats({
        totalBroadcasts: broadcasts.length,
        activeBroadcasts,
        totalContactLists: contactLists.length,
        totalContacts,
        avgIntervalMinutes,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas do gerente:', error);
      // Definir valores padrão em caso de erro
      setStats({
        totalBroadcasts: 0,
        activeBroadcasts: 0,
        totalContactLists: 0,
        totalContacts: 0,
        avgIntervalMinutes: 60,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-gray-900">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Gerente</h1>
          <p className="text-sm text-gray-600 mt-1">
            Visão geral de disparos e listas de contatos
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Grid de estatísticas do gerente */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10 py-16 max-w-7xl mx-auto">
          {/* Feature 1 - Disparos Realizados */}
          <div
            className={cn(
              "flex flex-col lg:border-r py-16 relative group/feature dark:border-neutral-800",
              "lg:border-l dark:border-neutral-800",
              "lg:border-b dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <Send className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-purple-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Disparos Realizados
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              {stats?.totalBroadcasts || 0} disparos no total, {stats?.activeBroadcasts || 0} em andamento
            </p>
          </div>

          {/* Feature 2 - Listas de Contatos */}
          <div
            className={cn(
              "flex flex-col lg:border-r py-16 relative group/feature dark:border-neutral-800",
              "lg:border-b dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <ListChecks className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-purple-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Listas de Contatos
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              {stats?.totalContactLists || 0} listas cadastradas com {stats?.totalContacts || 0} contatos no total
            </p>
          </div>

          {/* Feature 3 - Intervalo Configurado */}
          <div
            className={cn(
              "flex flex-col lg:border-r py-16 relative group/feature dark:border-neutral-800",
              "lg:border-b dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <Clock className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-purple-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Intervalo Configurado
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              Intervalo entre mensagens: {stats?.avgIntervalMinutes || 60} segundos por contato
            </p>
          </div>

          {/* Feature 4 - Ações Rápidas */}
          <div
            className={cn(
              "flex flex-col py-16 relative group/feature dark:border-neutral-800",
              "lg:border-b dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <TrendingUp className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-purple-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Ações Rápidas
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              Gerencie seus disparos e listas de contatos de forma eficiente
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

