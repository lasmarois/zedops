import { useState, useEffect } from "react"
import { MetricsRow } from "./MetricsRow"
import { ServerInfoCard } from "./ServerInfoCard"
import { ConnectionCard } from "./ConnectionCard"
import { HealthIndicators } from "./HealthIndicators"
import { QuickActions } from "./QuickActions"
import { RecentEvents } from "./RecentEvents"
import { LayoutSwitcher, type OverviewLayout } from "./LayoutSwitcher"

interface ServerOverviewProps {
  server: {
    id: string
    name: string
    status: string
    health?: string | null
    image_tag?: string | null
    config?: string | null
    server_data_path?: string | null
    game_port: number
    udp_port: number
    player_count?: number | null
    max_players?: number | null
    players?: string[] | null
  }
  agentDefaultDataPath?: string | null
  agentPublicIp?: string | null // P7: Agent's public IP for connection card
  metrics?: {
    uptime?: string
    cpuPercent?: number
    memoryUsedMB?: number
    memoryLimitMB?: number
    diskReadMB?: number
    diskWriteMB?: number
  } | null
  onPlayersClick: () => void
  onNavigateToRcon: () => void
}

const LAYOUT_STORAGE_KEY = 'zedops-server-overview-layout'
const DEFAULT_LAYOUT: OverviewLayout = 'sidebar'

export function ServerOverview({
  server,
  agentDefaultDataPath,
  agentPublicIp,
  metrics,
  onPlayersClick,
  onNavigateToRcon,
}: ServerOverviewProps) {
  // Layout state with localStorage persistence
  const [layout, setLayout] = useState<OverviewLayout>(() => {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY)
    return (saved as OverviewLayout) || DEFAULT_LAYOUT
  })

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, layout)
  }, [layout])

  // Parse config
  const config = server.config ? JSON.parse(server.config) : {}
  const isRunning = server.status === 'running'

  // Prepare metrics data
  const uptime = metrics?.uptime || "N/A"
  const cpuPercent = metrics?.cpuPercent || 0
  const memoryUsedGB = metrics?.memoryUsedMB ? metrics.memoryUsedMB / 1024 : 0
  const memoryLimitGB = metrics?.memoryLimitMB ? metrics.memoryLimitMB / 1024 : 0
  const diskReadGB = metrics?.diskReadMB ? metrics.diskReadMB / 1024 : 0
  const diskWriteGB = metrics?.diskWriteMB ? metrics.diskWriteMB / 1024 : 0

  // Player data
  const playerCount = server.player_count ?? 0
  const maxPlayers = server.max_players ?? 32
  const playerNames = server.players ?? []

  // Shared components
  const metricsRow = (
    <MetricsRow
      uptime={uptime}
      cpuPercent={cpuPercent}
      memoryUsedGB={memoryUsedGB}
      memoryLimitGB={memoryLimitGB}
      diskReadGB={diskReadGB}
      diskWriteGB={diskWriteGB}
      playerCount={playerCount}
      maxPlayers={maxPlayers}
      playerNames={playerNames}
      isRunning={isRunning}
      onPlayersClick={onPlayersClick}
    />
  )

  const serverInfoCard = (
    <ServerInfoCard
      imageTag={server.image_tag || null}
      config={config}
      serverDataPath={server.server_data_path || null}
      agentDefaultDataPath={agentDefaultDataPath || null}
    />
  )

  const connectionCard = (
    <ConnectionCard
      serverIp={agentPublicIp}
      gamePort={server.game_port}
      udpPort={server.udp_port}
    />
  )

  const healthIndicators = (
    <HealthIndicators
      containerHealth={server.health || null}
      isRunning={isRunning}
    />
  )

  const quickActions = (
    <QuickActions
      isRunning={isRunning}
      onNavigateToRcon={onNavigateToRcon}
    />
  )

  const recentEvents = (
    <RecentEvents
      serverId={server.id}
      serverName={server.name}
    />
  )

  // Render layout based on selection
  const renderLayout = () => {
    switch (layout) {
      case 'grid':
        return (
          <div className="space-y-6">
            {metricsRow}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                {serverInfoCard}
                {connectionCard}
                {quickActions}
              </div>
              <div className="space-y-6">
                {recentEvents}
                {healthIndicators}
              </div>
            </div>
          </div>
        )

      case 'stacked':
        return (
          <div className="space-y-6">
            {metricsRow}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {serverInfoCard}
              {connectionCard}
            </div>
            {quickActions}
            {recentEvents}
            {healthIndicators}
          </div>
        )

      case 'masonry':
        return (
          <div className="space-y-6">
            {metricsRow}
            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
              <div className="break-inside-avoid">{serverInfoCard}</div>
              <div className="break-inside-avoid">{connectionCard}</div>
              <div className="break-inside-avoid">{healthIndicators}</div>
              <div className="break-inside-avoid">{quickActions}</div>
              <div className="break-inside-avoid">{recentEvents}</div>
            </div>
          </div>
        )

      case 'sidebar':
        return (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar - Info/Connection/Health */}
            <div className="lg:w-80 shrink-0 space-y-6">
              {serverInfoCard}
              {connectionCard}
              {healthIndicators}
            </div>
            {/* Main content */}
            <div className="flex-1 space-y-6">
              {metricsRow}
              {recentEvents}
              {quickActions}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Layout Switcher Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Server Overview</h2>
        <LayoutSwitcher value={layout} onChange={setLayout} />
      </div>

      {/* Layout Content */}
      {renderLayout()}
    </div>
  )
}
