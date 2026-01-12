/**
 * Main ZedOps application
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { Login } from './components/Login';
import { AgentList } from './components/AgentList';
import { ContainerList } from './components/ContainerList';
import { LogViewer } from './components/LogViewer';
import type { Agent } from './lib/api';

const queryClient = new QueryClient();

interface SelectedContainer {
  id: string;
  name: string;
}

function App() {
  const password = useAuthStore((state) => state.password);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<SelectedContainer | null>(null);

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

  return (
    <QueryClientProvider client={queryClient}>
      {!password ? (
        <Login />
      ) : selectedAgent && selectedContainer ? (
        <LogViewer
          agentId={selectedAgent.id}
          containerId={selectedContainer.id}
          containerName={selectedContainer.name}
          password={password}
          onBack={handleBackToContainers}
        />
      ) : selectedAgent ? (
        <ContainerList
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
          password={password}
          onBack={handleBackToAgents}
          onViewLogs={handleViewLogs}
        />
      ) : (
        <AgentList onSelectAgent={handleSelectAgent} />
      )}
    </QueryClientProvider>
  );
}

export default App;
