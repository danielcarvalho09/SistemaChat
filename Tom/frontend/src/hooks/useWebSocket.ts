import { useEffect } from 'react';
import { socketService } from '../lib/socket';
import { useConversationStore } from '../store/conversationStore';
import { Message, Conversation } from '../types';

export function useWebSocket() {
  const { addMessage, addConversation, updateConversation, fetchConversations } = useConversationStore();

  useEffect(() => {
    // Pegar token do localStorage (chave correta: accessToken)
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('⚠️ No token found, skipping WebSocket connection');
      return;
    }

    console.log('✅ Token found, connecting to WebSocket...');
    
    // Conectar ao WebSocket
    socketService.connect(token);

    // Escutar novas mensagens
    socketService.on('new_message', (data: { conversationId: string; message: Message }) => {
      console.log('📨 Nova mensagem recebida via WebSocket:', data);
      
      // Verificar se a mensagem tem id antes de verificar duplicação
      if (!data.message?.id) {
        console.error('❌ Mensagem sem ID recebida:', data);
        return;
      }
      
      // Verificar se mensagem já existe (evitar duplicação)
      const { messages } = useConversationStore.getState();
      const conversationMessages = messages[data.conversationId] || [];
      const exists = conversationMessages.some(m => m.id === data.message.id);
      
      if (!exists) {
        // Adicionar mensagem ao store
        addMessage(data.conversationId, data.message);
        console.log('✅ Mensagem adicionada');
        
        // Atualizar conversa (última mensagem, timestamp)
        updateConversation(data.conversationId, {
          lastMessageAt: data.message.timestamp || new Date().toISOString(),
        });
      } else {
        console.log('⚠️ Mensagem já existe, ignorando duplicação');
      }
    });

    // Escutar novas conversas
    socketService.on('new_conversation', (conversation: Conversation) => {
      console.log('🆕 Nova conversa recebida via WebSocket:', conversation);
      
      // Verificar se conversa já existe antes de adicionar (evitar duplicação)
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
    socketService.on('conversation_update', (data: { conversationId: string; updates: Partial<Conversation> }) => {
      console.log('🔄 Atualização de conversa via WebSocket:', data);
      updateConversation(data.conversationId, data.updates);
    });

    // Escutar atribuição de conversa
    socketService.on('conversation_assigned', (data: { conversationId: string; userId: string }) => {
      console.log('👤 Conversa atribuída via WebSocket:', data);
      fetchConversations(); // Recarregar lista
    });

    // Escutar status de mensagem
    socketService.on('message_status_update', (data: { conversationId: string; messageId: string; status: string }) => {
      console.log('✅ Status de mensagem atualizado via WebSocket:', data);
      // Atualizar status da mensagem no store
      // TODO: Implementar updateMessage no store se necessário
    });

    // Cleanup ao desmontar
    return () => {
      socketService.disconnect();
    };
  }, [addMessage, addConversation, updateConversation, fetchConversations]);
}
