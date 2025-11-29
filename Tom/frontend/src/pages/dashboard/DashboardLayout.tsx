import { Outlet } from 'react-router-dom';
import { MessageSquare, Columns3, CalendarDays, LogOut, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Sidebar, SidebarBody, SidebarLink } from '../../components/ui/sidebar';
import { useState } from 'react';
import { cn } from '../../lib/utils';

export function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  
  // ✅ Verificar roles do usuário
  const isAdmin = user?.roles?.some(role => role.name === 'admin') || false;
  const isGerente = user?.roles?.some(role => role.name === 'gerente') || false;

  const links = [
    {
      label: 'Conversas',
      href: '/dashboard',
      icon: <MessageSquare className="text-gray-700 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: 'Kanban',
      href: '/dashboard/kanban',
      icon: <Columns3 className="text-gray-700 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: 'Agenda',
      href: '/dashboard/agenda',
      icon: <CalendarDays className="text-gray-700 h-5 w-5 flex-shrink-0" />,
    },
  ];

  return (
    <div className={cn("flex flex-col md:flex-row bg-white w-full flex-1 overflow-hidden h-screen")}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {/* Logo */}
            {open ? <Logo /> : <LogoIcon />}
            
            {/* Navigation Links */}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>

          {/* User Info */}
          <div className="border-t border-gray-200 pt-4">
            {open && (
              <div className="mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {user?.name}
                    </div>
                    <div className="text-xs text-gray-600 truncate">{user?.email}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isAdmin && (
                <SidebarLink
                  link={{
                    label: 'Admin',
                    href: '/admin',
                    icon: <Settings className="text-gray-700 h-5 w-5 flex-shrink-0" />,
                  }}
                />
              )}
              {isGerente && (
                <SidebarLink
                  link={{
                    label: 'Gerente',
                    href: '/gerente',
                    icon: <Settings className="text-gray-700 h-5 w-5 flex-shrink-0" />,
                  }}
                />
              )}
              <button
                onClick={logout}
                className="flex items-center justify-center gap-2 group/sidebar py-2 px-2 rounded-lg hover:bg-gray-100 transition-all duration-200 flex-1"
                title="Sair"
              >
                <LogOut className="text-gray-700 h-5 w-5 flex-shrink-0" />
                {open && (
                  <span className="text-gray-900 text-sm">
                    Sair
                  </span>
                )}
              </button>
            </div>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

// Logo Component
const Logo = () => {
  return (
    <div className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20">
      <div className="flex flex-col">
        <span className="font-bold text-gray-900">AutoChat</span>
        <span className="text-xs text-gray-600">Sistema</span>
      </div>
    </div>
  );
};

// Logo Icon (collapsed state)
const LogoIcon = () => {
  return (
    <div className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20">
      <span className="font-bold text-gray-900 text-xs">AC</span>
    </div>
  );
};
