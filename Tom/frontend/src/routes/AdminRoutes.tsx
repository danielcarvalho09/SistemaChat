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

export function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="departments" element={<Departments />} />
        <Route path="connections" element={<Connections />} />
        <Route path="tags" element={<TagManager />} />
        <Route path="broadcast" element={<Broadcast />} />
        <Route path="contact-lists" element={<ContactLists />} />
        <Route path="broadcast-settings" element={<BroadcastSettings />} />
        <Route path="ai-assistants" element={<AIAssistants />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
