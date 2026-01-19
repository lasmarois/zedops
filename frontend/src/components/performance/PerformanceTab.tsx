import { useState, useMemo } from 'react'
import { Cpu, MemoryStick, Users } from 'lucide-react'
import { TimeRangeSelector } from './TimeRangeSelector'
import { MetricsChart } from './MetricsChart'
import { useServerMetricsHistory } from '@/hooks/useServers'
import type { MetricsTimeRange } from '@/lib/api'

interface PerformanceTabProps {
  serverId: string
  isRunning: boolean
}

export function PerformanceTab({ serverId, isRunning }: PerformanceTabProps) {
  const [timeRange, setTimeRange] = useState<MetricsTimeRange>('30m')

  // Fetch metrics history
  const { data: metricsHistory, isLoading } = useServerMetricsHistory(
    serverId,
    timeRange,
    isRunning
  )

  // Transform data for charts
  const { cpuData, memoryData, playerData } = useMemo(() => {
    if (!metricsHistory?.points) {
      return { cpuData: [], memoryData: [], playerData: [] }
    }

    return {
      cpuData: metricsHistory.points.map(p => ({
        timestamp: p.timestamp,
        value: p.cpu,
      })),
      memoryData: metricsHistory.points.map(p => ({
        timestamp: p.timestamp,
        value: p.memory,
      })),
      playerData: metricsHistory.points.map(p => ({
        timestamp: p.timestamp,
        value: p.players,
      })),
    }
  }, [metricsHistory])

  if (!isRunning) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground mb-2">Server is not running</div>
        <p className="text-sm text-muted-foreground">
          Start the server to view performance metrics.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Performance Metrics</h3>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          Loading metrics...
        </div>
      )}

      {/* Charts */}
      {!isLoading && (
        <div className="grid gap-6">
          {/* CPU Chart */}
          <MetricsChart
            title="CPU Usage"
            icon={Cpu}
            data={cpuData}
            color="hsl(var(--chart-1, 220 70% 50%))"
            unit="%"
            formatValue={(v) => v.toFixed(1)}
            domain={[0, 100]}
          />

          {/* Memory Chart */}
          <MetricsChart
            title="Memory Usage"
            icon={MemoryStick}
            data={memoryData}
            color="hsl(var(--chart-2, 160 60% 45%))"
            unit="%"
            formatValue={(v) => v.toFixed(1)}
            domain={[0, 100]}
          />

          {/* Player Count Chart */}
          <MetricsChart
            title="Player Count"
            icon={Users}
            data={playerData}
            color="hsl(var(--chart-3, 30 80% 55%))"
            unit=""
            formatValue={(v) => Math.round(v).toString()}
            domain={[0, 'auto']}
          />
        </div>
      )}

      {/* Data Info */}
      {!isLoading && metricsHistory?.count !== undefined && (
        <div className="text-xs text-muted-foreground text-center">
          Showing {metricsHistory.count} data points
          {timeRange === '12h' && ' (1-minute averages)'}
          {timeRange === '24h' && ' (5-minute averages)'}
          {timeRange === '3d' && ' (15-minute averages)'}
        </div>
      )}
    </div>
  )
}
