import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Cpu, HardDrive, Users } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface MetricsRowProps {
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
}

// Placeholder sparkline component - shows "coming soon" styling
function SparklinePlaceholder() {
  return (
    <div className="h-8 mt-2 flex items-end gap-0.5 opacity-30">
      {[3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 7].map((h, i) => (
        <div
          key={i}
          className="w-1.5 bg-primary/40 rounded-sm"
          style={{ height: `${h * 3}px` }}
        />
      ))}
    </div>
  )
}

export function MetricsRow({
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
}: MetricsRowProps) {
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

      {/* CPU Card - with sparkline placeholder */}
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            CPU
          </CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isRunning ? `${cpuPercent.toFixed(1)}%` : "—"}
          </div>
          <SparklinePlaceholder />
        </CardContent>
      </Card>

      {/* Memory Card - with sparkline placeholder */}
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Memory
          </CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isRunning ? `${memoryUsedGB.toFixed(1)}GB` : "—"}
          </div>
          {isRunning && memoryLimitGB > 0 && (
            <div className="text-xs text-muted-foreground">
              of {memoryLimitGB.toFixed(1)}GB
            </div>
          )}
          <SparklinePlaceholder />
        </CardContent>
      </Card>

      {/* Disk I/O Card */}
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Disk I/O
          </CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isRunning ? (
            <>
              <div className="text-sm font-bold">↓ {diskReadGB.toFixed(2)}GB</div>
              <div className="text-sm font-bold">↑ {diskWriteGB.toFixed(2)}GB</div>
            </>
          ) : (
            <div className="text-2xl font-bold">—</div>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            Cumulative
          </div>
        </CardContent>
      </Card>

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
                <SparklinePlaceholder />
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
