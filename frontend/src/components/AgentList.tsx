/**
 * Agent list component - M9.8.15 redesigned with card grid layout
 */

import { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { deletePendingAgent } from '../lib/api';
import type { Agent } from '../lib/api';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Plus, Laptop, AlertCircle, Cpu, HardDrive, MemoryStick, ShieldAlert, X } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { InstallAgentDialog } from './InstallAgentDialog';

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
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleDeletePending = async (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation();
    setDeletingAgentId(agentId);
    try {
      await deletePendingAgent(agentId);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch {
      // Error is silently handled — card will remain if deletion fails
    } finally {
      setDeletingAgentId(null);
    }
  };

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
  const pendingAgents = data?.agents.filter(a => a.status === 'pending').length ?? 0;

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
        {isAdmin && (
          <Button variant="glass-primary" onClick={() => setShowInstallDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        )}
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
        {pendingAgents > 0 && (
          <div>
            <span className="text-amber-400/70">
              {pendingAgents} pending
            </span>
          </div>
        )}
        <div className="text-muted-foreground">
          {totalAgents - onlineAgents - pendingAgents} offline
        </div>
      </div>

      {/* Agent Cards Grid */}
      {totalAgents === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              {isAdmin ? (
                <Laptop className="h-8 w-8 text-muted-foreground" />
              ) : (
                <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div>
              {isAdmin ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">No agents registered yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Get started by installing the ZedOps agent on your game server host.
                    The agent will automatically connect and appear here.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">No agents assigned</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    You don't have access to any agents yet. Contact your administrator to get access.
                  </p>
                </>
              )}
            </div>
            {isAdmin && (
              <div className="pt-4">
                <Button variant="outline" disabled>
                  View Installation Guide
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.agents.map((agent) => {
            const isOnline = agent.status === 'online';
            const isPending = agent.status === 'pending';
            const metrics = agent.metadata?.metrics;
            const lastSeen = agent.lastSeen
              ? formatDistanceToNow(new Date(agent.lastSeen * 1000), { addSuffix: true })
              : 'Never';

            // Determine badge variant and icon based on status
            const getBadgeProps = () => {
              if (isPending) return { variant: 'pending' as const, icon: 'loader' as const, label: 'Awaiting Connection' };
              if (isOnline) return { variant: 'success' as const, icon: 'pulse' as const, label: 'Online' };
              return { variant: 'muted' as const, icon: 'cross' as const, label: 'Offline' };
            };
            const badgeProps = getBadgeProps();

            // Determine border color
            const borderClass = isPending
              ? 'border-l-4 border-l-amber-400/50'
              : isOnline
                ? 'border-l-4 border-l-success'
                : 'opacity-75 border-l-4 border-l-destructive';

            return (
              <Card
                key={agent.id}
                className={`transition-all duration-200 ${
                  isPending ? '' : 'cursor-pointer hover:shadow-lg hover:scale-[1.02]'
                } ${borderClass}`}
                onClick={() => !isPending && onSelectAgent(agent)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{agent.name}</h3>
                    </div>
                    <StatusBadge
                      variant={badgeProps.variant}
                      icon={badgeProps.icon}
                    >
                      {badgeProps.label}
                    </StatusBadge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Pending agent message */}
                  {isPending ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      <p>Run the installation command on your server.</p>
                      <p className="text-xs mt-2">The agent will appear here once connected.</p>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeletePending(e, agent.id)}
                          disabled={deletingAgentId === agent.id}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          {deletingAgentId === agent.id ? 'Removing...' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  ) : isOnline && metrics ? (
                    <div className="space-y-2">
                      {/* CPU & Memory */}
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
                      {/* Storage section with separator */}
                      {metrics.disks && metrics.disks.length > 0 ? (
                        <>
                          <div className="border-t pt-2 mt-2">
                            <span className="text-xs text-muted-foreground">Storage</span>
                          </div>
                          {metrics.disks.map((disk, idx) => {
                            // Use last path segment as label
                            const label = disk.path.split('/').filter(Boolean).pop() || disk.path;
                            const color = getMetricColor(disk.percent);
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <HardDrive className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span
                                  className="text-xs font-medium text-muted-foreground w-28 truncate"
                                  title={disk.path}
                                >
                                  {label}
                                </span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${Math.min(disk.percent, 100)}%`,
                                      backgroundColor: color,
                                    }}
                                  />
                                </div>
                                <span className="text-xs tabular-nums w-10 text-right text-muted-foreground">
                                  {disk.percent.toFixed(0)}%
                                </span>
                              </div>
                            );
                          })}
                        </>
                      ) : metrics.diskPercent !== undefined ? (
                        // Fallback to legacy single disk format
                        <ResourceMeter
                          icon={HardDrive}
                          label="DISK"
                          value={metrics.diskPercent}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4">
                      {isOnline ? 'Collecting metrics...' : 'Agent offline - No metrics available'}
                    </div>
                  )}

                  {/* Last Seen - hide for pending */}
                  {!isPending && (
                    <div className="pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        Last seen: {lastSeen}
                      </div>
                    </div>
                  )}

                  {/* Click hint - different for pending */}
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    {isPending
                      ? 'Waiting for agent to connect...'
                      : isOnline
                        ? 'Click to view details →'
                        : 'Click to view cached logs →'}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Install Agent Dialog */}
      <InstallAgentDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
      />
    </div>
  );
}
