import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Users } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkline } from "@/components/ui/sparkline"
import { useServerMetricsHistory } from "@/hooks/useServers"
import { MetricsCard } from "./MetricsCard"

interface MetricsRowProps {
  serverId: string
  uptime: string
  cpuPercent: number
  memoryUsedGB: number
  memoryLimitGB: number
  diskReadGB: number
  diskWriteGB: number
  playerCount: number
  maxPlayers: number
  playerNames: string[]
  isRunning: boolean
  onPlayersClick: () => void
  onNavigateToPerformance: () => void
}

export function MetricsRow({
  serverId,
  uptime,
  cpuPercent,
  memoryUsedGB,
  memoryLimitGB,
  diskReadGB,
  diskWriteGB,
  playerCount,
  maxPlayers,
  playerNames,
  isRunning,
  onPlayersClick,
  onNavigateToPerformance,
}: MetricsRowProps) {
  // Fetch metrics history for sparklines (only when server is running)
  const { data: metricsHistory } = useServerMetricsHistory(
    serverId,
    '30m',
    isRunning
  )

  // Extract data arrays for sparklines
  const { cpuData, memoryData, playerData } = useMemo(() => {
    if (!metricsHistory?.points || metricsHistory.points.length === 0) {
      return { cpuData: [], memoryData: [], playerData: [] }
    }
    return {
      cpuData: metricsHistory.points.map(p => p.cpu),
      memoryData: metricsHistory.points.map(p => p.memory),
      playerData: metricsHistory.points.map(p => p.players),
    }
  }, [metricsHistory])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* Uptime Card */}
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Uptime
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isRunning ? uptime : "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {isRunning ? "Server running" : "Server stopped"}
          </div>
        </CardContent>
      </Card>

      {/* Consolidated Metrics Card (CPU, Memory, Disk I/O) */}
      <MetricsCard
        cpuPercent={cpuPercent}
        memoryUsedGB={memoryUsedGB}
        memoryLimitGB={memoryLimitGB}
        diskReadGB={diskReadGB}
        diskWriteGB={diskWriteGB}
        cpuData={cpuData}
        memoryData={memoryData}
        isRunning={isRunning}
        onViewDetails={onNavigateToPerformance}
      />

      {/* Players Card - clickable with tooltip */}
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Card
              className="hover:shadow-md transition-shadow duration-200 cursor-pointer hover:border-primary/50"
              onClick={onPlayersClick}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Players
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isRunning ? `${playerCount}/${maxPlayers}` : "—"}
                </div>
                {isRunning && playerCount > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">Click to view</div>
                )}
                {isRunning && (
                  <div className="h-8 mt-2">
                    <Sparkline
                      data={playerData}
                      width={100}
                      height={32}
                      color="hsl(var(--primary))"
                      style="bar"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {!isRunning ? (
              <p>Server is stopped</p>
            ) : playerCount === 0 ? (
              <p>No players connected</p>
            ) : (
              <div className="space-y-1">
                <p className="font-medium text-xs text-muted-foreground mb-2">Connected Players:</p>
                {playerNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
