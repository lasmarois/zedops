/**
 * Server creation form component
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CreateServerRequest, ServerConfig, PortSet, Server } from '../lib/api';
import { usePortAvailability } from '../hooks/usePortAvailability';
import { fetchAgentConfig, fetchRegistryTags } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorDialog } from '@/components/ui/error-dialog';

interface ServerFormProps {
  agentId: string;
  onSubmit: (request: CreateServerRequest, serverIdToDelete?: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  editServer?: Server; // Optional: Pre-fill form for editing failed server
}

export function ServerForm({ agentId, onSubmit, onCancel, isSubmitting, editServer }: ServerFormProps) {
  // Parse config from editServer if editing
  const editConfig = editServer ? (JSON.parse(editServer.config) as ServerConfig) : null;

  const [serverName, setServerName] = useState(editServer?.name || '');
  const [image, setImage] = useState(editServer?.image || ''); // Custom registry override
  const [imageTag, setImageTag] = useState(editServer?.image_tag || 'latest');
  const [betaBranch, setBetaBranch] = useState(editConfig?.BETABRANCH || 'none');
  const [serverPublicName, setServerPublicName] = useState(editConfig?.SERVER_PUBLIC_NAME || '');
  const [adminPassword, setAdminPassword] = useState(editConfig?.ADMIN_PASSWORD || '');
  const [serverPassword, setServerPassword] = useState(editConfig?.SERVER_PASSWORD || '');
  const [nameError, setNameError] = useState('');

  // Port configuration
  const [showPortConfig, setShowPortConfig] = useState(!!editServer); // Auto-expand if editing
  const [checkPorts, setCheckPorts] = useState(false);
  const [useCustomPorts, setUseCustomPorts] = useState(!!editServer); // Auto-enable if editing
  const [customGamePort, setCustomGamePort] = useState(editServer?.game_port?.toString() || '');
  const [customUdpPort, setCustomUdpPort] = useState(editServer?.udp_port?.toString() || '');
  const [customRconPort, setCustomRconPort] = useState(editServer?.rcon_port?.toString() || '');

  // Game settings
  const [showGameSettings, setShowGameSettings] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState('');
  const [serverMap, setServerMap] = useState('');
  const [serverPublic, setServerPublic] = useState('');
  const [serverOpen, setServerOpen] = useState('');
  const [serverPvp, setServerPvp] = useState('');
  const [pauseEmpty, setPauseEmpty] = useState('');
  const [globalChat, setGlobalChat] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [publicDescription, setPublicDescription] = useState('');

  // Mod management
  const [showModSettings, setShowModSettings] = useState(false);
  const [serverMods, setServerMods] = useState('');
  const [workshopItems, setWorkshopItems] = useState('');

  // Server data path (M9.8.23: Per-server path override)
  const [customDataPath, setCustomDataPath] = useState('');
  const [dataPathError, setDataPathError] = useState('');

  // Error dialog state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch agent config for default data path display
  const { data: agentConfig } = useQuery({
    queryKey: ['agentConfig', agentId],
    queryFn: () => fetchAgentConfig(agentId),
    enabled: !!agentId,
  });

  // Fetch available image tags from registry (re-fetches when custom registry changes)
  const { data: registryTags, isLoading: tagsLoading } = useQuery({
    queryKey: ['registryTags', agentId, image || agentConfig?.steam_zomboid_registry],
    queryFn: () => fetchRegistryTags(agentId, image || undefined),
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Port availability query (manual trigger via checkPorts state)
  const portAvailability = usePortAvailability(agentId, 3, checkPorts);

  const validateServerName = (name: string): boolean => {
    const nameRegex = /^[a-z][a-z0-9-]{2,31}$/;
    if (!name) {
      setNameError('Server name is required');
      return false;
    }
    if (!nameRegex.test(name)) {
      setNameError('Must be 3-32 chars, start with letter, lowercase alphanumeric and hyphens only');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateDataPath = (path: string): boolean => {
    // Empty path is valid (will use agent default)
    if (!path.trim()) {
      setDataPathError('');
      return true;
    }

    // Must be absolute path
    if (!path.startsWith('/')) {
      setDataPathError('Path must be absolute (start with /)');
      return false;
    }

    // Cannot be root
    if (path === '/') {
      setDataPathError('Cannot use root directory');
      return false;
    }

    // Cannot be system directories
    const forbiddenPaths = ['/etc', '/var', '/usr', '/bin', '/sbin', '/boot', '/sys', '/proc', '/dev'];
    if (forbiddenPaths.some(p => path === p || path.startsWith(p + '/'))) {
      setDataPathError('Cannot use system directories');
      return false;
    }

    setDataPathError('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateServerName(serverName)) {
      return;
    }

    if (!validateDataPath(customDataPath)) {
      return;
    }

    if (!adminPassword) {
      setErrorMessage('Admin password is required');
      return;
    }

    const config: ServerConfig = {
      SERVER_NAME: serverName,
      SERVER_PUBLIC_NAME: serverPublicName || `${serverName} Server`,
      ADMIN_PASSWORD: adminPassword,
      SERVER_PASSWORD: serverPassword,
      RCON_PASSWORD: adminPassword, // Use same password as admin for RCON access
    };

    // Add beta branch if specified (don't add if "none")
    if (betaBranch && betaBranch !== 'none') {
      config.BETABRANCH = betaBranch;
    }

    // Game settings (only include non-empty/non-default values)
    if (maxPlayers) config.SERVER_MAX_PLAYERS = maxPlayers;
    if (serverMap) config.SERVER_MAP = serverMap;
    if (serverPublic && serverPublic !== 'default') config.SERVER_PUBLIC = serverPublic;
    if (serverOpen && serverOpen !== 'default') config.SERVER_OPEN = serverOpen;
    if (serverPvp && serverPvp !== 'default') config.SERVER_PVP = serverPvp;
    if (pauseEmpty && pauseEmpty !== 'default') config.SERVER_PAUSE_EMPTY = pauseEmpty;
    if (globalChat && globalChat !== 'default') config.SERVER_GLOBAL_CHAT = globalChat;
    if (welcomeMessage) config.SERVER_WELCOME_MESSAGE = welcomeMessage;
    if (publicDescription) config.SERVER_PUBLIC_DESCRIPTION = publicDescription;

    // Mod management
    if (serverMods) config.SERVER_MODS = serverMods;
    if (workshopItems) config.SERVER_WORKSHOP_ITEMS = workshopItems;

    const request: CreateServerRequest = {
      name: serverName,
      imageTag,
      config,
    };

    // Add custom registry if specified
    if (image.trim()) {
      request.image = image.trim();
    }

    // Add custom ports if specified
    if (useCustomPorts && customGamePort && customUdpPort && customRconPort) {
      request.gamePort = parseInt(customGamePort);
      request.udpPort = parseInt(customUdpPort);
      request.rconPort = parseInt(customRconPort);
    }

    // Add custom data path if specified (M9.8.23)
    if (customDataPath.trim()) {
      request.server_data_path = customDataPath.trim();
    }

    // Pass serverIdToDelete if editing (to remove old failed server)
    onSubmit(request, editServer?.id);
  };

  const handleCheckAvailability = () => {
    setCheckPorts(true);
    // Reset after a short delay to allow re-checking
    setTimeout(() => setCheckPorts(false), 100);
  };

  const getPortStatus = (port: number): 'available' | 'unavailable' | 'unknown' => {
    if (!portAvailability.data) return 'unknown';
    if (portAvailability.data.hostBoundPorts.includes(port)) return 'unavailable';

    // Check if port is in any allocated server
    const isAllocated = portAvailability.data.allocatedPorts.some(
      (p) => p.gamePort === port || p.udpPort === port || p.rconPort === port
    );
    if (isAllocated) return 'unavailable';

    return 'available';
  };

  // Badge color styling for better contrast (matching AgentList improvements)
  const getPortBadgeStyle = (status: string): string => {
    if (status === 'available') {
      return 'bg-green-600 text-white border-green-700 ml-2';
    }
    if (status === 'unavailable') {
      return 'bg-red-700 text-white border-red-800 ml-2';
    }
    return 'ml-2'; // Secondary variant unchanged
  };

  const getPortStatusBadge = (port: number) => {
    const status = getPortStatus(port);
    if (status === 'available') {
      return <Badge className={getPortBadgeStyle('available')}>✓ Available</Badge>;
    }
    if (status === 'unavailable') {
      return <Badge className={getPortBadgeStyle('unavailable')}>✗ In Use</Badge>;
    }
    return <Badge variant="secondary" className="ml-2">? Unknown</Badge>;
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editServer ? 'Edit & Retry Server' : 'Create New Server'}</DialogTitle>
          {editServer && (
            <Alert variant="warning" className="mt-4">
              <AlertDescription>
                <strong>Editing failed server:</strong> {editServer.name} - Adjust configuration and retry. The old failed entry will be removed.
              </AlertDescription>
            </Alert>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Server Name */}
          <div className="space-y-2">
            <Label htmlFor="serverName">Server Name *</Label>
            <Input
              id="serverName"
              type="text"
              value={serverName}
              onChange={(e) => {
                setServerName(e.target.value.toLowerCase());
                validateServerName(e.target.value.toLowerCase());
              }}
              placeholder="myserver"
              disabled={isSubmitting}
              className={nameError ? 'border-destructive' : ''}
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Used for container name and data directories
            </p>
          </div>

          {/* Image Registry (optional override) */}
          <div className="space-y-2">
            <Label htmlFor="image">Image Registry <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <Input
              id="image"
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder={agentConfig?.steam_zomboid_registry || 'registry.example.com/steam-zomboid'}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              {agentConfig?.steam_zomboid_registry
                ? `Default: ${agentConfig.steam_zomboid_registry}`
                : 'No default registry configured'}
              {image ? ' — using custom override' : ''}
            </p>
          </div>

          {/* Image Tag */}
          <div className="space-y-2">
            <Label htmlFor="imageTag">Image Tag</Label>
            {tagsLoading ? (
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                Loading tags...
              </div>
            ) : registryTags && registryTags.length > 0 ? (
              <Select value={imageTag} onValueChange={setImageTag} disabled={isSubmitting}>
                <SelectTrigger id="imageTag">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {registryTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="imageTag"
                type="text"
                value={imageTag}
                onChange={(e) => setImageTag(e.target.value)}
                placeholder="latest"
                disabled={isSubmitting}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {registryTags ? `${registryTags.length} tags available` : 'Enter image tag manually'}
            </p>
          </div>

          {/* Beta Branch */}
          <div className="space-y-2">
            <Label htmlFor="betaBranch">Beta Branch</Label>
            <Select value={betaBranch} onValueChange={setBetaBranch} disabled={isSubmitting}>
              <SelectTrigger id="betaBranch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Stable)</SelectItem>
                <SelectItem value="build42">build42 (Unstable Build 42)</SelectItem>
                <SelectItem value="iwillbackupmysave">iwillbackupmysave (Build 41 Multiplayer)</SelectItem>
                <SelectItem value="b41multiplayer">b41multiplayer (Build 41 MP Beta)</SelectItem>
                <SelectItem value="unstable">unstable (Latest Unstable)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select game beta branch from Steam. Leave as "None" for stable release.
            </p>
          </div>

          {/* Public Server Name */}
          <div className="space-y-2">
            <Label htmlFor="serverPublicName">Public Server Name</Label>
            <Input
              id="serverPublicName"
              type="text"
              value={serverPublicName}
              onChange={(e) => setServerPublicName(e.target.value)}
              placeholder="My Project Zomboid Server"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Displayed in server browser
            </p>
          </div>

          {/* Admin Password */}
          <div className="space-y-2">
            <Label htmlFor="adminPassword">Admin Password *</Label>
            <Input
              id="adminPassword"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin password for server management"
              disabled={isSubmitting}
            />
          </div>

          {/* Server Password */}
          <div className="space-y-2">
            <Label htmlFor="serverPassword">Server Password</Label>
            <Input
              id="serverPassword"
              type="password"
              value={serverPassword}
              onChange={(e) => setServerPassword(e.target.value)}
              placeholder="Leave empty for public server"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Password required to join server
            </p>
          </div>

          {/* Game Settings Section (Collapsible) */}
          <div className="border rounded-md">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowGameSettings(!showGameSettings)}
              className="w-full justify-between font-semibold"
            >
              <span>Game Settings (Optional)</span>
              <span>{showGameSettings ? '▼' : '▶'}</span>
            </Button>

            {showGameSettings && (
              <div className="p-4 space-y-4 border-t">
                {/* Max Players */}
                <div className="space-y-1">
                  <Label htmlFor="maxPlayers" className="text-sm">Max Players</Label>
                  <Input
                    id="maxPlayers"
                    type="number"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    placeholder="32"
                    min="1"
                    max="100"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Map */}
                <div className="space-y-1">
                  <Label htmlFor="serverMap" className="text-sm">Map</Label>
                  <Input
                    id="serverMap"
                    value={serverMap}
                    onChange={(e) => setServerMap(e.target.value)}
                    placeholder="Muldraugh, KY"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Boolean toggles */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="serverPublic" className="text-sm">Public (Server Browser)</Label>
                    <Select value={serverPublic} onValueChange={setServerPublic} disabled={isSubmitting}>
                      <SelectTrigger id="serverPublic"><SelectValue placeholder="Default" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="serverOpen" className="text-sm">Open (No Whitelist)</Label>
                    <Select value={serverOpen} onValueChange={setServerOpen} disabled={isSubmitting}>
                      <SelectTrigger id="serverOpen"><SelectValue placeholder="Default" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="serverPvp" className="text-sm">PvP</Label>
                    <Select value={serverPvp} onValueChange={setServerPvp} disabled={isSubmitting}>
                      <SelectTrigger id="serverPvp"><SelectValue placeholder="Default" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pauseEmpty" className="text-sm">Pause When Empty</Label>
                    <Select value={pauseEmpty} onValueChange={setPauseEmpty} disabled={isSubmitting}>
                      <SelectTrigger id="pauseEmpty"><SelectValue placeholder="Default" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="globalChat" className="text-sm">Global Chat</Label>
                    <Select value={globalChat} onValueChange={setGlobalChat} disabled={isSubmitting}>
                      <SelectTrigger id="globalChat"><SelectValue placeholder="Default" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Welcome Message */}
                <div className="space-y-1">
                  <Label htmlFor="welcomeMessage" className="text-sm">Welcome Message</Label>
                  <textarea
                    id="welcomeMessage"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Welcome to our server!"
                    disabled={isSubmitting}
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                {/* Public Description */}
                <div className="space-y-1">
                  <Label htmlFor="publicDescription" className="text-sm">Public Description</Label>
                  <textarea
                    id="publicDescription"
                    value={publicDescription}
                    onChange={(e) => setPublicDescription(e.target.value)}
                    placeholder="Server description for server browser"
                    disabled={isSubmitting}
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mod Management Section (Collapsible) */}
          <div className="border rounded-md">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowModSettings(!showModSettings)}
              className="w-full justify-between font-semibold"
            >
              <span>Mod Management (Optional)</span>
              <span>{showModSettings ? '▼' : '▶'}</span>
            </Button>

            {showModSettings && (
            <div className="p-4 space-y-4 border-t">
              <div className="space-y-1">
                <Label htmlFor="serverMods" className="text-sm">Server Mods</Label>
                <textarea
                  id="serverMods"
                  value={serverMods}
                  onChange={(e) => setServerMods(e.target.value)}
                  placeholder="ModID1;ModID2;ModID3"
                  disabled={isSubmitting}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <p className="text-xs text-muted-foreground">
                  Semicolon-separated list of mod IDs
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="workshopItems" className="text-sm">Workshop Items</Label>
                <textarea
                  id="workshopItems"
                  value={workshopItems}
                  onChange={(e) => setWorkshopItems(e.target.value)}
                  placeholder="123456789;987654321"
                  disabled={isSubmitting}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <p className="text-xs text-muted-foreground">
                  Semicolon-separated list of Steam Workshop item IDs
                </p>
              </div>
            </div>
            )}
          </div>

          {/* Server Data Path - M9.8.23 */}
          <div className="space-y-2">
            <Label htmlFor="customDataPath">
              Server Data Path <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="customDataPath"
              type="text"
              value={customDataPath}
              onChange={(e) => {
                setCustomDataPath(e.target.value);
                validateDataPath(e.target.value);
              }}
              placeholder={agentConfig?.server_data_path || 'Loading...'}
              disabled={isSubmitting}
              className={dataPathError ? 'border-destructive' : ''}
            />
            {dataPathError && (
              <p className="text-sm text-destructive">{dataPathError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Override the agent's default data path for this server only. Leave blank to use agent default.
            </p>
          </div>

          {/* Port Configuration Section */}
          <div className="border rounded-md">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowPortConfig(!showPortConfig)}
              className="w-full justify-between font-semibold"
            >
              <span>Port Configuration (Optional)</span>
              <span>{showPortConfig ? '▼' : '▶'}</span>
            </Button>

            {showPortConfig && (
              <div className="p-4 space-y-4 border-t">
                {/* Check Availability Button */}
                <Button
                  type="button"
                  variant="info"
                  size="sm"
                  onClick={handleCheckAvailability}
                  disabled={portAvailability.isFetching}
                >
                  {portAvailability.isFetching ? 'Checking...' : 'Check Port Availability'}
                </Button>

                {/* Error Message */}
                {portAvailability.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Failed to check port availability. The agent may be offline.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Suggested Ports */}
                {portAvailability.data && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Suggested Available Ports:
                    </p>
                    {portAvailability.data.suggestedPorts.map((portSet: PortSet, index: number) => (
                      <div
                        key={index}
                        className="p-2 bg-success/10 border border-success/20 rounded-md text-sm"
                      >
                        <strong>Option {index + 1}:</strong> Game Port: {portSet.gamePort}, UDP
                        Port: {portSet.udpPort}, RCON Port: {portSet.rconPort}
                      </div>
                    ))}

                    {/* Allocated Ports */}
                    {portAvailability.data.allocatedPorts.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <p className="text-sm font-semibold text-muted-foreground">
                          Currently Allocated Ports:
                        </p>
                        {portAvailability.data.allocatedPorts.map((port, index) => (
                          <div
                            key={index}
                            className="p-2 bg-warning/10 border border-warning/20 rounded-md text-sm"
                          >
                            <strong>{port.serverName}</strong> ({port.status}): {port.gamePort}-
                            {port.udpPort}, RCON: {port.rconPort}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Ports Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useCustomPorts"
                    checked={useCustomPorts}
                    onChange={(e) => setUseCustomPorts(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <Label htmlFor="useCustomPorts" className="cursor-pointer font-semibold">
                    Specify Custom Ports
                  </Label>
                </div>

                {/* Custom Port Inputs */}
                {useCustomPorts && (
                  <div className="space-y-3">
                    {/* Game Port */}
                    <div className="space-y-1">
                      <Label htmlFor="customGamePort" className="text-sm">
                        Game Port (UDP)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="customGamePort"
                          type="number"
                          value={customGamePort}
                          onChange={(e) => setCustomGamePort(e.target.value)}
                          placeholder="16261"
                          min="1024"
                          max="65535"
                          className="flex-1"
                        />
                        {customGamePort && getPortStatusBadge(parseInt(customGamePort))}
                      </div>
                    </div>

                    {/* UDP Port */}
                    <div className="space-y-1">
                      <Label htmlFor="customUdpPort" className="text-sm">
                        UDP Port (Game Port + 1)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="customUdpPort"
                          type="number"
                          value={customUdpPort}
                          onChange={(e) => setCustomUdpPort(e.target.value)}
                          placeholder="16262"
                          min="1024"
                          max="65535"
                          className="flex-1"
                        />
                        {customUdpPort && getPortStatusBadge(parseInt(customUdpPort))}
                      </div>
                    </div>

                    {/* RCON Port */}
                    <div className="space-y-1">
                      <Label htmlFor="customRconPort" className="text-sm">
                        RCON Port (TCP, Internal)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="customRconPort"
                          type="number"
                          value={customRconPort}
                          onChange={(e) => setCustomRconPort(e.target.value)}
                          placeholder="27015"
                          min="1024"
                          max="65535"
                          className="flex-1"
                        />
                        {customRconPort && getPortStatusBadge(parseInt(customRconPort))}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>Note:</strong> If no ports are specified, the system will automatically
                      assign the next available ports.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? editServer
                  ? 'Retrying...'
                  : 'Creating...'
                : editServer
                ? 'Retry Server'
                : 'Create Server'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Error Dialog */}
      <ErrorDialog
        open={!!errorMessage}
        onOpenChange={(open) => !open && setErrorMessage(null)}
        title="Validation Error"
        message={errorMessage || ''}
      />
    </Dialog>
  );
}
