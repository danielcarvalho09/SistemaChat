import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '../pages/admin/AdminLayout';
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { Users } from '../pages/admin/Users';
import { Departments } from '../pages/admin/Departments';
import { Connections } from '../pages/admin/Connections';
import { TagManager } from '../components/tags/TagManager';
import { Broadcast } from '../pages/admin/Broadcast';
import { ContactLists } from '../pages/admin/ContactLists';
import { BroadcastSettings } from '../pages/admin/BroadcastSettings';
import { AIAssistants } from '../pages/AIAssistants';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

export function AdminRoutes() {
  return (
    <Routes>
      <Route element={
        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        {/* Dashboard - acessível para admin e gerente */}
        <Route index element={
          <ProtectedRoute allowedRoles={['admin', 'gerente']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        
        {/* Rotas apenas para admin */}
        <Route path="users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Users />
          </ProtectedRoute>
        } />
        <Route path="departments" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Departments />
          </ProtectedRoute>
        } />
        <Route path="connections" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Connections />
          </ProtectedRoute>
        } />
        <Route path="tags" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <TagManager />
          </ProtectedRoute>
        } />
        <Route path="ai-assistants" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AIAssistants />
          </ProtectedRoute>
        } />
        
        {/* Rotas para admin e gerente */}
        <Route path="broadcast" element={
          <ProtectedRoute allowedRoles={['admin', 'gerente']}>
            <Broadcast />
          </ProtectedRoute>
        } />
        <Route path="contact-lists" element={
          <ProtectedRoute allowedRoles={['admin', 'gerente']}>
            <ContactLists />
          </ProtectedRoute>
        } />
        <Route path="broadcast-settings" element={
          <ProtectedRoute allowedRoles={['admin', 'gerente']}>
            <BroadcastSettings />
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
