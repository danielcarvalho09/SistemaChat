import { create } from 'zustand';
import { Conversation, Message } from '../types';
import { api } from '../lib/axios';

interface ConversationState {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: Record<string, Message[]>; // conversationId -> messages
  isLoading: boolean;
  error: string | null;
  filter: 'all' | 'waiting' | 'in_progress' | 'resolved' | 'mine';
  searchQuery: string;
  typingUsers: Record<string, string[]>; // conversationId -> userIds

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  removeConversation: (conversationId: string) => void;
  selectConversation: (conversation: Conversation | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  setFilter: (filter: ConversationState['filter']) => void;
  setSearchQuery: (query: string) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // API Actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  updateConversationStatus: (conversationId: string, status: string) => Promise<void>;
  syncConversation: (conversationId: string) => Promise<void>;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  selectedConversation: null,
  messages: {},
  isLoading: false,
  error: null,
  filter: 'all',
  searchQuery: '',
  typingUsers: {},

  setConversations: (conversations) => {
    set({ conversations });
  },

  addConversation: (conversation) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    }));
  },

  updateConversation: (conversationId, updates) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, ...updates } : conv
      ),
      selectedConversation:
        state.selectedConversation?.id === conversationId
          ? { ...state.selectedConversation, ...updates }
          : state.selectedConversation,
    }));
  },

  removeConversation: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.filter((conv) => conv.id !== conversationId),
      selectedConversation:
        state.selectedConversation?.id === conversationId ? null : state.selectedConversation,
    }));
  },

  selectConversation: (conversation) => {
    set({ selectedConversation: conversation });
  },

  setMessages: (conversationId, messages) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    }));
  },

  addMessage: (conversationId, message) => {
    set((state) => {
      const existingMessages = state.messages[conversationId] || [];
      const index = existingMessages.findIndex((msg) => msg.id === message.id);

      let updatedMessages: Message[];
      if (index >= 0) {
        // Atualizar mensagem existente (status, conteúdo, quoted etc.)
        updatedMessages = existingMessages.map((msg, idx) =>
          idx === index ? { ...msg, ...message } : msg
        );
      } else {
        updatedMessages = [...existingMessages, message];
      }

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });

    // Atualizar última mensagem da conversa
    get().updateConversation(conversationId, {
      lastMessage: message,
      lastMessageAt: message.timestamp,
    });
  },

  updateMessage: (conversationId, messageId, updates) => {
    set((state) => {
      const messages = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: messages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        },
      };
    });
  },

  setFilter: (filter) => {
    set({ filter });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setTyping: (conversationId, userId, isTyping) => {
    set((state) => {
      const currentTyping = state.typingUsers[conversationId] || [];
      const newTyping = isTyping
        ? [...currentTyping, userId].filter((id, index, self) => self.indexOf(id) === index)
        : currentTyping.filter((id) => id !== userId);

      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: newTyping,
        },
      };
    });
  },

  incrementUnread: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: conv.unreadCount + 1 } : conv
      ),
    }));
  },

  clearUnread: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      ),
    }));
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  setError: (error) => {
    set({ error });
  },

  // API Actions
  fetchConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/conversations');
      set({ conversations: response.data.data || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Erro ao carregar conversas', isLoading: false });
    }
  },

  fetchMessages: async (conversationId: string) => {
    try {
      const response = await api.get(`/conversations/${conversationId}/messages`);
      get().setMessages(conversationId, response.data.data || []);
    } catch (error: any) {
      set({ error: error.message || 'Erro ao carregar mensagens' });
    }
  },

  sendMessage: async (conversationId: string, content: string, quotedMessageId?: string | null) => {
    try {
      await api.post(`/conversations/${conversationId}/messages`, {
        content,
        messageType: 'text',
        ...(quotedMessageId ? { quotedMessageId } : {}),
      });
      
      // NÃO adicionar mensagem aqui!
      // O WebSocket vai emitir new_message e adicionar automaticamente
      // Isso evita duplicação
    } catch (error: any) {
      set({ error: error.message || 'Erro ao enviar mensagem' });
      throw error;
    }
  },

  updateConversationStatus: async (conversationId: string, status: string) => {
    try {
      await api.patch(`/conversations/${conversationId}/status`, { status });
      // Atualizar localmente
      const updates: Partial<Conversation> = { 
        status: status as any
      };
      // Se voltar para waiting, remover atribuição
      if (status === 'waiting') {
        updates.assignedUser = null;
      }
      get().updateConversation(conversationId, updates);
    } catch (error: any) {
      set({ error: error.message || 'Erro ao atualizar status' });
      throw error;
    }
  },

  syncConversation: async (conversationId: string) => {
    try {
      console.log(`🔄 Forçando sincronização da conversa ${conversationId}...`);
      // Chamar endpoint de sincronização
      await api.post(`/sync/conversation/${conversationId}`);
      // Aguardar 1 segundo para sincronização completar
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Recarregar mensagens
      await get().fetchMessages(conversationId);
      console.log('✅ Conversa sincronizada com sucesso');
    } catch (error: any) {
      console.error('❌ Erro ao sincronizar conversa:', error);
      set({ error: error.message || 'Erro ao sincronizar conversa' });
    }
  },
}));
