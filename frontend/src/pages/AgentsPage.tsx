import { useNavigate } from 'react-router-dom';
import { AgentList } from '@/components/AgentList';
import type { Agent } from '@/lib/api';

export function AgentsPage() {
  const navigate = useNavigate();

  const handleSelectAgent = (agent: Agent) => {
    // Navigate to agent detail page (new M9 design)
    navigate(`/agents/${agent.id}`);
  };

  const handleViewUsers = () => {
    navigate('/users');
  };

  const handleViewAuditLogs = () => {
    navigate('/audit-logs');
  };

  return (
    <AgentList
      onSelectAgent={handleSelectAgent}
      onViewUsers={handleViewUsers}
      onViewAuditLogs={handleViewAuditLogs}
    />
  );
}
