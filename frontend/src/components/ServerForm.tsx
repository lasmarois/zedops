/**
 * Server creation form component
 */

import { useState } from 'react';
import type { CreateServerRequest, ServerConfig, PortSet, Server } from '../lib/api';
import { usePortAvailability } from '../hooks/usePortAvailability';
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
  const [imageTag, setImageTag] = useState(editServer?.image_tag || 'latest');
  const [betaBranch, setBetaBranch] = useState(editConfig?.BETA_BRANCH || 'none');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateServerName(serverName)) {
      return;
    }

    if (!adminPassword) {
      alert('Admin password is required');
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
      config.BETA_BRANCH = betaBranch;
    }

    const request: CreateServerRequest = {
      name: serverName,
      imageTag,
      config,
    };

    // Add custom ports if specified
    if (useCustomPorts && customGamePort && customUdpPort && customRconPort) {
      request.gamePort = parseInt(customGamePort);
      request.udpPort = parseInt(customUdpPort);
      request.rconPort = parseInt(customRconPort);
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

          {/* Image Tag */}
          <div className="space-y-2">
            <Label htmlFor="imageTag">Image Tag</Label>
            <Select value={imageTag} onValueChange={setImageTag} disabled={isSubmitting}>
              <SelectTrigger id="imageTag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">latest (v2.1.0)</SelectItem>
                <SelectItem value="2.1.0">2.1.0</SelectItem>
                <SelectItem value="2.1">2.1</SelectItem>
                <SelectItem value="2.0.1">2.0.1</SelectItem>
                <SelectItem value="2.0.0">2.0.0</SelectItem>
              </SelectContent>
            </Select>
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
    </Dialog>
  );
}
