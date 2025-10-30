import React, { createContext, useContext, useEffect, useRef } from 'react';
import { socketService } from '../lib/socket';
import { useConversationStore } from '../store/conversationStore';
import { Message, Conversation } from '../types';
import { useAuthStore } from '../store/authStore';

interface WebSocketContextType {
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({ isConnected: false });

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { addMessage, addConversation, updateConversation, fetchConversations } = useConversationStore();
  const { isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = React.useState(false);
  const hasInitialized = useRef(false);

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

    // Pegar token do localStorage
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('⚠️ No token found, skipping WebSocket connection');
      return;
    }

    console.log('🔌 Inicializando WebSocket global...');
    hasInitialized.current = true;
    
    // Conectar ao WebSocket
    const socket = socketService.connect(token);

    // Listener de conexão
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado globalmente');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.warn('⚠️ WebSocket desconectado');
      setIsConnected(false);
    });

    // Escutar novas mensagens
    socket.on('new_message', (data: { conversationId: string; message: Message }) => {
      console.log('📨 Nova mensagem recebida via WebSocket:', data);
      
      if (!data.message?.id) {
        console.error('❌ Mensagem sem ID recebida:', data);
        return;
      }
      
      // Verificar duplicação
      const { messages } = useConversationStore.getState();
      const conversationMessages = messages[data.conversationId] || [];
      const exists = conversationMessages.some(m => m.id === data.message.id);
      
      if (!exists) {
        addMessage(data.conversationId, data.message);
        console.log('✅ Mensagem adicionada');
        
        updateConversation(data.conversationId, {
          lastMessageAt: data.message.timestamp || new Date().toISOString(),
        });
      } else {
        console.log('⚠️ Mensagem já existe, ignorando duplicação');
      }
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
      
      // Só desconectar se usuário deslogou
      if (!isAuthenticated) {
        socketService.disconnect();
      }
    };
  }, [isAuthenticated, addMessage, addConversation, updateConversation, fetchConversations]);

  return (
    <WebSocketContext.Provider value={{ isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  return useContext(WebSocketContext);
}
