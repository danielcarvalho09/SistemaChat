import { useState, useEffect } from 'react';
import { MessageSquare, Users, Building, Smartphone, TrendingUp, Clock, BarChart } from 'lucide-react';
import { api } from '../../lib/axios';
import socketService from '../../lib/socket';
import { cn } from '../../lib/utils';

interface Stats {
  totalConversations: number;
  activeConversations: number;
  totalUsers: number;
  totalDepartments: number;
  totalConnections: number;
  avgResponseTime: number;
  conversationsByStatus: {
    waiting: number;
    in_progress: number;
    resolved: number;
  };
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    // Usar socket global
    const socket = socketService.getSocket();
    if (!socket) {
      console.error('❌ Socket não está conectado');
      return;
    }

    console.log('✅ Usando WebSocket global no AdminDashboard');

    // Escutar novas conversas
    socket.on('new_conversation', (conversation) => {
      console.log('🆕 Nova conversa recebida:', conversation);
      // Atualizar estatísticas
      fetchStats();
    });

    return () => {
      socket.off('new_conversation');
    };
  }, []);

  const fetchStats = async () => {
    try {
      // Simular dados - você pode criar um endpoint /stats no backend
      const [conversations, users, departments, connections] = await Promise.all([
        api.get('/conversations'),
        api.get('/users'),
        api.get('/departments'),
        api.get('/connections'),
      ]);

      const conversationsData = conversations.data.data || [];
      
      setStats({
        totalConversations: conversationsData.length,
        activeConversations: conversationsData.filter((c: any) => c.status !== 'resolved').length,
        totalUsers: users.data.data?.length || 0,
        totalDepartments: departments.data.data?.length || 0,
        totalConnections: connections.data.data?.length || 0,
        avgResponseTime: 5.2,
        conversationsByStatus: {
          waiting: conversationsData.filter((c: any) => c.status === 'waiting').length,
          in_progress: conversationsData.filter((c: any) => c.status === 'in_progress').length,
          resolved: conversationsData.filter((c: any) => c.status === 'resolved').length,
        },
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Administrativo</h1>
          <p className="text-sm text-gray-600 mt-1">
            Visão geral do sistema e métricas importantes
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Features Grid with Dashboard Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10 py-16 max-w-7xl mx-auto">
          {/* Feature 1 - Total Conversas */}
          <div
            className={cn(
              "flex flex-col lg:border-r py-16 relative group/feature dark:border-neutral-800",
              "lg:border-l dark:border-neutral-800",
              "lg:border-b dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <MessageSquare className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Total de Conversas
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              {stats?.totalConversations || 0} conversas no total, {stats?.activeConversations || 0} ativas no momento
            </p>
          </div>

          {/* Feature 2 - Usuários */}
          <div
            className={cn(
              "flex flex-col lg:border-r py-16 relative group/feature dark:border-neutral-800",
              "lg:border-b dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <Users className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Usuários
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              {stats?.totalUsers || 0} usuários cadastrados entre atendentes e administradores
            </p>
          </div>

          {/* Feature 3 - Departamentos */}
          <div
            className={cn(
              "flex flex-col lg:border-r py-16 relative group/feature dark:border-neutral-800",
              "lg:border-b dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <Building className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Departamentos
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              {stats?.totalDepartments || 0} departamentos organizando as equipes de atendimento
            </p>
          </div>

          {/* Feature 4 - Conexões WhatsApp */}
          <div
            className={cn(
              "flex flex-col py-16 relative group/feature dark:border-neutral-800",
              "lg:border-b dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <Smartphone className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Conexões WhatsApp
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              {stats?.totalConnections || 0} números WhatsApp conectados e ativos
            </p>
          </div>

          {/* Feature 5 - Aguardando */}
          <div
            className={cn(
              "flex flex-col lg:border-r py-16 relative group/feature dark:border-neutral-800",
              "lg:border-l dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <Clock className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Aguardando
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              {stats?.conversationsByStatus.waiting || 0} conversas aguardando atendimento
            </p>
          </div>

          {/* Feature 6 - Em Atendimento */}
          <div
            className={cn(
              "flex flex-col lg:border-r py-16 relative group/feature dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <TrendingUp className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Em Atendimento
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              {stats?.conversationsByStatus.in_progress || 0} conversas sendo atendidas no momento
            </p>
          </div>

          {/* Feature 7 - Resolvidas */}
          <div
            className={cn(
              "flex flex-col lg:border-r py-16 relative group/feature dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <BarChart className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Resolvidas
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              {stats?.conversationsByStatus.resolved || 0} conversas finalizadas com sucesso
            </p>
          </div>

          {/* Feature 8 - Performance */}
          <div
            className={cn(
              "flex flex-col py-16 relative group/feature dark:border-neutral-800"
            )}
          >
            <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            <div className="mb-6 relative z-10 px-12 text-neutral-600 dark:text-neutral-400">
              <TrendingUp className="h-12 w-12" />
            </div>
            <div className="text-xl font-bold mb-3 relative z-10 px-12">
              <div className="absolute left-0 inset-y-0 h-8 group-hover/feature:h-10 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
              <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                Performance
              </span>
            </div>
            <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-12">
              Tempo médio de resposta: {stats?.avgResponseTime || 0}m. Crescimento de +12% no mês
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
