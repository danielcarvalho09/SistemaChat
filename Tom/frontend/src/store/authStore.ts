import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import api from '../lib/axios';
import socketService from '../lib/socket';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user } = response.data.data;
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });

          // Conectar WebSocket
          socketService.connect();
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 'Erro ao fazer login';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          console.log('Enviando dados de registro:', { email, name, passwordLength: password.length });
          const response = await api.post('/auth/register', { email, password, name });
          const { user } = response.data.data;
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });

          // Conectar WebSocket
          socketService.connect();
        } catch (error: any) {
          console.error('Erro no registro:', error.response?.data);
          
          // Capturar erros de validação do Zod
          let errorMessage = 'Erro ao registrar';
          
          if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.response?.data?.errors) {
            // Se houver múltiplos erros de validação
            const errors = error.response.data.errors;
            if (Array.isArray(errors)) {
              errorMessage = errors.map((e: any) => e.message).join(', ');
            }
          }
          
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          console.error('Error during logout:', error);
        } finally {
          // Limpar estado e localStorage
          localStorage.removeItem('user');

          // Desconectar WebSocket
          socketService.disconnect();

          set({
            user: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      setUser: (user: User) => {
        set({ user });
      },

      clearError: () => {
        set({ error: null });
      },

      fetchMe: async () => {
        try {
          const response = await api.get('/auth/me');
          const user = response.data.data;
          set({ user, isAuthenticated: true });
        } catch (error: any) {
          console.error('Error fetching user:', error);
          // Apenas fazer logout se for erro de autenticação (401)
          if (error.response?.status === 401) {
            get().logout();
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
