/**
 * Agent list component
 */

import { useAgents } from '../hooks/useAgents';
import { useUser } from '../contexts/UserContext';
import type { Agent } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AgentListProps {
  onSelectAgent: (agent: Agent) => void;
  onViewUsers: () => void;
  onViewAuditLogs: () => void;
}

function getMetricVariant(value: number, thresholds: [number, number]): 'success' | 'warning' | 'destructive' {
  if (value < thresholds[0]) return 'success';
  if (value < thresholds[1]) return 'warning';
  return 'destructive';
}

function MetricBadge({ label, value, unit = '%', thresholds = [70, 85] }: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  thresholds?: [number, number];
}) {
  if (value === null || value === undefined) {
    return (
      <Badge variant="secondary">
        {label}: N/A
      </Badge>
    );
  }

  const variant = getMetricVariant(value, thresholds);
  return (
    <Badge variant={variant}>
      {label}: {value.toFixed(1)}{unit}
    </Badge>
  );
}

export function AgentList({ onSelectAgent, onViewUsers, onViewAuditLogs }: AgentListProps) {
  const { data, isLoading, error } = useAgents();
  const { user, logout } = useUser();

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Skeleton className="h-9 w-[200px] mb-2" />
            <Skeleton className="h-5 w-[250px]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[120px]" />
            <Skeleton className="h-10 w-[100px]" />
            <Skeleton className="h-10 w-[80px]" />
          </div>
        </div>
        <Skeleton className="h-5 w-[150px] mb-4" />
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-[70px]" />
                      <Skeleton className="h-6 w-[70px]" />
                      <Skeleton className="h-6 w-[70px]" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive mb-4">
          Error: {error.message}
        </p>
        <Button variant="destructive" onClick={handleLogout}>
          Re-login
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">ZedOps Agents</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Logged in as: {user?.email} ({user?.role})
          </p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <>
              <Button onClick={onViewUsers}>
                Manage Users
              </Button>
              <Button variant="info" onClick={onViewAuditLogs}>
                Audit Logs
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <strong>Total Agents:</strong> {data?.count ?? 0}
      </div>

      {data?.agents.length === 0 ? (
        <div className="p-8 text-center bg-muted rounded-md">
          No agents registered yet
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.agents.map((agent) => (
                <TableRow
                  key={agent.id}
                  onClick={() => agent.status === 'online' && onSelectAgent(agent)}
                  className={agent.status === 'online' ? 'cursor-pointer hover:bg-muted' : 'cursor-default'}
                >
                  <TableCell>
                    {agent.name}
                    {agent.status === 'online' && (
                      <span className="ml-2 text-muted-foreground text-sm">
                        →
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={agent.status === 'online' ? 'success' : 'secondary'}>
                      {agent.status === 'online' ? '● Online' : '○ Offline'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {agent.status === 'online' && agent.metadata?.metrics ? (
                      <div className="flex gap-2 flex-wrap">
                        <MetricBadge
                          label="CPU"
                          value={agent.metadata.metrics.cpuPercent}
                        />
                        <MetricBadge
                          label="MEM"
                          value={(agent.metadata.metrics.memoryUsedMB / agent.metadata.metrics.memoryTotalMB) * 100}
                        />
                        <MetricBadge
                          label="DSK"
                          value={agent.metadata.metrics.diskPercent}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {agent.status === 'offline' ? 'Offline' : 'Collecting...'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(agent.lastSeen * 1000).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(agent.createdAt * 1000).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
