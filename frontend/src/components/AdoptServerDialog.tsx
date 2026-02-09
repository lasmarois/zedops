/**
 * Dialog for adopting an unmanaged container into ZedOps management
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectContainer, adoptServer } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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

  // Inspect the container when dialog opens
  const { data: inspectData, isLoading: inspecting, error: inspectError } = useQuery({
    queryKey: ['container-inspect', agentId, containerId],
    queryFn: () => inspectContainer(agentId, containerId),
    enabled: open,
    staleTime: 30000,
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

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('');
      setGamePort('');
      setUdpPort('');
      setRconPort('');
      setNameError('');
    }
  }, [open]);

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
    adoptMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
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
                This will briefly stop and recreate the container with ZedOps labels. Game data is preserved.
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={inspecting || !inspectData || adoptMutation.isPending}
          >
            {adoptMutation.isPending ? 'Adopting...' : 'Adopt Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
