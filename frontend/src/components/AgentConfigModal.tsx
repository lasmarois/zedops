import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2 } from 'lucide-react';

interface AgentConfig {
  server_data_path: string;
  steam_zomboid_registry: string;
  hostname: string | null;
}

interface AgentConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  currentConfig: AgentConfig | null;
  isLoadingConfig: boolean;
  onSave: (config: Partial<AgentConfig>) => Promise<void>;
}

export function AgentConfigModal({
  open,
  onOpenChange,
  agentName,
  currentConfig,
  isLoadingConfig,
  onSave,
}: AgentConfigModalProps) {
  const [serverDataPath, setServerDataPath] = useState('');
  const [steamZomboidRegistry, setSteamZomboidRegistry] = useState('');
  const [hostname, setHostname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize form with current config when modal opens
  useEffect(() => {
    if (open && currentConfig) {
      setServerDataPath(currentConfig.server_data_path || '');
      setSteamZomboidRegistry(currentConfig.steam_zomboid_registry || '');
      setHostname(currentConfig.hostname || '');
      setError(null);
      setSuccess(false);
    }
  }, [open, currentConfig]);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    // Validate server data path
    if (!serverDataPath) {
      setError('Server data path is required');
      return;
    }

    if (!serverDataPath.startsWith('/')) {
      setError('Server data path must be an absolute path (start with /)');
      return;
    }

    if (serverDataPath === '/') {
      setError('Cannot use root directory as server data path');
      return;
    }

    // Build update payload
    const updates: Partial<AgentConfig> = {};

    // Only include changed fields
    if (serverDataPath !== currentConfig?.server_data_path) {
      updates.server_data_path = serverDataPath;
    }

    if (steamZomboidRegistry !== currentConfig?.steam_zomboid_registry) {
      updates.steam_zomboid_registry = steamZomboidRegistry;
    }

    // Hostname: send null if cleared, string if set
    const currentHostname = currentConfig?.hostname || '';
    if (hostname !== currentHostname) {
      updates.hostname = hostname.trim() || null;
    }

    // Check if anything changed
    if (Object.keys(updates).length === 0) {
      setError('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(updates);
      setSuccess(true);

      // Close modal after short delay
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configure Agent: {agentName}</DialogTitle>
          <DialogDescription>
            Update default configuration for this agent and its servers.
          </DialogDescription>
        </DialogHeader>

        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Server Data Path */}
            <div className="space-y-2">
              <Label htmlFor="serverDataPath">Server Data Path</Label>
              <Input
                id="serverDataPath"
                type="text"
                value={serverDataPath}
                onChange={(e) => setServerDataPath(e.target.value)}
                placeholder="/var/lib/zedops/servers"
                disabled={isSaving}
              />
              <p className="text-sm text-muted-foreground">
                Host directory where server data (bin, saves) will be stored. Must be an absolute path.
              </p>
              <p className="text-sm text-warning">
                ⚠️ Changing this path does not move existing server data. You must manually migrate data if needed.
              </p>
            </div>

            {/* Docker Registry */}
            <div className="space-y-2">
              <Label htmlFor="steamZomboidRegistry">Steam Zomboid Registry</Label>
              <Input
                id="steamZomboidRegistry"
                type="text"
                value={steamZomboidRegistry}
                onChange={(e) => setSteamZomboidRegistry(e.target.value)}
                placeholder="registry.gitlab.nicomarois.com/nicolas/steam-zomboid"
                disabled={isSaving}
              />
              <p className="text-sm text-muted-foreground">
                Docker registry URL for the Steam Zomboid server image.
              </p>
            </div>

            {/* Hostname */}
            <div className="space-y-2">
              <Label htmlFor="hostname">Hostname (Optional)</Label>
              <Input
                id="hostname"
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="myserver.duckdns.org"
                disabled={isSaving}
              />
              <p className="text-sm text-muted-foreground">
                Custom hostname for server connections. If set, this will be displayed instead of the auto-detected IP.
                Useful for dynamic DNS services like DuckDNS.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Alert */}
            {success && (
              <Alert className="border-green-500 bg-green-50 text-green-900">
                <AlertDescription>Configuration saved successfully!</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoadingConfig || isSaving || success}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
