/**
 * Configuration Edit Component
 *
 * Allows editing of mutable server configuration settings
 * Shows immutable fields as disabled with lock icons
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Lock } from 'lucide-react'
import type { Server } from '../lib/api'
import { fetchRegistryTags } from '../lib/api'

interface ConfigurationEditProps {
  server: Server
  // M9.8.32: Added image parameter for per-server registry override
  onSave: (config: Record<string, string>, imageTag?: string, serverDataPath?: string | null, image?: string | null) => void
  onCancel: () => void
  isSaving: boolean
}

export function ConfigurationEdit({ server, onSave, onCancel, isSaving }: ConfigurationEditProps) {
  // Parse config JSON
  const config = server.config ? JSON.parse(server.config) : {}

  // Form state
  const [serverPublicName, setServerPublicName] = useState(config.SERVER_PUBLIC_NAME || '')
  const [adminPassword, setAdminPassword] = useState(config.ADMIN_PASSWORD || '')
  const [serverPassword, setServerPassword] = useState(config.SERVER_PASSWORD || '')
  // M9.8.32: Image registry (empty = use agent default)
  const [image, setImage] = useState(server.image || '')
  const [imageTag, setImageTag] = useState(server.image_tag || 'latest')
  const [serverDataPath, setServerDataPath] = useState(server.server_data_path || '')
  const [betaBranch, setBetaBranch] = useState(config.BETABRANCH || 'none')
  const [timezone, setTimezone] = useState(config.TZ || 'UTC')
  const [puid, setPuid] = useState(config.PUID || '')

  // Game settings
  const [maxPlayers, setMaxPlayers] = useState(config.SERVER_MAX_PLAYERS || '')
  const [serverMap, setServerMap] = useState(config.SERVER_MAP || '')
  const [serverPublic, setServerPublic] = useState(config.SERVER_PUBLIC || '')
  const [serverOpen, setServerOpen] = useState(config.SERVER_OPEN || '')
  const [serverPvp, setServerPvp] = useState(config.SERVER_PVP || '')
  const [pauseEmpty, setPauseEmpty] = useState(config.SERVER_PAUSE_EMPTY || '')
  const [globalChat, setGlobalChat] = useState(config.SERVER_GLOBAL_CHAT || '')
  const [welcomeMessage, setWelcomeMessage] = useState(config.SERVER_WELCOME_MESSAGE || '')
  const [publicDescription, setPublicDescription] = useState(config.SERVER_PUBLIC_DESCRIPTION || '')

  // Mod management
  const [serverMods, setServerMods] = useState(config.SERVER_MODS || '')
  const [workshopItems, setWorkshopItems] = useState(config.SERVER_WORKSHOP_ITEMS || '')

  // Fetch available image tags from registry
  const { data: registryTags, isLoading: tagsLoading } = useQuery({
    queryKey: ['registryTags', server.agent_id, image || server.steam_zomboid_registry],
    queryFn: () => fetchRegistryTags(server.agent_id, image || undefined),
    enabled: !!server.agent_id,
    staleTime: 5 * 60 * 1000,
  })

  // Helper to render immutable field (read-only)
  const renderImmutableField = (label: string, value: string | number) => {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="h-3 w-3 text-muted-foreground" />
          <Label className="text-muted-foreground">{label}</Label>
        </div>
        <Input
          value={value}
          disabled
          className="bg-muted cursor-not-allowed"
          title="Cannot be changed after creation"
        />
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Build config object (only include non-empty values)
    const newConfig: Record<string, string> = {
      ...config, // Preserve existing fields
      SERVER_PUBLIC_NAME: serverPublicName,
      ADMIN_PASSWORD: adminPassword,
    }

    // Optional fields
    if (serverPassword) {
      newConfig.SERVER_PASSWORD = serverPassword
    }
    if (betaBranch && betaBranch !== 'none') {
      newConfig.BETABRANCH = betaBranch
    }
    if (timezone) {
      newConfig.TZ = timezone
    }
    if (puid) {
      newConfig.PUID = puid
    }

    // Game settings (only include non-empty values)
    if (maxPlayers) newConfig.SERVER_MAX_PLAYERS = maxPlayers
    else delete newConfig.SERVER_MAX_PLAYERS
    if (serverMap) newConfig.SERVER_MAP = serverMap
    else delete newConfig.SERVER_MAP
    if (serverPublic) newConfig.SERVER_PUBLIC = serverPublic
    else delete newConfig.SERVER_PUBLIC
    if (serverOpen) newConfig.SERVER_OPEN = serverOpen
    else delete newConfig.SERVER_OPEN
    if (serverPvp) newConfig.SERVER_PVP = serverPvp
    else delete newConfig.SERVER_PVP
    if (pauseEmpty) newConfig.SERVER_PAUSE_EMPTY = pauseEmpty
    else delete newConfig.SERVER_PAUSE_EMPTY
    if (globalChat) newConfig.SERVER_GLOBAL_CHAT = globalChat
    else delete newConfig.SERVER_GLOBAL_CHAT
    if (welcomeMessage) newConfig.SERVER_WELCOME_MESSAGE = welcomeMessage
    else delete newConfig.SERVER_WELCOME_MESSAGE
    if (publicDescription) newConfig.SERVER_PUBLIC_DESCRIPTION = publicDescription
    else delete newConfig.SERVER_PUBLIC_DESCRIPTION

    // Mod management
    if (serverMods) newConfig.SERVER_MODS = serverMods
    else delete newConfig.SERVER_MODS
    if (workshopItems) newConfig.SERVER_WORKSHOP_ITEMS = workshopItems
    else delete newConfig.SERVER_WORKSHOP_ITEMS

    // RCON password (use admin password if not set)
    if (!config.RCON_PASSWORD) {
      newConfig.RCON_PASSWORD = adminPassword
    }

    // M9.8.32: Pass image (empty string = null = use agent default)
    onSave(
      newConfig,
      imageTag,
      serverDataPath || null,
      image || null
    )
  }

  // Agent's default path (always shown in hint, regardless of server override)
  const agentDefaultPath = server.agent_server_data_path || '/var/lib/zedops/servers'
  // Current effective path (used as placeholder)
  const currentDataPath = server.server_data_path || agentDefaultPath

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Server Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Server Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderImmutableField('Server Name', server.name)}

          <div className="space-y-2">
            <Label htmlFor="publicName">Public Name</Label>
            <Input
              id="publicName"
              value={serverPublicName}
              onChange={(e) => setServerPublicName(e.target.value)}
              placeholder="My Awesome Server"
            />
          </div>

          {renderImmutableField('Agent', server.agent_name)}
        </CardContent>
      </Card>

      {/* Network */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Network</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderImmutableField('Game Port', server.game_port)}
          {renderImmutableField('UDP Port', server.udp_port)}
          {renderImmutableField('RCON Port', server.rcon_port)}
        </CardContent>
      </Card>

      {/* Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Access Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminPassword">Admin Password *</Label>
            <Input
              id="adminPassword"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
              placeholder="Enter admin password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serverPassword">Server Password (Optional)</Label>
            <Input
              id="serverPassword"
              type="password"
              value={serverPassword}
              onChange={(e) => setServerPassword(e.target.value)}
              placeholder="Leave empty for public server"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to allow anyone to join
            </p>
          </div>

          <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
            <strong>RCON Password:</strong> {config.RCON_PASSWORD ? 'Set (will not be changed)' : 'Uses admin password'}
          </div>
        </CardContent>
      </Card>

      {/* Game Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Game Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editMaxPlayers">Max Players</Label>
              <Input
                id="editMaxPlayers"
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                placeholder="32"
                min="1"
                max="100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editServerMap">Map</Label>
              <Input
                id="editServerMap"
                value={serverMap}
                onChange={(e) => setServerMap(e.target.value)}
                placeholder="Muldraugh, KY"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editServerPublic">Public (Server Browser)</Label>
              <select
                id="editServerPublic"
                value={serverPublic}
                onChange={(e) => setServerPublic(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Default</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editServerOpen">Open (No Whitelist)</Label>
              <select
                id="editServerOpen"
                value={serverOpen}
                onChange={(e) => setServerOpen(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Default</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editServerPvp">PvP</Label>
              <select
                id="editServerPvp"
                value={serverPvp}
                onChange={(e) => setServerPvp(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Default</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPauseEmpty">Pause When Empty</Label>
              <select
                id="editPauseEmpty"
                value={pauseEmpty}
                onChange={(e) => setPauseEmpty(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Default</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editGlobalChat">Global Chat</Label>
              <select
                id="editGlobalChat"
                value={globalChat}
                onChange={(e) => setGlobalChat(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Default</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editWelcomeMessage">Welcome Message</Label>
            <textarea
              id="editWelcomeMessage"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Welcome to our server!"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editPublicDescription">Public Description</Label>
            <textarea
              id="editPublicDescription"
              value={publicDescription}
              onChange={(e) => setPublicDescription(e.target.value)}
              placeholder="Server description for server browser"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mod Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mod Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editServerMods">Server Mods</Label>
            <textarea
              id="editServerMods"
              value={serverMods}
              onChange={(e) => setServerMods(e.target.value)}
              placeholder="ModID1;ModID2;ModID3"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <p className="text-xs text-muted-foreground">
              Semicolon-separated list of mod IDs (e.g. <code>Mod1;Mod2;Mod3</code>)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editWorkshopItems">Workshop Items</Label>
            <textarea
              id="editWorkshopItems"
              value={workshopItems}
              onChange={(e) => setWorkshopItems(e.target.value)}
              placeholder="123456789;987654321"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <p className="text-xs text-muted-foreground">
              Semicolon-separated list of Steam Workshop item IDs
            </p>
          </div>

          <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
            <strong>Note:</strong> Mods are merged with existing mods on the server. Removing a mod here will not uninstall it — clear the server's mod list manually if needed.
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Advanced Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* M9.8.32: Image Registry field */}
          <div className="space-y-2">
            <Label htmlFor="image">Image Registry</Label>
            <Input
              id="image"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder={server.steam_zomboid_registry || 'registry.example.com/steam-zomboid'}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use agent default: {server.steam_zomboid_registry || 'Not configured'}
            </p>
            {image && image !== server.image && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Custom registry will be used on next rebuild
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageTag">Image Tag</Label>
            {tagsLoading ? (
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                Loading tags...
              </div>
            ) : registryTags && registryTags.length > 0 ? (
              <Select value={imageTag} onValueChange={setImageTag}>
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
                value={imageTag}
                onChange={(e) => setImageTag(e.target.value)}
                placeholder="latest"
              />
            )}
            <p className="text-xs text-muted-foreground">
              {registryTags ? `${registryTags.length} tags available — ` : ''}Only affects next rebuild
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="betaBranch">Beta Branch</Label>
            <select
              id="betaBranch"
              value={betaBranch}
              onChange={(e) => setBetaBranch(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="none">none (stable)</option>
              <option value="unstable">unstable</option>
              <option value="iwillbackupmysave">iwillbackupmysave (Build 41)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataPath">Data Path</Label>
            <Input
              id="dataPath"
              value={serverDataPath}
              onChange={(e) => setServerDataPath(e.target.value)}
              placeholder={currentDataPath}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use agent default: {agentDefaultPath}
            </p>
            {serverDataPath && serverDataPath !== server.server_data_path && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                ⚠️ Changing data path will require data migration when applied
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="puid">User ID (PUID)</Label>
            <Input
              id="puid"
              value={puid}
              onChange={(e) => setPuid(e.target.value)}
              placeholder="1430"
            />
            <p className="text-xs text-muted-foreground">
              Default: 1430 (steam-zomboid image default)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving || !adminPassword}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
