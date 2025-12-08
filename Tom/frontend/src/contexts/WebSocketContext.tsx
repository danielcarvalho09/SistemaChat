import React, { createContext, useContext, useEffect, useRef } from 'react';
import { socketService } from '../lib/socket';
import { useConversationStore } from '../store/conversationStore';
import { Message, Conversation } from '../types';
import { useAuthStore } from '../store/authStore';

interface WebSocketContextType {
  isConnected: boolean;
  syncMessages: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  syncMessages: async () => { },
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { addMessage, addConversation, updateConversation, updateMessage, fetchConversations } = useConversationStore();
  const { isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = React.useState(false);
  const hasInitialized = useRef(false);
  const lastWhatsAppConnectionState = useRef<Map<string, 'connected' | 'disconnected'>>(new Map()); // Rastrear estado anterior de cada conexão
  const syncInProgress = useRef(false); // Flag para evitar múltiplas sincronizações simultâneas
  const lastSyncTime = useRef<number>(0); // Timestamp da última sincronização
  const SYNC_COOLDOWN_MS = 30000; // 30 segundos de cooldown entre sincronizações

  useEffect(() => {
    // Só conectar se estiver autenticado
    if (!isAuthenticated) {
      console.log('⏭️ Usuário não autenticado, pulando WebSocket');
      return;
    }

    // Evitar múltiplas inicializações
    if (hasInitialized.current) {
      console.log('✅ WebSocket já inicializado, pulando...');
      return;
    }

    console.log('🔌 Inicializando WebSocket global...');
    hasInitialized.current = true;

    // Conectar ao WebSocket
    const socket = socketService.connect();

    // Função para sincronizar mensagens e recarregar conversas
    // SÓ sincroniza se realmente houver uma reconexão (mudança de estado desconectado -> conectado)
    const syncAndReload = async (connectionId?: string, isReconnection: boolean = false) => {
      // Evitar múltiplas sincronizações simultâneas
      if (syncInProgress.current) {
        console.log('⏭️ Sincronização já em andamento, ignorando...');
        return;
      }

      // Cooldown: não sincronizar se já sincronizou há menos de 30 segundos
      const timeSinceLastSync = Date.now() - lastSyncTime.current;
      if (timeSinceLastSync < SYNC_COOLDOWN_MS && !isReconnection) {
        console.log(`⏭️ Sincronização recente (${Math.round(timeSinceLastSync/1000)}s atrás), ignorando...`);
        return;
      }

      syncInProgress.current = true;
      lastSyncTime.current = Date.now();

      try {
        console.log('🔄 Sincronizando e recarregando conversações...');
        // Aguardar sincronização pelo socketService (já acontece automaticamente)
        // Esperar 2 segundos para sincronização completar
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Recarregar lista de conversas para pegar mensagens sincronizadas
        await fetchConversations();
        console.log('✅ Conversas recarregadas após sincronização');
      } catch (error) {
        console.error('❌ Erro ao recarregar após sincronização:', error);
      } finally {
        syncInProgress.current = false;
      }
    };

    // Listener de conexão
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado globalmente');
      setIsConnected(true);

      // Sincronizar e recarregar ao conectar
      syncAndReload();
    });

    socket.on('disconnect', () => {
      console.warn('⚠️ WebSocket desconectado');
      setIsConnected(false);
    });

    // Listener de reconexão
    socket.on('reconnect', () => {
      console.log('✅ Reconectado - sincronizando...');
      syncAndReload();
    });

    // Escutar novas mensagens
    socket.on('new_message', (data: { conversationId: string; message: Message }) => {
      console.log('📨 Nova mensagem recebida via WebSocket:', data);

      if (!data.message?.id) {
        console.error('❌ Mensagem sem ID recebida:', data);
        return;
      }

      // Verificar se mensagem já existe
      const { messages } = useConversationStore.getState();
      const conversationMessages = messages[data.conversationId] || [];
      const existingMessage = conversationMessages.find(m => m.id === data.message.id);

      if (existingMessage) {
        // Mensagem já existe - atualizar (pode ser mudança de status: sending -> sent)
        console.log('🔄 Mensagem já existe, atualizando status:', {
          id: data.message.id,
          oldStatus: existingMessage.status,
          newStatus: data.message.status
        });
        updateMessage(data.conversationId, data.message.id, data.message);
        console.log('✅ Mensagem atualizada');
      } else {
        // Nova mensagem - adicionar
        addMessage(data.conversationId, data.message);
        console.log('✅ Mensagem adicionada');
      }

      // Atualizar timestamp da conversa
      updateConversation(data.conversationId, {
        lastMessageAt: data.message.timestamp || new Date().toISOString(),
      });
    });

    // Escutar novas conversas
    socket.on('new_conversation', (conversation: Conversation) => {
      console.log('🆕 Nova conversa recebida via WebSocket:', conversation);

      const { conversations } = useConversationStore.getState();
      const exists = conversations.some(c => c.id === conversation.id);

      if (!exists) {
        addConversation(conversation);
        console.log('✅ Conversa adicionada à lista');
      } else {
        console.log('⚠️ Conversa já existe, ignorando duplicação');
      }
    });

    // Escutar atualizações de conversa
    socket.on('conversation_update', (data: { conversationId: string; updates: Partial<Conversation> }) => {
      console.log('🔄 Atualização de conversa via WebSocket:', data);
      updateConversation(data.conversationId, data.updates);
    });

    // Escutar atribuição de conversa
    socket.on('conversation_assigned', (data: { conversationId: string; userId: string }) => {
      console.log('👤 Conversa atribuída via WebSocket:', data);
      fetchConversations();
    });

    // Escutar status de mensagem
    socket.on('message_status_update', (data: { conversationId: string; messageId: string; status: string }) => {
      console.log('✅ Status de mensagem atualizado via WebSocket:', data);

      // Atualizar status da mensagem no store
      if (data.conversationId && data.messageId && data.status) {
        updateMessage(data.conversationId, data.messageId, { status: data.status as any });
        console.log(`✅ Mensagem ${data.messageId} atualizada para status: ${data.status}`);
      }
    });

    // --- EVENTOS DO WHATSAPP (Que o Daniel "esqueceu") ---
    // Adicionando listeners globais porque confiar so no componente visual eh pedir pra dar erro

    socket.on('whatsapp_connected', (data?: { connectionId: string } | string) => {
      // Suportar tanto objeto quanto string (compatibilidade)
      const connectionId = typeof data === 'string' ? data : (data?.connectionId || 'unknown');
      console.log('✅ WhatsApp conectado globalmente:', connectionId);
      
      // ✅ CRÍTICO: Só sincronizar se realmente houver uma RECONEXÃO
      // (mudança de estado: desconectado -> conectado)
      const previousState = lastWhatsAppConnectionState.current.get(connectionId);
      
      if (previousState === 'disconnected' || previousState === undefined) {
        // Realmente é uma reconexão - sincronizar
        console.log('🔄 Reconexão detectada, sincronizando...');
        lastWhatsAppConnectionState.current.set(connectionId, 'connected');
        syncAndReload(connectionId, true); // isReconnection = true
      } else {
        // Já estava conectado - apenas atualizar estado, SEM sincronizar
        console.log('ℹ️ WhatsApp já estava conectado, apenas atualizando estado (sem sincronizar)');
        lastWhatsAppConnectionState.current.set(connectionId, 'connected');
      }
    });

    socket.on('whatsapp_disconnected', (data?: { connectionId: string } | string) => {
      // Suportar tanto objeto quanto string (compatibilidade)
      const connectionId = typeof data === 'string' ? data : (data?.connectionId || 'unknown');
      console.warn('❌ WhatsApp desconectado globalmente:', connectionId);
      // Atualizar estado para desconectado
      lastWhatsAppConnectionState.current.set(connectionId, 'disconnected');
    });

    socket.on('whatsapp_connecting', () => {
      console.log('🔄 WhatsApp conectando...');
    });

    // Cleanup APENAS ao deslogar (não ao trocar de rota)
    return () => {
      console.log('🔌 Limpando WebSocket global...');
      hasInitialized.current = false;
      socketService.off('connect');
      socketService.off('disconnect');
      socketService.off('new_message');
      socketService.off('new_conversation');
      socketService.off('conversation_update');
      socketService.off('conversation_assigned');
      socketService.off('message_status_update');

      // Limpar os novos eventos tambem, senao vira bagunca
      socketService.off('whatsapp_connected');
      socketService.off('whatsapp_disconnected');
      socketService.off('whatsapp_connecting');

      // Só desconectar se usuário deslogou
      if (!isAuthenticated) {
        socketService.disconnect();
      }
    };
  }, [isAuthenticated, addMessage, addConversation, updateConversation, updateMessage, fetchConversations]);

  // Função pública para forçar sincronização manual
  const syncMessages = async () => {
    try {
      console.log('🔄 Sincronização manual iniciada...');
      await fetchConversations();
      console.log('✅ Sincronização manual completa');
    } catch (error) {
      console.error('❌ Erro na sincronização manual:', error);
    }
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, syncMessages }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  return useContext(WebSocketContext);
}
