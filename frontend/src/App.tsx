/**
 * Main ZedOps application
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import { ServerCardLayoutProvider } from './contexts/ServerCardLayoutContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ComponentShowcase } from './components/ComponentShowcase';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { AgentsPage } from './pages/AgentsPage';
import { AgentDetail } from './pages/AgentDetail';
import { ServerList } from './pages/ServerList';
import { ServerDetail } from './pages/ServerDetail';
import { UsersPage } from './pages/UsersPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AppContent() {
  const { isAuthenticated } = useUser();

  // Check if we're viewing the component showcase (for M9 Phase 1 testing)
  const params = new URLSearchParams(window.location.search);
  if (params.get('showcase') === 'true') {
    return <ComponentShowcase />;
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/:id" element={<AgentDetail />} />
        <Route path="servers" element={<ServerList />} />
        <Route path="servers/:id" element={<ServerDetail />} />
        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserProvider>
          <ServerCardLayoutProvider>
            <AppContent />
          </ServerCardLayoutProvider>
        </UserProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
