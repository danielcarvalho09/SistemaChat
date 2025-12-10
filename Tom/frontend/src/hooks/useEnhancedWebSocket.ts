import { useEffect, useCallback } from 'react';
import { socketService } from '../lib/socket';
import { useConversationStore } from '../store/conversationStore';
import { Message, Conversation } from '../types';

/**
 * Hook aprimorado para WebSocket com suporte a eventos em tempo real
 * Garante atualização instantânea sem necessidade de reload
 */
export function useEnhancedWebSocket() {
  const { 
    addMessage, 
    addConversation, 
    updateConversation, 
    updateMessage, 
    fetchConversations,
    setConversations,
    conversations,
  } = useConversationStore();

  // Função para aceitar conversa via WebSocket
  const acceptConversation = useCallback((conversationId: string) => {
    console.log(`🎯 Accepting conversation ${conversationId} via WebSocket`);
    socketService.emit('accept_conversation', conversationId);
  }, []);

  useEffect(() => {
    // Pegar token do localStorage
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('⚠️ No token found, skipping WebSocket connection');
      return;
    }

    console.log('✅ Token found, connecting to Enhanced WebSocket...');
    
    // Conectar ao WebSocket
    socketService.connect(token);

    // 🔥 NOVO: Escutar evento de conversa aceita (broadcast)
    socketService.on('conversation_accepted', (data: { 
      conversationId: string; 
      userId: string; 
      departmentId: string | null;
      conversation: Conversation;
    }) => {
      console.log('✅ Conversation accepted via WebSocket:', data);
      
      // Atualizar conversa no store
      updateConversation(data.conversationId, {
        status: 'in_progress',
        assignedUser: data.conversation.assignedUser,
        department: data.conversation.department,
      });
      
      // Se a conversa não existe na lista, adicionar
      const exists = conversations.some(c => c.id === data.conversationId);
      if (!exists) {
        addConversation(data.conversation);
      }
      
      console.log('✅ UI updated with accepted conversation');
    });

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
        console.log('✅ Mensagem adicionada ao store');
      } else {
        // Atualizar mensagem existente (status, conteúdo, quoted etc.)
        updateMessage(data.conversationId, data.message.id, data.message);
        console.log('🔄 Mensagem atualizada no store');
      }

      // Atualizar metadados da conversa (última mensagem/timestamp)
      updateConversation(data.conversationId, {
        lastMessageAt: data.message.timestamp || new Date().toISOString(),
        lastMessage: data.message,
        // Se tem setor na mensagem, atualizar também
        ...(data.message && 'departmentId' in data.message && { 
          department: (data.message as any).department 
        }),
      });
    });

    // Escutar novas conversas
    socketService.on('new_conversation', (conversation: Conversation) => {
      console.log('🆕 Nova conversa recebida via WebSocket:', conversation);
      
      // Verificar se conversa já existe antes de adicionar (evitar duplicação)
      const { conversations } = useConversationStore.getState();
      const exists = conversations.some(c => c.id === conversation.id);
      
      if (!exists) {
        addConversation(conversation);
        console.log('✅ Nova conversa adicionada à lista');
        
        // 🔥 Se tem departamento, já vem atribuído automaticamente
        if (conversation.department) {
          console.log(`📂 Conversa já tem setor atribuído: ${conversation.department.name}`);
        }
      } else {
        // Atualizar conversa existente
        updateConversation(conversation.id, conversation);
        console.log('🔄 Conversa existente atualizada');
      }
    });

    // Escutar atualizações de conversa
    socketService.on('conversation_update', (data: { conversationId: string; updates: Partial<Conversation> }) => {
      console.log('🔄 Atualização de conversa via WebSocket:', data);
      
      // Atualizar conversa no store
      updateConversation(data.conversationId, data.updates);
      
      // Se foi atribuído um setor, logar
      if (data.updates.department) {
        console.log(`📂 Setor atribuído: ${data.updates.department.name}`);
      }
      
      // Se mudou o status, logar
      if (data.updates.status) {
        console.log(`📊 Status mudou para: ${data.updates.status}`);
      }
    });

    // Escutar atribuição de conversa
    socketService.on('conversation_assigned', (data: { conversationId: string; userId: string }) => {
      console.log('👤 Conversa atribuída via WebSocket:', data);
      
      // Atualizar apenas a conversa específica, não recarregar todas
      const conversation = conversations.find(c => c.id === data.conversationId);
      if (conversation) {
        // Marcar como atribuída
        updateConversation(data.conversationId, {
          status: 'in_progress',
          assignedUser: { id: data.userId } as any,
        });
      } else {
        // Se não tem a conversa, buscar apenas ela
        console.log('📥 Conversa não encontrada localmente, buscando...');
        fetchConversations(true); // Forçar busca
      }
    });

    // Escutar status de mensagem
    socketService.on('message_status_update', (data: { conversationId: string; messageId: string; status: string }) => {
      console.log('✅ Status de mensagem atualizado via WebSocket:', data);
      updateMessage(data.conversationId, data.messageId, { status: data.status as Message['status'] });
    });

    // Eventos do WhatsApp
    socketService.on('whatsapp_connected', (data: { connectionId: string }) => {
      console.log('📱 WhatsApp conectado:', data);
      // Poderia atualizar UI com indicador de conexão
    });

    socketService.on('whatsapp_disconnected', (data: { connectionId: string }) => {
      console.log('📱 WhatsApp desconectado:', data);
      // Poderia atualizar UI com indicador de desconexão
    });

    socketService.on('whatsapp_qr_code', (data: { connectionId: string; qrCode: string }) => {
      console.log('📱 QR Code recebido:', data.connectionId);
      // Poderia exibir QR Code na UI se necessário
    });

    // Cleanup ao desmontar - apenas remover listeners, NÃO desconectar
    return () => {
      socketService.off('conversation_accepted');
      socketService.off('new_message');
      socketService.off('new_conversation');
      socketService.off('conversation_update');
      socketService.off('conversation_assigned');
      socketService.off('message_status_update');
      socketService.off('whatsapp_connected');
      socketService.off('whatsapp_disconnected');
      socketService.off('whatsapp_qr_code');
    };
  }, [
    addMessage, 
    addConversation, 
    updateConversation, 
    updateMessage, 
    fetchConversations, 
    conversations,
    setConversations,
  ]);

  return {
    acceptConversation,
  };
}
