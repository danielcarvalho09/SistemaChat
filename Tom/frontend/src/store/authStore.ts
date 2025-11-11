import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import api from '../lib/axios';
import socketService from '../lib/socket';

const DEFAULT_USER_NAME = import.meta.env.VITE_APP_USER_NAME || 'Administrador';
const DEFAULT_USER_EMAIL = import.meta.env.VITE_APP_USER_EMAIL || 'admin@empresa.com';

const DEFAULT_USER: User = {
  id: 'public-user',
  email: DEFAULT_USER_EMAIL,
  name: DEFAULT_USER_NAME,
  avatar: null,
  status: 'online',
  isActive: true,
  roles: [
    {
      id: 'role-public',
      name: 'admin',
      description: null,
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

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
      user: DEFAULT_USER,
      isAuthenticated: true,
      isLoading: false,
      error: null,

      login: async (email: string, _password: string) => {
        set({ isLoading: true, error: null });
        try {
          // Opcionalmente ainda chamamos o endpoint para manter compatibilidade
          await api.post('/auth/login', { email, password: _password });
        } catch (error) {
          // Ignorar erros (autenticação desativada)
        } finally {
          const user = {
            ...DEFAULT_USER,
            email,
          };
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          socketService.connect();
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.post('/auth/register', { email, password, name });
        } catch (error) {
          // Ignorar erros de registro (autenticação desativada)
        } finally {
          const user = {
            ...DEFAULT_USER,
            email,
            name,
          };
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          socketService.connect();
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          // Ignorar erros
        } finally {
          localStorage.removeItem('user');
          socketService.disconnect();
          set({
            user: null,
            isAuthenticated: true,
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
          await api.get('/auth/me');
        } catch (error) {
          // Ignorar 401 - continuamos usando o usuário padrão
        } finally {
          set((state) => ({
            user: state.user ?? DEFAULT_USER,
            isAuthenticated: true,
          }));
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
