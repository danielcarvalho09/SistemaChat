import { LogOut, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/button';

export function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // ✅ Verificar se o usuário é admin ou gerente
  const isAdmin = user?.roles?.some(role => role.name === 'admin') || false;
  const isGerente = user?.roles?.some(role => role.name === 'gerente') || false;
  const hasAdminAccess = isAdmin || isGerente;

  return (
    <header className="bg-[#008069] text-white px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold">WhatsApp Multi-Tenant</h1>
          <p className="text-xs text-green-100">Sistema de Atendimento</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div className="text-sm">
            <div className="font-medium">{user?.name}</div>
            <div className="text-xs text-green-100">{user?.email}</div>
          </div>
        </div>

        {hasAdminAccess && (
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            onClick={() => navigate('/admin')}
            title={isAdmin ? "Painel de Administração" : "Painel de Gerente"}
          >
            <Settings className="w-5 h-5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          onClick={logout}
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
