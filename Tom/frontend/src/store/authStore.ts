import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '../types';
import api from '../lib/axios';
import socketService from '../lib/socket';

const DEFAULT_USER_NAME = import.meta.env.VITE_APP_USER_NAME || 'Usuário';

const buildUser = (email: string, name?: string): User => {
  // ✅ Usar nome do email se não tiver nome, não usar "Administrador" como padrão
  const derivedName = name?.trim() || email.split('@')[0] || DEFAULT_USER_NAME || 'Usuário';
  const timestamp = new Date().toISOString();
  return {
    id: `user-${email}`,
    email,
    name: derivedName,
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
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const applyUserHeaders = (user: User | null, token: string | null = null) => {
  if (user && token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.common['X-User-Email'] = user.email;
    if (user.name) {
      api.defaults.headers.common['X-User-Name'] = user.name;
    } else {
      delete api.defaults.headers.common['X-User-Name'];
    }
  } else {
    delete api.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['X-User-Email'];
    delete api.defaults.headers.common['X-User-Name'];
  }
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

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
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, _password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password: _password });
          // ✅ Processar resposta do backend com roles reais
          if (response.data?.data?.user && response.data?.data?.tokens?.accessToken) {
            const backendUser = response.data.data.user;
            const accessToken = response.data.data.tokens.accessToken;

            const user: User = {
              id: backendUser.id,
              email: backendUser.email,
              name: backendUser.name,
              avatar: backendUser.avatar,
              status: backendUser.status || 'online',
              isActive: backendUser.isActive ?? true,
              roles: backendUser.roles || [],
              createdAt: backendUser.createdAt || new Date().toISOString(),
              updatedAt: backendUser.updatedAt || new Date().toISOString(),
            };

            applyUserHeaders(user, accessToken);
            set({
              user,
              token: accessToken,
              isAuthenticated: true,
              isLoading: false,
            });
            socketService.connect();
            return;
          }
        } catch (error) {
          /* ignora erros - auth desativada */
        }
        // Fallback: usar buildUser apenas se backend não retornar dados
        const user = buildUser(email);
        applyUserHeaders(user, null); // No token in fallback
        set({
          user,
          token: null,
          isAuthenticated: true,
          isLoading: false,
        });
        socketService.connect();
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', { email, password, name });
          // ✅ Processar resposta do backend com roles reais
          if (response.data?.data?.user) {
            const backendUser = response.data.data.user;
            const user: User = {
              id: backendUser.id,
              email: backendUser.email,
              name: backendUser.name,
              avatar: backendUser.avatar,
              status: backendUser.status || 'online',
              isActive: backendUser.isActive ?? true,
              roles: backendUser.roles || [],
              createdAt: backendUser.createdAt || new Date().toISOString(),
              updatedAt: backendUser.updatedAt || new Date().toISOString(),
            };
            applyUserHeaders(user);
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
            socketService.connect();
            return;
          }
        } catch (error) {
          /* ignora erros - auth desativada */
        }
        // Fallback: usar buildUser apenas se backend não retornar dados
        const user = buildUser(email, name);
        applyUserHeaders(user);
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        socketService.connect();
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          /* ignora erros */
        } finally {
          socketService.disconnect();
          applyUserHeaders(null);
          set({
            user: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      setUser: (user: User) => {
        applyUserHeaders(user);
        set({ user, isAuthenticated: true });
      },

      clearError: () => {
        set({ error: null });
      },

      fetchMe: async () => {
        try {
          const response = await api.get('/auth/me');
          // ✅ Processar resposta do backend com roles reais
          if (response.data?.data) {
            const backendUser = response.data.data;
            const user: User = {
              id: backendUser.id,
              email: backendUser.email,
              name: backendUser.name,
              avatar: backendUser.avatar,
              status: backendUser.status || 'online',
              isActive: backendUser.isActive ?? true,
              roles: backendUser.roles || [],
              createdAt: backendUser.createdAt || new Date().toISOString(),
              updatedAt: backendUser.updatedAt || new Date().toISOString(),
            };
            applyUserHeaders(user);
            set({
              user,
              isAuthenticated: true,
            });
            return;
          }
        } catch (error) {
          /* ignora 401 */
        }
        // Se não conseguir buscar, manter usuário atual ou limpar
        const currentUser = get().user;
        if (currentUser) {
          applyUserHeaders(currentUser);
          set({
            isAuthenticated: true,
          });
        } else {
          applyUserHeaders(null);
          set({
            isAuthenticated: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error && state?.user && state?.token) {
          applyUserHeaders(state.user, state.token);
        } else {
          applyUserHeaders(null, null);
        }
      },
    }
  )
);
