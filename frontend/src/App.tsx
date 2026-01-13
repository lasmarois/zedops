/**
 * Main ZedOps application
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ComponentShowcase } from './components/ComponentShowcase';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { AgentsPage } from './pages/AgentsPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

const queryClient = new QueryClient();

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
        <Route path="servers" element={<div className="p-8">Servers Page (Phase 3)</div>} />
        <Route path="users" element={<UsersPage />} />
        <Route path="permissions" element={<div className="p-8">Permissions Page (Phase 3)</div>} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
