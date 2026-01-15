/**
 * Agent list component - M9.8.15 redesigned with card grid layout
 */

import { useAgents } from '../hooks/useAgents';
import type { Agent } from '../lib/api';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Plus, Laptop, AlertCircle, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AgentListProps {
  onSelectAgent: (agent: Agent) => void;
}

function getMetricColor(value: number, thresholds: [number, number] = [70, 85]): string {
  if (value < thresholds[0]) return '#3DDC97'; // success green
  if (value < thresholds[1]) return '#FFC952'; // warning yellow
  return '#F75555'; // danger red
}

function ResourceMeter({
  icon: Icon,
  label,
  value,
  thresholds = [70, 85]
}: {
  icon: React.ElementType;
  label: string;
  value: number | null | undefined;
  thresholds?: [number, number];
}) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium w-8">{label}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full" />
        <span className="text-xs tabular-nums w-10 text-right">N/A</span>
      </div>
    );
  }

  const color = getMetricColor(value, thresholds);
  const clampedValue = Math.min(value, 100);

  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-medium w-8 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${clampedValue}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span
        className="text-xs font-semibold tabular-nums w-10 text-right"
        style={{ color }}
      >
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

export function AgentList({ onSelectAgent }: AgentListProps) {
  const { data, isLoading, error } = useAgents();

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Breadcrumb items={[{ label: 'Agents' }]} />

        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-[150px] mb-2" />
            <Skeleton className="h-5 w-[300px]" />
          </div>
          <Skeleton className="h-10 w-[120px]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-[150px] mb-4" />
              <Skeleton className="h-4 w-[100px] mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 space-y-6">
        <Breadcrumb items={[{ label: 'Agents' }]} />

        <div className="flex items-center gap-4 p-6 bg-destructive/10 border border-destructive rounded-lg">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <div>
            <h3 className="font-semibold text-destructive">Error loading agents</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalAgents = data?.count ?? 0;
  const onlineAgents = data?.agents.filter(a => a.status === 'online').length ?? 0;

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Agents' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground mt-2">
            Manage your connected infrastructure agents
          </p>
        </div>
        <Button disabled title="Coming soon - Install agent via command line">
          <Plus className="h-4 w-4 mr-2" />
          Add Agent
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="font-semibold">Total:</span> {totalAgents} {totalAgents === 1 ? 'agent' : 'agents'}
        </div>
        <div>
          <span className={onlineAgents > 0 ? 'text-success font-semibold' : 'text-muted-foreground'}>
            {onlineAgents} online
          </span>
        </div>
        <div className="text-muted-foreground">
          {totalAgents - onlineAgents} offline
        </div>
      </div>

      {/* Agent Cards Grid */}
      {totalAgents === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Laptop className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">No agents registered yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Get started by installing the ZedOps agent on your game server host.
                The agent will automatically connect and appear here.
              </p>
            </div>
            <div className="pt-4">
              <Button variant="outline" disabled>
                View Installation Guide
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.agents.map((agent) => {
            const isOnline = agent.status === 'online';
            const metrics = agent.metadata?.metrics;
            const lastSeen = formatDistanceToNow(new Date(agent.lastSeen * 1000), { addSuffix: true });

            return (
              <Card
                key={agent.id}
                className={`transition-all duration-200 cursor-pointer hover:shadow-lg hover:scale-[1.02] ${
                  isOnline
                    ? 'border-l-4 border-l-success'
                    : 'opacity-75 border-l-4 border-l-destructive'
                }`}
                onClick={() => onSelectAgent(agent)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{agent.name}</h3>
                    </div>
                    <StatusBadge
                      variant={isOnline ? 'success' : 'muted'}
                      icon={isOnline ? 'pulse' : 'cross'}
                    >
                      {isOnline ? 'Online' : 'Offline'}
                    </StatusBadge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Metrics for online agents */}
                  {isOnline && metrics ? (
                    <div className="space-y-2">
                      <ResourceMeter
                        icon={Cpu}
                        label="CPU"
                        value={metrics.cpuPercent}
                      />
                      <ResourceMeter
                        icon={MemoryStick}
                        label="MEM"
                        value={(metrics.memoryUsedMB / metrics.memoryTotalMB) * 100}
                      />
                      <ResourceMeter
                        icon={HardDrive}
                        label="DISK"
                        value={metrics.diskPercent}
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4">
                      {isOnline ? 'Collecting metrics...' : 'Agent offline - No metrics available'}
                    </div>
                  )}

                  {/* Last Seen */}
                  <div className="pt-3 border-t">
                    <div className="text-xs text-muted-foreground">
                      Last seen: {lastSeen}
                    </div>
                  </div>

                  {/* Click hint */}
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    {isOnline ? 'Click to view details →' : 'Click to view cached logs →'}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
