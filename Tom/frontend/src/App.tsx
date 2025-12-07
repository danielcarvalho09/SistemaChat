import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Dashboard } from './pages/Dashboard';
import { DashboardLayout } from './pages/dashboard/DashboardLayout';
import { Kanban } from './pages/dashboard/Kanban';
import { Agenda } from './pages/dashboard/Agenda';
import { QuickMessages } from './pages/dashboard/QuickMessages';
import { AdminRoutes } from './routes/AdminRoutes';
import { GerenteRoutes } from './routes/GerenteRoutes';
import { Toaster } from './components/ui/toaster';
import { ConnectionStatus } from './components/ConnectionStatus';
import { WebSocketProvider } from './contexts/WebSocketContext';

function App() {
  const { isAuthenticated, fetchMe, logout } = useAuthStore();
  const hasCheckedAuth = useRef(false);

  // Verificar autenticação ao carregar (apenas uma vez)
  useEffect(() => {
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;

    const token = localStorage.getItem('accessToken');
    
    // Se tem token, validar
    if (token) {
      fetchMe();
    } else if (isAuthenticated) {
      // Se não tem token mas está marcado como autenticado, fazer logout
      logout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez ao montar

  return (
    <WebSocketProvider>
      <Routes>
        {/* Rotas públicas */}
        <Route
          path="/login"
          element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/register"
          element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/dashboard" />}
        />

        {/* Rotas protegidas - Dashboard do Atendente */}
        <Route
          path="/dashboard"
          element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" />}
        >
          <Route index element={<Dashboard />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="quick-messages" element={<QuickMessages />} />
        </Route>
        
        {/* Rotas Admin */}
        <Route
          path="/admin/*"
          element={isAuthenticated ? <AdminRoutes /> : <Navigate to="/login" />}
        />

        {/* Rotas Gerente */}
        <Route
          path="/gerente/*"
          element={isAuthenticated ? <GerenteRoutes /> : <Navigate to="/login" />}
        />

        {/* Redirect padrão */}
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <Toaster />
      {isAuthenticated && <ConnectionStatus />}
    </WebSocketProvider>
  );
}

export default App;
