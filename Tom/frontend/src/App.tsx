import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Dashboard } from './pages/Dashboard';
import { DashboardLayout } from './pages/dashboard/DashboardLayout';
import { Kanban } from './pages/dashboard/Kanban';
import { Agenda } from './pages/dashboard/Agenda';
import { AdminRoutes } from './routes/AdminRoutes';
import { Toaster } from './components/ui/toaster';
import { ConnectionStatus } from './components/ConnectionStatus';
import { WebSocketProvider } from './contexts/WebSocketContext';

function App() {
  const { isAuthenticated, fetchMe } = useAuthStore();
  const hasCheckedAuth = useRef(false);

  // Verificar autenticação ao carregar (apenas uma vez)
  useEffect(() => {
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;

    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        </Route>
        
        {/* Rotas Admin */}
        <Route
          path="/admin/*"
          element={isAuthenticated ? <AdminRoutes /> : <Navigate to="/login" />}
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
