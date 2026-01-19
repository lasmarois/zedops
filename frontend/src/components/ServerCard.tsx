/**
 * ServerCard - Unified server card component with two layout options
 *
 * Layout modes:
 * - "expandable": Click to expand/collapse, shows details inline
 * - "compact": Dense single-row, hover tooltip for details
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  RotateCw,
  MoreVertical,
  Terminal,
  Trash2,
  Wrench,
  HardDrive,
  Clock,
  Network,
} from 'lucide-react';
import { getDisplayStatus, type DisplayStatus } from '@/lib/server-status';
import type { Server, Container, ServerStorageSizes } from '@/lib/api';
import { useServerStorage } from '@/hooks/useServers';

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Format uptime from container status or created_at
function formatUptime(server: Server, container?: Container): string {
  if (container?.status) {
    // Extract uptime from container status like "Up 2 hours"
    const match = container.status.match(/Up\s+(.+)/i);
    if (match) return match[1];
  }
  // Fallback: calculate from created_at
  const now = Date.now() / 1000;
  const created = server.created_at;
  const seconds = Math.floor(now - created);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// Get status icon type
function getStatusIcon(displayStatus: DisplayStatus): 'dot' | 'pulse' | 'loader' | 'check' | 'alert' | 'cross' | 'info' {
  switch (displayStatus.status) {
    case 'running': return 'pulse';
    case 'starting': return 'loader';
    case 'stopped': return 'dot';
    case 'failed':
    case 'unhealthy':
    case 'agent_offline': return 'cross';
    default: return 'dot';
  }
}

// Get border color based on status
function getBorderColor(displayStatus: DisplayStatus): string {
  switch (displayStatus.variant) {
    case 'success': return '#22c55e';
    case 'starting': return '#a78bbd';
    case 'warning': return '#f59e0b';
    case 'error': return '#ef4444';
    case 'info': return '#3b82f6';
    default: return '#6b7280';
  }
}

export type ServerCardLayout = 'expandable' | 'compact';

interface ServerCardProps {
  server: Server;
  container?: Container;
  layout: ServerCardLayout;
  isManaged?: boolean;
  showAgent?: boolean; // Show agent name (for All Servers list)
  // Action handlers
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onDelete?: () => void;
  onRebuild?: () => void;
  onRcon?: () => void;
  onEdit?: () => void;
  // Loading states
  isStarting?: boolean;
  isStopping?: boolean;
  isRestarting?: boolean;
}

export function ServerCard({
  server,
  container,
  layout,
  isManaged = true,
  showAgent = false,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onRebuild,
  onRcon,
  onEdit,
  isStarting,
  isStopping,
  isRestarting,
}: ServerCardProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const displayStatus = getDisplayStatus(server);
  const isRunning = displayStatus.status === 'running';
  const borderColor = getBorderColor(displayStatus);
  const statusIcon = getStatusIcon(displayStatus);

  // Fetch storage data from agent (cached for 5 minutes)
  const { data: storageData, isLoading: storageLoading } = useServerStorage(
    server.agent_id,
    server.id,
    true // Always fetch
  );

  // Extract storage sizes or use null if not available
  const storage: ServerStorageSizes | null = storageData?.success ? storageData.sizes || null : null;

  const uptime = formatUptime(server, container);
  const imageTag = server.image_tag || 'latest';

  // Navigate to server detail
  const handleNavigate = () => {
    navigate(`/servers/${server.id}`);
  };

  // Toggle expand (only for expandable layout)
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Render segmented action buttons
  const renderActions = () => {
    // Segmented button style classes
    const segmentedContainer = "flex items-center rounded-lg overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-sm";
    const segmentedDivider = "w-px h-5 bg-white/10";
    const baseButton = "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 disabled:opacity-50";
    const startButton = `${baseButton} text-success hover:bg-success/20 hover:shadow-[inset_0_0_15px_rgba(61,220,151,0.2)]`;
    const stopButton = `${baseButton} text-warning hover:bg-warning/20 hover:shadow-[inset_0_0_15px_rgba(255,201,82,0.2)]`;
    const restartButton = `${baseButton} text-info hover:bg-info/20 hover:shadow-[inset_0_0_15px_rgba(51,225,255,0.2)]`;

    if (container) {
      if (!isRunning && onStart) {
        return (
          <div className={segmentedContainer}>
            <button
              onClick={(e) => { e.stopPropagation(); onStart(); }}
              disabled={isStarting}
              className={startButton}
            >
              <Play className={`h-3.5 w-3.5 ${isStarting ? 'animate-spin' : ''}`} />
              <span>{isStarting ? 'Starting...' : 'Start'}</span>
            </button>
          </div>
        );
      }
      if (isRunning) {
        return (
          <div className={segmentedContainer}>
            {onStop && (
              <button
                onClick={(e) => { e.stopPropagation(); onStop(); }}
                disabled={isStopping}
                className={stopButton}
              >
                <Square className={`h-3.5 w-3.5 ${isStopping ? 'animate-pulse' : ''}`} />
                <span>{isStopping ? 'Stopping...' : 'Stop'}</span>
              </button>
            )}
            {onStop && onRestart && <div className={segmentedDivider} />}
            {onRestart && (
              <button
                onClick={(e) => { e.stopPropagation(); onRestart(); }}
                disabled={isRestarting}
                className={restartButton}
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
                <span>{isRestarting ? 'Restarting...' : 'Restart'}</span>
              </button>
            )}
          </div>
        );
      }
    } else if (server.status === 'stopped' && onStart) {
      return (
        <div className={segmentedContainer}>
          <button
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            disabled={isStarting}
            className={startButton}
          >
            <Play className={`h-3.5 w-3.5 ${isStarting ? 'animate-spin' : ''}`} />
            <span>{isStarting ? 'Starting...' : 'Start'}</span>
          </button>
        </div>
      );
    } else if (server.status === 'failed' && onEdit) {
      return (
        <div className={segmentedContainer}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className={`${baseButton} text-warning hover:bg-warning/20 hover:shadow-[inset_0_0_15px_rgba(255,201,82,0.2)]`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
        </div>
      );
    }

    return null;
  };

  // Render dropdown menu
  const renderDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {isRunning && onRcon && (
          <DropdownMenuItem onClick={onRcon}>
            <Terminal className="h-4 w-4 mr-2" />
            RCON Console
          </DropdownMenuItem>
        )}
        {onRebuild && (
          <DropdownMenuItem onClick={onRebuild}>
            <RotateCw className="h-4 w-4 mr-2" />
            Rebuild
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Expandable details section
  const renderExpandedDetails = () => (
    <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <HardDrive className="h-4 w-4" />
          <span>Storage</span>
        </div>
        <div className="flex gap-4">
          {storageLoading ? (
            <span className="text-muted-foreground">Loading...</span>
          ) : storage ? (
            <>
              <span>bin/ <strong>{formatBytes(storage.binBytes)}</strong></span>
              <span>data/ <strong>{formatBytes(storage.dataBytes)}</strong></span>
              {storage.mountPoint && (
                <span className="text-muted-foreground">Mount: {storage.mountPoint}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Unavailable</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Network className="h-4 w-4" />
          <span>Ports</span>
        </div>
        <div className="flex gap-4">
          <span>Game: <strong>{server.game_port}</strong></span>
          <span>UDP: <strong>{server.udp_port}</strong></span>
          <span>RCON: <strong>{server.rcon_port}</strong></span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Created</span>
        </div>
        <span>{new Date(server.created_at * 1000).toLocaleString()}</span>
      </div>
    </div>
  );

  // Tooltip content for compact mode
  const renderTooltipContent = () => (
    <div className="space-y-3 p-1">
      <div>
        <div className="text-xs text-muted-foreground mb-1">Storage</div>
        <div className="space-y-1 text-sm">
          {storageLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : storage ? (
            <>
              <div>bin/ {formatBytes(storage.binBytes)}</div>
              <div>data/ {formatBytes(storage.dataBytes)}</div>
              {storage.mountPoint && (
                <div className="text-muted-foreground">Mount: {storage.mountPoint}</div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground">Unavailable</div>
          )}
        </div>
      </div>
      <div className="border-t border-border pt-2">
        <div className="text-xs text-muted-foreground mb-1">Ports</div>
        <div className="space-y-1 text-sm">
          <div>Game: {server.game_port}</div>
          <div>UDP: {server.udp_port}</div>
          <div>RCON: {server.rcon_port}</div>
        </div>
      </div>
      <div className="border-t border-border pt-2">
        <div className="text-xs text-muted-foreground mb-1">Created</div>
        <div className="text-sm">{new Date(server.created_at * 1000).toLocaleDateString()}</div>
      </div>
    </div>
  );

  // ========== EXPANDABLE LAYOUT ==========
  if (layout === 'expandable') {
    return (
      <Card
        className="transition-all duration-200 border-l-4 hover:shadow-md"
        style={{ borderLeftColor: borderColor }}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Status + Name + Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <StatusBadge variant={displayStatus.variant} icon={statusIcon} iconOnly>
                {displayStatus.label}
              </StatusBadge>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-semibold text-lg truncate cursor-pointer hover:underline"
                    onClick={handleNavigate}
                  >
                    {server.name}
                  </span>
                  {isManaged ? (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                      Managed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-2 text-muted-foreground">
                      Unmanaged
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {showAgent && <span>{server.agent_name} • </span>}
                  {imageTag} • {storage ? formatBytes(storage.totalBytes) : '...'} • {uptime}
                  {server.player_count !== null && server.player_count !== undefined && (
                    <span className="text-info"> • {server.player_count}/{server.max_players || 32} players</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions + Expand Toggle */}
            <div className="flex gap-2 items-center flex-shrink-0">
              {renderActions()}
              {renderDropdown()}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleToggleExpand}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && renderExpandedDetails()}
        </CardContent>
      </Card>
    );
  }

  // ========== COMPACT LAYOUT ==========
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Card
            className="transition-all duration-200 border-l-4 cursor-pointer hover:shadow-md hover:bg-accent/5"
            style={{ borderLeftColor: borderColor }}
            onClick={handleNavigate}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Status + Compact Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <StatusBadge variant={displayStatus.variant} icon={statusIcon} iconOnly>
                    {displayStatus.label}
                  </StatusBadge>
                  <span className="font-semibold truncate">{server.name}</span>
                  {isManaged ? (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20 shrink-0">
                      Managed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-2 text-muted-foreground shrink-0">
                      Unmanaged
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground truncate hidden sm:inline">
                    {showAgent && <span>{server.agent_name} • </span>}
                    {imageTag} • {storage ? formatBytes(storage.totalBytes) : '...'} • {uptime}
                    {server.player_count !== null && server.player_count !== undefined && (
                      <span className="text-info"> • {server.player_count}/{server.max_players || 32}</span>
                    )}
                  </span>
                </div>

                {/* Right: Actions */}
                <div className="flex gap-2 items-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {renderActions()}
                  {renderDropdown()}
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="w-48">
          {renderTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
