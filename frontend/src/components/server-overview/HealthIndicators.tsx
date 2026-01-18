import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Container, HardDrive } from "lucide-react"

interface HealthIndicatorsProps {
  containerHealth: string | null
  isRunning: boolean
  rconConnected?: boolean
  diskUsagePercent?: number
}

type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown'

function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-success'
    case 'warning':
      return 'bg-warning'
    case 'error':
      return 'bg-destructive'
    default:
      return 'bg-muted-foreground'
  }
}

function getStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'warning':
      return 'Warning'
    case 'error':
      return 'Error'
    default:
      return 'Unknown'
  }
}

interface IndicatorProps {
  icon: React.ReactNode
  label: string
  status: HealthStatus
  detail?: string
}

function Indicator({ icon, label, status, detail }: IndicatorProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${getStatusColor(status)}`} />
          <span className="text-xs font-medium">{getStatusLabel(status)}</span>
        </div>
      </div>
    </div>
  )
}

export function HealthIndicators({
  containerHealth,
  isRunning,
  rconConnected,
  diskUsagePercent,
}: HealthIndicatorsProps) {
  // Determine container status
  const containerStatus: HealthStatus = !isRunning
    ? 'unknown'
    : containerHealth === 'healthy'
    ? 'healthy'
    : containerHealth === 'unhealthy'
    ? 'error'
    : containerHealth === 'starting'
    ? 'warning'
    : 'unknown'

  // Determine RCON status (placeholder for now)
  const rconStatus: HealthStatus = !isRunning
    ? 'unknown'
    : rconConnected === true
    ? 'healthy'
    : rconConnected === false
    ? 'error'
    : 'unknown' // undefined means we don't know yet

  // Determine disk status
  const diskStatus: HealthStatus = diskUsagePercent === undefined
    ? 'unknown'
    : diskUsagePercent >= 90
    ? 'error'
    : diskUsagePercent >= 75
    ? 'warning'
    : 'healthy'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Health Status
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <Indicator
          icon={<Container className="h-4 w-4" />}
          label="Container"
          status={containerStatus}
          detail={containerHealth || undefined}
        />
        <Indicator
          icon={<Activity className="h-4 w-4" />}
          label="RCON"
          status={rconStatus}
          detail={rconConnected === undefined ? "Not checked" : undefined}
        />
        <Indicator
          icon={<HardDrive className="h-4 w-4" />}
          label="Disk Space"
          status={diskStatus}
          detail={diskUsagePercent !== undefined ? `${diskUsagePercent}% used` : undefined}
        />
      </CardContent>
    </Card>
  )
}
