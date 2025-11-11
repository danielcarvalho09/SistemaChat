import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import socketService from '@/lib/socket';

// Placeholder components - serão implementados depois
const ConversationsView = () => <div className="p-8">Conversas (Em desenvolvimento)</div>;
const AnalyticsView = () => <div className="p-8">Analytics (Em desenvolvimento)</div>;
const SettingsView = () => <div className="p-8">Configurações (Em desenvolvimento)</div>;

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    // Conectar WebSocket quando entrar no dashboard
    if (isAuthenticated) {
      socketService.connect();
    }

    return () => {
      // Desconectar ao sair
      socketService.disconnect();
    };
  }, [isAuthenticated]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg">
        <div className="p-4">
          <h1 className="text-xl font-bold text-whatsapp-green">WhatsApp System</h1>
          <p className="text-sm text-gray-600">{user?.name}</p>
        </div>
        <nav className="mt-4">
          <a href="/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
            Conversas
          </a>
          <a href="/dashboard/analytics" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
            Analytics
          </a>
          <a href="/dashboard/settings" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
            Configurações
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<ConversationsView />} />
          <Route path="/analytics" element={<AnalyticsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>
    </div>
  );
}
