import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Send, ListChecks, Clock, ChevronLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/button';
import { useState } from 'react';

export function GerenteLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // ✅ Menu específico para gerente (apenas as opções permitidas)
  const navigation = [
    { name: 'Dashboard', href: '/gerente', icon: LayoutDashboard },
    { name: 'Disparo de Mensagens', href: '/gerente/broadcast', icon: Send },
    { name: 'Listas de Contatos', href: '/gerente/contact-lists', icon: ListChecks },
    { name: 'Configurar Intervalos', href: '/gerente/broadcast-settings', icon: Clock },
  ];

  const isActive = (href: string) => {
    if (href === '/gerente') {
      return location.pathname === '/gerente';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div 
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        {/* Botão Voltar para Dashboard */}
        <div className="h-16 flex items-center px-3 border-b border-gray-200">
          <Button 
            variant="link" 
            onClick={() => navigate('/dashboard')}
            className="w-full justify-start text-gray-700 hover:text-gray-900 px-3"
            title={isCollapsed ? 'Voltar' : ''}
          >
            <ChevronLeft className={`${isCollapsed ? '' : 'me-1'} opacity-60`} size={16} strokeWidth={2} aria-hidden="true" />
            {!isCollapsed && <span>Voltar</span>}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'text-gray-900 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={isCollapsed ? item.name : ''}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {user?.name}
                  </div>
                  <div className="text-xs text-gray-600 truncate">{user?.email}</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-semibold mx-auto">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                onClick={logout}
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

