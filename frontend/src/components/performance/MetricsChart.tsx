import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from 'lucide-react'

interface MetricsChartProps {
  title: string
  icon: LucideIcon
  data: { timestamp: number; value: number | null }[]
  color: string
  unit?: string
  formatValue?: (value: number) => string
  domain?: [number | 'auto', number | 'auto']
}

export function MetricsChart({
  title,
  icon: Icon,
  data,
  color,
  unit = '',
  formatValue = (v) => v.toFixed(1),
  domain = [0, 'auto'],
}: MetricsChartProps) {
  // Format data for Recharts
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: point.timestamp * 1000, // Convert to milliseconds
      value: point.value,
    }))
  }, [data])

  // Format timestamp for tooltip
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Format timestamp for X-axis
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: { value: number }[]
    label?: number
  }) => {
    if (!active || !payload || payload.length === 0 || payload[0].value === null) {
      return null
    }

    return (
      <div className="bg-popover border border-border rounded-lg p-2 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">
          {formatTimestamp(label || 0)}
        </p>
        <p className="text-sm font-medium">
          {formatValue(payload[0].value)}{unit}
        </p>
      </div>
    )
  }

  const hasData = chartData.some(d => d.value !== null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No data available for this time range
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatXAxis}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={50}
                />
                <YAxis
                  domain={domain}
                  tickFormatter={(v) => `${formatValue(v)}${unit}`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#gradient-${title})`}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
