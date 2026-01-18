import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Container, HardDrive } from "lucide-react"

interface StorageInfo {
  binBytes: number
  dataBytes: number
  totalBytes: number
  mountPoint?: string
  diskTotalBytes?: number
  diskUsedBytes?: number
  diskFreeBytes?: number
}

interface HealthIndicatorsProps {
  containerHealth: string | null
  isRunning: boolean
  rconConnected?: boolean
  diskUsagePercent?: number
  storage?: StorageInfo | null
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
  storage,
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
        {/* Disk Space - Expanded section with storage details */}
        <div className="py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground"><HardDrive className="h-4 w-4" /></span>
              <span className="text-sm">Disk Space</span>
            </div>
            <div className="flex items-center gap-2">
              {diskUsagePercent !== undefined && (
                <span className="text-xs text-muted-foreground">{diskUsagePercent}% used</span>
              )}
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${getStatusColor(diskStatus)}`} />
                <span className="text-xs font-medium">{getStatusLabel(diskStatus)}</span>
              </div>
            </div>
          </div>
          {/* Storage details */}
          {storage ? (
            <div className="mt-2 ml-6 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>bin/</span>
                <span className="font-medium text-foreground">{formatBytes(storage.binBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span>data/</span>
                <span className="font-medium text-foreground">{formatBytes(storage.dataBytes)}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                <span>Server Total</span>
                <span className="font-medium text-foreground">{formatBytes(storage.totalBytes)}</span>
              </div>
              {storage.diskTotalBytes && storage.diskTotalBytes > 0 && (
                <div className="flex justify-between">
                  <span>Disk Capacity</span>
                  <span className="font-medium text-foreground">
                    {formatBytes(storage.diskUsedBytes || 0)} / {formatBytes(storage.diskTotalBytes)}
                  </span>
                </div>
              )}
              {storage.mountPoint && (
                <div className="flex justify-between">
                  <span>Mount</span>
                  <span className="font-mono text-foreground">{storage.mountPoint}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 ml-6 text-xs text-muted-foreground">
              Storage data unavailable
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
