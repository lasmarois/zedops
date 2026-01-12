/**
 * Main ZedOps application
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProvider, useUser } from './contexts/UserContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { AgentList } from './components/AgentList';
import { ContainerList } from './components/ContainerList';
import { LogViewer } from './components/LogViewer';
import { UserList } from './components/UserList';
import { PermissionsManager } from './components/PermissionsManager';
import { AuditLogViewer } from './components/AuditLogViewer';
import type { Agent, UserAccount } from './lib/api';

const queryClient = new QueryClient();

interface SelectedContainer {
  id: string;
  name: string;
}

type View = 'agents' | 'users' | 'permissions' | 'audit';

function AppContent() {
  const { isAuthenticated } = useUser();
  const [currentView, setCurrentView] = useState<View>('agents');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<SelectedContainer | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setSelectedContainer(null);
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
    setSelectedContainer(null);
  };

  const handleViewLogs = (containerId: string, containerName: string) => {
    setSelectedContainer({ id: containerId, name: containerName });
  };

  const handleBackToContainers = () => {
    setSelectedContainer(null);
  };

  const handleViewUsers = () => {
    setCurrentView('users');
    setSelectedAgent(null);
    setSelectedContainer(null);
  };

  const handleViewAuditLogs = () => {
    setCurrentView('audit');
    setSelectedAgent(null);
    setSelectedContainer(null);
  };

  const handleManagePermissions = (user: UserAccount) => {
    setSelectedUser(user);
    setCurrentView('permissions');
  };

  const handleBackToUsers = () => {
    setCurrentView('users');
    setSelectedUser(null);
  };

  const handleBackToMain = () => {
    setCurrentView('agents');
    setSelectedUser(null);
  };

  // Check if we're on the registration page
  if (window.location.pathname === '/register') {
    return <Register />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Audit Log View
  if (currentView === 'audit') {
    return <AuditLogViewer onBack={handleBackToMain} />;
  }

  // User Management Views
  if (currentView === 'permissions' && selectedUser) {
    return <PermissionsManager user={selectedUser} onBack={handleBackToUsers} />;
  }

  if (currentView === 'users') {
    return <UserList onBack={handleBackToMain} onManagePermissions={handleManagePermissions} />;
  }

  // Agent/Container Views
  if (selectedAgent && selectedContainer) {
    return (
      <LogViewer
        agentId={selectedAgent.id}
        containerId={selectedContainer.id}
        containerName={selectedContainer.name}
        onBack={handleBackToContainers}
      />
    );
  }

  if (selectedAgent) {
    return (
      <ContainerList
        agentId={selectedAgent.id}
        agentName={selectedAgent.name}
        onBack={handleBackToAgents}
        onViewLogs={handleViewLogs}
      />
    );
  }

  return (
    <AgentList
      onSelectAgent={handleSelectAgent}
      onViewUsers={handleViewUsers}
      onViewAuditLogs={handleViewAuditLogs}
    />
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
