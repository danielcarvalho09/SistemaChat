import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireAll?: boolean;
}

/**
 * Componente para proteger rotas baseado em roles
 */
export function ProtectedRoute({ children, allowedRoles = [], requireAll = false }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length === 0) {
    // Sem roles especificadas, apenas verificar autenticação
    return <>{children}</>;
  }

  const userRoles = user.roles?.map(role => role.name) || [];

  // Verificar se usuário tem pelo menos uma das roles permitidas
  const hasRequiredRole = requireAll
    ? allowedRoles.every(role => userRoles.includes(role))
    : allowedRoles.some(role => userRoles.includes(role));

  if (!hasRequiredRole) {
    // Redirecionar para dashboard se não tiver permissão
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

