/**
 * Main ZedOps application
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { Login } from './components/Login';
import { AgentList } from './components/AgentList';
import { ContainerList } from './components/ContainerList';
import type { Agent } from './lib/api';

const queryClient = new QueryClient();

function App() {
  const password = useAuthStore((state) => state.password);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {!password ? (
        <Login />
      ) : selectedAgent ? (
        <ContainerList
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
          onBack={handleBackToAgents}
        />
      ) : (
        <AgentList onSelectAgent={handleSelectAgent} />
      )}
    </QueryClientProvider>
  );
}

export default App;
