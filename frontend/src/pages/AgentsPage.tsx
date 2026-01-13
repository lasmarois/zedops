import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentList } from '@/components/AgentList';
import { ContainerList } from '@/components/ContainerList';
import { LogViewer } from '@/components/LogViewer';
import type { Agent } from '@/lib/api';

interface SelectedContainer {
  id: string;
  name: string;
}

export function AgentsPage() {
  const navigate = useNavigate();
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

  const handleViewUsers = () => {
    navigate('/users');
  };

  const handleViewAuditLogs = () => {
    navigate('/audit-logs');
  };

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
