import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getCsrfToken = (): string | null => {
  const match = document.cookie.match(new RegExp('(^| )csrfToken=([^;]+)'));
  return match ? match[2] : null;
};

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
  timeout: 30000,
  validateStatus: (status) => status < 500,
});

api.interceptors.request.use(
  (config) => {
    // ✅ Adicionar token JWT se existir nos headers padrão do axios
    // Isso garante que o token seja enviado mesmo se não estiver no config específico
    if (api.defaults.headers.common['Authorization']) {
      config.headers['Authorization'] = api.defaults.headers.common['Authorization'];
    }

    const methodsRequiringCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (methodsRequiringCsrf.includes(config.method?.toUpperCase() || '')) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // ✅ CRÍTICO: Se for FormData, NÃO definir Content-Type
    // O navegador precisa definir automaticamente com o boundary correto
    if (config.data instanceof FormData) {
      // Remover qualquer Content-Type que possa ter sido definido
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
      console.log('[Axios] ✅ FormData detected - Content-Type removed, browser will set boundary automatically');
    } else if (config.data && typeof config.data === 'object' && !Array.isArray(config.data) && !(config.data instanceof FormData)) {
      // Apenas definir Content-Type para JSON se não for FormData
      if (!config.headers['Content-Type'] && !config.headers['content-type']) {
        config.headers['Content-Type'] = 'application/json';
      }
    }

    if (config.method?.toUpperCase() === 'GET') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    const newCsrfToken = response.headers['x-csrf-token'];
    if (newCsrfToken) {
      document.cookie = `csrfToken=${newCsrfToken}; path=/; SameSite=Strict${import.meta.env.PROD ? '; Secure' : ''}`;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await axios.post(
          `${API_URL}/api/v1/auth/refresh`,
          {},
          {
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          return api(originalRequest);
        }
      } catch (refreshError) {
        sessionStorage.clear();
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 403 && error.response?.data?.message?.includes('CSRF')) {
      window.location.reload();
      return Promise.reject(error);
    }

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      const event = new CustomEvent('rate-limit', { detail: { retryAfter } });
      window.dispatchEvent(event);
    }

    return Promise.reject(error);
  },
);

export const secureRequest = {
  get: async <T = unknown>(url: string, config?: AxiosRequestConfig) => {
    const response = await api.get<T>(url, {
      ...config,
      headers: {
        ...config?.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
    return response.data;
  },
  post: async <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      throw new Error('CSRF token not available. Please refresh the page.');
    }
    const response = await api.post<T>(url, data, config);
    return response.data;
  },
  put: async <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      throw new Error('CSRF token not available. Please refresh the page.');
    }
    const response = await api.put<T>(url, data, config);
    return response.data;
  },
  delete: async <T = unknown>(url: string, config?: AxiosRequestConfig) => {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      throw new Error('CSRF token not available. Please refresh the page.');
    }
    const response = await api.delete<T>(url, config);
    return response.data;
  },
};

export default api;
