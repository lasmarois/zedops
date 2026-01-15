/**
 * Configuration Display Component
 *
 * Displays all server configuration settings in read-only format
 * Organized into logical sections with immutable fields marked
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import type { Server } from '../lib/api'
import { useImageDefaults } from '../hooks/useServers'

interface ConfigurationDisplayProps {
  server: Server
  onEdit?: () => void
}

export function ConfigurationDisplay({ server, onEdit }: ConfigurationDisplayProps) {
  // Parse config JSON
  const config = server.config ? JSON.parse(server.config) : {}

  // Query image defaults
  const { data: imageDefaults, isLoading: loadingDefaults } = useImageDefaults(
    server.agent_id,
    server.image_tag
  )

  // Helper to get default value from image
  const getDefault = (key: string, fallback: string): string => {
    if (loadingDefaults) return 'Loading...'
    return imageDefaults?.[key] || fallback
  }

  // Determine actual data path (custom or agent default)
  const actualDataPath = server.server_data_path || server.agent_server_data_path || '/var/lib/zedops/servers'
  const dataPathDisplay = server.server_data_path
    ? server.server_data_path
    : <span className="text-muted-foreground italic">Using agent default ({actualDataPath})</span>

  // Helper to render a config field
  const renderField = (
    label: string,
    value: string | number | undefined | null | React.ReactNode,
    immutable = false,
    sensitive = false
  ) => {
    const displayValue = value || <span className="text-muted-foreground italic">Not set</span>
    const maskedValue = sensitive && value ? '••••••••' : displayValue

    return (
      <div className="grid grid-cols-3 gap-4 py-3 border-b last:border-b-0">
        <div className="flex items-center gap-2">
          {immutable && (
            <span title="Cannot be changed after creation">
              <Lock className="h-3 w-3 text-muted-foreground" />
            </span>
          )}
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="col-span-2">
          <span className="text-sm">{maskedValue}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Server Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Server Identity</CardTitle>
        </CardHeader>
        <CardContent>
          {renderField('Server Name', server.name, true)}
          {renderField('Public Name', config.SERVER_PUBLIC_NAME)}
          {renderField('Agent', server.agent_name, true)}
        </CardContent>
      </Card>

      {/* Network */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Network</CardTitle>
        </CardHeader>
        <CardContent>
          {renderField('Game Port', server.game_port, true)}
          {renderField('UDP Port', server.udp_port, true)}
          {renderField('RCON Port', server.rcon_port, true)}
        </CardContent>
      </Card>

      {/* Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Access Control</CardTitle>
        </CardHeader>
        <CardContent>
          {renderField('Admin Password', config.ADMIN_PASSWORD, false, true)}
          {renderField('Server Password', config.SERVER_PASSWORD || 'None (public server)', false, config.SERVER_PASSWORD ? true : false)}
          {renderField('RCON Password', config.RCON_PASSWORD || (config.ADMIN_PASSWORD ? 'Same as admin password' : undefined), false, !!config.RCON_PASSWORD)}
        </CardContent>
      </Card>

      {/* Gameplay Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gameplay Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm text-muted-foreground py-4">
            <p>Additional gameplay settings (max players, PvP, pause empty, etc.) will be available once set via server configuration editing.</p>
            <p className="text-xs">These settings are stored as ENV variables in the container configuration.</p>
          </div>
        </CardContent>
      </Card>

      {/* Mods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mods</CardTitle>
        </CardHeader>
        <CardContent>
          {config.SERVER_MODS ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Installed Mods</p>
                <div className="flex flex-wrap gap-2">
                  {config.SERVER_MODS.split(';').map((mod: string, i: number) => (
                    <Badge key={i} variant="secondary">{mod}</Badge>
                  ))}
                </div>
              </div>
              {config.SERVER_WORKSHOP_ITEMS && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Workshop Item IDs</p>
                  <p className="text-sm text-muted-foreground">{config.SERVER_WORKSHOP_ITEMS}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic py-2">No mods installed</p>
          )}
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Advanced Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {/* M9.8.32: Show full image reference (image:tag) */}
          {renderField('Image', (() => {
            const effectiveImage = server.image || server.steam_zomboid_registry || 'Unknown'
            const fullRef = `${effectiveImage}:${server.image_tag}`
            const isCustom = server.image && server.image !== server.steam_zomboid_registry
            return isCustom ? (
              <span>{fullRef} <Badge variant="outline" className="ml-2 text-xs">Custom</Badge></span>
            ) : fullRef
          })())}
          {renderField('Beta Branch', config.BETA_BRANCH || 'none (stable)')}
          {renderField('Data Path', dataPathDisplay)}
          {renderField('Timezone', config.TZ || `${getDefault('TZ', 'UTC')} (image default)`)}
          {renderField('User ID (PUID)', config.PUID || `${getDefault('PUID', '1430')} (image default)`)}
        </CardContent>
      </Card>

      {/* Edit Button */}
      <div className="flex justify-end">
        <Button
          onClick={onEdit}
          disabled={!onEdit}
          variant="default"
        >
          Edit Configuration
        </Button>
      </div>
    </div>
  )
}
