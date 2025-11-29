import { Routes, Route, Navigate } from 'react-router-dom';
import { GerenteLayout } from '../pages/gerente/GerenteLayout';
import { GerenteDashboard } from '../pages/gerente/GerenteDashboard';
import { Broadcast } from '../pages/admin/Broadcast';
import { ContactLists } from '../pages/admin/ContactLists';
import { BroadcastSettings } from '../pages/admin/BroadcastSettings';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

export function GerenteRoutes() {
  return (
    <Routes>
      <Route element={
        <ProtectedRoute allowedRoles={['gerente']}>
          <GerenteLayout />
        </ProtectedRoute>
      }>
        {/* Dashboard - acessível para gerente */}
        <Route index element={
          <ProtectedRoute allowedRoles={['gerente']}>
            <GerenteDashboard />
          </ProtectedRoute>
        } />
        
        {/* Rotas para gerente */}
        <Route path="broadcast" element={
          <ProtectedRoute allowedRoles={['gerente']}>
            <Broadcast />
          </ProtectedRoute>
        } />
        <Route path="contact-lists" element={
          <ProtectedRoute allowedRoles={['gerente']}>
            <ContactLists />
          </ProtectedRoute>
        } />
        <Route path="broadcast-settings" element={
          <ProtectedRoute allowedRoles={['gerente']}>
            <BroadcastSettings />
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<Navigate to="/gerente" replace />} />
      </Route>
    </Routes>
  );
}

