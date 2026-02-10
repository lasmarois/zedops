/**
 * Dialog for adopting an unmanaged container into ZedOps management
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectContainer, adoptServer, fetchAgentConfig } from '../lib/api';
import { useAdoptProgress } from '../hooks/useAdoptProgress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface AdoptServerDialogProps {
  agentId: string;
  containerId: string;
  containerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AdoptServerDialog({
  agentId,
  containerId,
  containerName,
  open,
  onOpenChange,
  onSuccess,
}: AdoptServerDialogProps) {
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [gamePort, setGamePort] = useState('');
  const [udpPort, setUdpPort] = useState('');
  const [rconPort, setRconPort] = useState('');
  const [nameError, setNameError] = useState('');
  const [dataPath, setDataPath] = useState('');
  const [progressEnabled, setProgressEnabled] = useState(false);

  // Listen for adopt progress via WebSocket
  const { progress: adoptProgress, reset: resetProgress } = useAdoptProgress({
    agentId,
    serverName: name,
    enabled: progressEnabled,
  });

  // Inspect the container when dialog opens
  const { data: inspectData, isLoading: inspecting, error: inspectError } = useQuery({
    queryKey: ['container-inspect', agentId, containerId],
    queryFn: () => inspectContainer(agentId, containerId),
    enabled: open,
    staleTime: 30000,
  });

  // Fetch agent config for default data path
  const { data: agentConfig } = useQuery({
    queryKey: ['agent-config', agentId],
    queryFn: () => fetchAgentConfig(agentId),
    enabled: open,
    staleTime: 60000,
  });

  // Pre-fill form when inspect data arrives
  useEffect(() => {
    if (inspectData) {
      setName(inspectData.name || '');
      setGamePort(inspectData.gamePort?.toString() || '16261');
      setUdpPort(inspectData.udpPort?.toString() || '16262');
      setRconPort(inspectData.rconPort?.toString() || '27015');
    }
  }, [inspectData]);

  // Set default data path from agent config
  useEffect(() => {
    if (agentConfig?.server_data_path && !dataPath) {
      setDataPath(agentConfig.server_data_path);
    }
  }, [agentConfig, dataPath]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('');
      setGamePort('');
      setUdpPort('');
      setRconPort('');
      setNameError('');
      setDataPath('');
      setProgressEnabled(false);
      resetProgress();
    }
  }, [open, resetProgress]);

  // Extract current mount info for display
  const currentMounts = inspectData?.mounts?.filter(
    (m: { target: string }) =>
      m.target === '/home/steam/zomboid-dedicated' || m.target === '/home/steam/Zomboid'
  ) || [];

  // Adopt mutation
  const adoptMutation = useMutation({
    mutationFn: () =>
      adoptServer(agentId, {
        containerId,
        name,
        imageTag: inspectData?.imageTag,
        image: inspectData?.registry,
        config: inspectData?.config,
        gamePort: parseInt(gamePort) || undefined,
        udpPort: parseInt(udpPort) || undefined,
        rconPort: parseInt(rconPort) || undefined,
        server_data_path: dataPath || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers', agentId] });
      queryClient.invalidateQueries({ queryKey: ['servers', agentId] });
      onSuccess();
      onOpenChange(false);
    },
  });

  // Validate server name
  const validateName = (value: string) => {
    const nameRegex = /^[a-z][a-z0-9-]{2,31}$/;
    if (!value) {
      setNameError('Server name is required');
      return false;
    }
    if (!nameRegex.test(value)) {
      setNameError('Must be 3-32 chars, start with letter, lowercase alphanumeric and hyphens only');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleSubmit = () => {
    if (!validateName(name)) return;
    if (willMigrate) {
      setProgressEnabled(true);
    }
    adoptMutation.mutate();
  };

  // Check if data needs migration
  const willMigrate = currentMounts.length > 0 && dataPath && currentMounts.some(
    (m: { source: string; target: string }) => {
      const expectedPath = m.target === '/home/steam/zomboid-dedicated'
        ? `${dataPath}/${name}/bin`
        : `${dataPath}/${name}/data`;
      return m.source !== expectedPath;
    }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Adopt Server</DialogTitle>
          <DialogDescription>
            Adopt <strong>{containerName}</strong> into ZedOps management.
          </DialogDescription>
        </DialogHeader>

        {inspecting && (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {inspectError && (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to inspect container: {inspectError instanceof Error ? inspectError.message : 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}

        {inspectData && (
          <div className="space-y-4 py-2">
            <Alert>
              <AlertDescription>
                This will briefly stop and recreate the container with ZedOps labels.
                {willMigrate
                  ? ' Game data will be copied to the ZedOps standard layout.'
                  : ' Game data is preserved in place.'}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="adopt-name">Server Name</Label>
              <Input
                id="adopt-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) validateName(e.target.value);
                }}
                placeholder="my-server"
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-2">
              <Label>Image</Label>
              <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md font-mono">
                {inspectData.image || 'Unknown'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="adopt-game-port">Game Port</Label>
                <Input
                  id="adopt-game-port"
                  type="number"
                  value={gamePort}
                  onChange={(e) => setGamePort(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adopt-udp-port">UDP Port</Label>
                <Input
                  id="adopt-udp-port"
                  type="number"
                  value={udpPort}
                  onChange={(e) => setUdpPort(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adopt-rcon-port">RCON Port</Label>
                <Input
                  id="adopt-rcon-port"
                  type="number"
                  value={rconPort}
                  onChange={(e) => setRconPort(e.target.value)}
                />
              </div>
            </div>

            {/* Current mount paths (read-only info) */}
            {currentMounts.length > 0 && (
              <div className="space-y-2">
                <Label>Current Mount Paths</Label>
                <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md font-mono space-y-1">
                  {currentMounts.map((m: { source: string; target: string }, i: number) => (
                    <div key={i}>
                      <span className="text-foreground/60">{m.target === '/home/steam/zomboid-dedicated' ? 'bin' : 'data'}:</span>{' '}
                      {m.source}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data path choice */}
            <div className="space-y-2">
              <Label htmlFor="adopt-data-path">Data Path</Label>
              <Input
                id="adopt-data-path"
                value={dataPath}
                onChange={(e) => setDataPath(e.target.value)}
                placeholder={agentConfig?.server_data_path || '/var/lib/zedops/servers'}
              />
              <p className="text-xs text-muted-foreground">
                Server data will be stored at <span className="font-mono">{dataPath || '...'}/{name || '...'}/</span>
              </p>
            </div>

            {willMigrate && (
              <Alert>
                <AlertDescription className="text-xs">
                  Data will be migrated from the current mount paths to the standard layout. Original files are preserved as a backup. This may take a moment for large servers.
                </AlertDescription>
              </Alert>
            )}

            {/* Adoption progress bar */}
            {adoptMutation.isPending && adoptProgress && (
              <Alert>
                <AlertDescription>
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {adoptProgress.phase === 'stopping' && 'Stopping container...'}
                        {adoptProgress.phase === 'copying-bin' && 'Copying game binaries...'}
                        {adoptProgress.phase === 'copying-data' && 'Copying game data...'}
                        {adoptProgress.phase === 'creating-container' && 'Creating new container...'}
                        {adoptProgress.phase === 'complete' && 'Complete!'}
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2 mt-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all duration-300"
                          style={{ width: `${adoptProgress.percent}%` }}
                        />
                      </div>
                      {adoptProgress.totalBytes > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatBytes(adoptProgress.bytesCopied)} / {formatBytes(adoptProgress.totalBytes)}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">{adoptProgress.percent}%</span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {adoptMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {adoptMutation.error instanceof Error ? adoptMutation.error.message : 'Failed to adopt server'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adoptMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={inspecting || !inspectData || adoptMutation.isPending}
          >
            {adoptMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {adoptProgress ? `${adoptProgress.percent}%` : 'Adopting...'}
              </>
            ) : 'Adopt Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
