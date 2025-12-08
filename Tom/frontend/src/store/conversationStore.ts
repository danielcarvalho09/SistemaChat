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
  
  // Cache para evitar requisições duplicadas
  lastFetchTime: number; // Timestamp da última busca
  isFetching: boolean; // Flag para evitar múltiplas requisições simultâneas
  fetchPromise: Promise<void> | null; // Promise da requisição em andamento

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
  fetchConversations: (force?: boolean) => Promise<void>;
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
  lastFetchTime: 0,
  isFetching: false,
  fetchPromise: null,

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
          [conversationId]: messages.map((msg) => {
            if (msg.id !== messageId) return msg;
            
            // ✅ IMPORTANTE: Preservar campos críticos que não devem ser sobrescritos
            // Se a atualização não inclui um campo, preservar o existente
            return {
              ...msg,
              ...updates,
              // Preservar mediaUrl se não estiver na atualização ou for null/undefined (evitar perda de URL)
              mediaUrl: updates.mediaUrl !== undefined && updates.mediaUrl !== null 
                ? updates.mediaUrl 
                : msg.mediaUrl,
              // Preservar messageType se não estiver na atualização
              messageType: updates.messageType !== undefined 
                ? updates.messageType 
                : msg.messageType,
              // Preservar content se não estiver na atualização
              content: updates.content !== undefined 
                ? updates.content 
                : msg.content,
            };
          }),
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
  fetchConversations: async (force: boolean = false) => {
    const state = get();
    const currentConversations = state.conversations;
    const now = Date.now();
    const CACHE_DURATION_MS = 10000; // 10 segundos de cache
    const timeSinceLastFetch = now - state.lastFetchTime;
    
    // ✅ Se já está buscando, retornar a promise existente (evitar requisições duplicadas)
    if (state.isFetching && state.fetchPromise) {
      console.log('⏭️ fetchConversations: Já existe uma requisição em andamento, aguardando...');
      return state.fetchPromise;
    }
    
    // ✅ Se não for forçado e a última busca foi recente, não buscar novamente
    if (!force && timeSinceLastFetch < CACHE_DURATION_MS && currentConversations.length > 0) {
      console.log(`⏭️ fetchConversations: Cache ainda válido (${Math.round(timeSinceLastFetch/1000)}s atrás), usando dados locais`);
      return;
    }
    
    console.log(`🔄 fetchConversations: Carregando conversas... (atualmente: ${currentConversations.length} conversas, force: ${force})`);
    
    set({ isLoading: true, error: null, isFetching: true });
    
    // Criar promise para evitar requisições duplicadas
    const fetchPromise = (async () => {
      try {
        const response = await api.get('/conversations');
        const newConversations = response.data.data || [];
        
        console.log(`📥 fetchConversations: API retornou ${newConversations.length} conversas`);
        
        // ✅ Preservar conversas existentes se a API retornar vazio (evitar desaparecimento)
        if (newConversations.length === 0 && currentConversations.length > 0) {
          console.warn('⚠️ API retornou array vazio, mas temos conversas locais. Preservando conversas existentes para evitar desaparecimento.');
          set({ isLoading: false, isFetching: false, fetchPromise: null, lastFetchTime: now });
          return;
        }
        
        // ✅ Se API retornou menos conversas do que temos localmente, fazer merge inteligente
        // (preservar conversas locais que não estão na resposta da API)
        if (newConversations.length > 0 && currentConversations.length > newConversations.length) {
          console.warn(`⚠️ API retornou ${newConversations.length} conversas, mas temos ${currentConversations.length} localmente. Fazendo merge...`);
          
          // Criar mapa das novas conversas por ID
          const newConversationsMap = new Map(newConversations.map(c => [c.id, c]));
          
          // Preservar conversas locais que não estão na resposta da API
          const preservedConversations = currentConversations.filter(c => !newConversationsMap.has(c.id));
          
          // Combinar: novas conversas (atualizadas) + conversas preservadas (que não vieram da API)
          const mergedConversations = [...newConversations, ...preservedConversations];
          
          console.log(`✅ fetchConversations: Merge completo - ${newConversations.length} novas + ${preservedConversations.length} preservadas = ${mergedConversations.length} total`);
          set({ conversations: mergedConversations, isLoading: false, isFetching: false, fetchPromise: null, lastFetchTime: now });
          return;
        }
        
        // ✅ Se API retornou conversas, atualizar normalmente
        if (newConversations.length > 0) {
          console.log(`✅ fetchConversations: Atualizando com ${newConversations.length} conversas`);
          set({ conversations: newConversations, isLoading: false, isFetching: false, fetchPromise: null, lastFetchTime: now });
        } else {
          // Se API retornou vazio E não temos conversas locais, está tudo bem (primeira carga)
          console.log('ℹ️ fetchConversations: API retornou vazio e não há conversas locais (primeira carga)');
          set({ conversations: [], isLoading: false, isFetching: false, fetchPromise: null, lastFetchTime: now });
        }
      } catch (error: any) {
        console.error('❌ Erro ao carregar conversas:', error);
        // ✅ Em caso de erro, preservar conversas existentes ao invés de limpar
        if (currentConversations.length > 0) {
          console.warn(`⚠️ Erro ao buscar conversas, preservando ${currentConversations.length} conversas existentes`);
          set({ error: error.message || 'Erro ao carregar conversas', isLoading: false, isFetching: false, fetchPromise: null });
          return;
        }
        // Só limpar se não houver conversas existentes
        console.log('ℹ️ Erro ao buscar conversas e não há conversas locais, limpando estado');
        set({ error: error.message || 'Erro ao carregar conversas', isLoading: false, conversations: [], isFetching: false, fetchPromise: null });
      }
    })();
    
    // Armazenar promise para evitar requisições duplicadas
    set({ fetchPromise });
    
    return fetchPromise;
  },

  fetchMessages: async (conversationId: string, force: boolean = false) => {
    const state = get();
    const existingMessages = state.messages[conversationId] || [];
    const now = Date.now();
    const CACHE_DURATION_MS = 5000; // 5 segundos de cache para mensagens
    
    // ✅ Se já tem mensagens e não é forçado, verificar cache
    if (!force && existingMessages.length > 0) {
      // Verificar se há timestamp da última busca (poderia adicionar ao estado se necessário)
      // Por enquanto, se já tem mensagens e não é forçado, não buscar novamente
      // O WebSocket vai atualizar em tempo real
      console.log(`⏭️ fetchMessages: Já existem ${existingMessages.length} mensagens para ${conversationId}, usando cache (WebSocket atualiza em tempo real)`);
      return;
    }
    
    try {
      console.log(`🔄 fetchMessages: Carregando mensagens para conversa ${conversationId}...`);
      const response = await api.get(`/conversations/${conversationId}/messages`);
      const fetchedMessages = response.data.data || [];
      console.log(`📥 fetchMessages: API retornou ${fetchedMessages.length} mensagens para ${conversationId}`);
      get().setMessages(conversationId, fetchedMessages);
    } catch (error: any) {
      console.error(`❌ Erro ao carregar mensagens para ${conversationId}:`, error);
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
