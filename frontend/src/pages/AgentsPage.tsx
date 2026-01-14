import { useNavigate } from 'react-router-dom';
import { AgentList } from '@/components/AgentList';
import type { Agent } from '@/lib/api';

export function AgentsPage() {
  const navigate = useNavigate();

  const handleSelectAgent = (agent: Agent) => {
    // Navigate to agent detail page
    navigate(`/agents/${agent.id}`);
  };

  return (
    <AgentList onSelectAgent={handleSelectAgent} />
  );
}
