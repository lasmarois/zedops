/**
 * Sparkline component for displaying metrics trends
 *
 * A simple SVG-based sparkline that auto-scales to the data range
 * Supports both line and bar styles
 */

import { useMemo } from 'react'

interface SparklineProps {
  data: (number | null)[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
  strokeWidth?: number
  style?: 'line' | 'bar'
  className?: string
}

export function Sparkline({
  data,
  width = 100,
  height = 32,
  color = 'currentColor',
  fillOpacity = 0.2,
  strokeWidth = 1.5,
  style = 'line',
  className = '',
}: SparklineProps) {
  const padding = 2

  // Filter out null values and calculate min/max
  const { points, min, range } = useMemo(() => {
    const validData = data.filter((v): v is number => v !== null && !isNaN(v))
    if (validData.length === 0) {
      return { points: [], min: 0, range: 100 }
    }

    const minVal = Math.min(...validData)
    const maxVal = Math.max(...validData)

    // Add some padding to the range
    const r = maxVal - minVal || 1
    const pad = r * 0.1
    const computedMin = Math.max(0, minVal - pad)
    const computedMax = maxVal + pad

    return {
      points: data,
      min: computedMin,
      range: computedMax - computedMin || 1,
    }
  }, [data])

  // Calculate line path data (always computed to avoid conditional hooks)
  const pathData = useMemo(() => {
    if (points.length === 0) return null

    const validPoints: { x: number; y: number }[] = []

    points.forEach((value, i) => {
      if (value !== null) {
        const x = (i / (points.length - 1 || 1)) * width
        const y = height - padding - ((value - min) / range) * (height - padding * 2)
        validPoints.push({ x, y })
      }
    })

    if (validPoints.length < 2) return null

    // Create smooth path
    const linePath = validPoints
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ')

    // Create fill path (closed to bottom)
    const fillPath = `${linePath} L ${validPoints[validPoints.length - 1].x} ${height} L ${validPoints[0].x} ${height} Z`

    return { linePath, fillPath }
  }, [points, width, height, min, range])

  // Early return after all hooks
  if (points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-muted-foreground ${className}`}
        style={{ width, height }}
      >
        No data
      </div>
    )
  }

  const barWidth = width / points.length

  if (style === 'bar') {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
      >
        {points.map((value, i) => {
          if (value === null) return null
          const barHeight = ((value - min) / range) * (height - padding * 2)
          return (
            <rect
              key={i}
              x={i * barWidth + barWidth * 0.1}
              y={height - padding - barHeight}
              width={barWidth * 0.8}
              height={Math.max(1, barHeight)}
              fill={color}
              opacity={0.7}
              rx={1}
            />
          )
        })}
      </svg>
    )
  }

  // Line style
  if (!pathData) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-muted-foreground ${className}`}
        style={{ width, height }}
      >
        Insufficient data
      </div>
    )
  }

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Fill area */}
      <path
        d={pathData.fillPath}
        fill={color}
        opacity={fillOpacity}
      />
      {/* Line */}
      <path
        d={pathData.linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * SparklineWithLabel - Sparkline with current value label
 */
interface SparklineWithLabelProps extends SparklineProps {
  label?: string
  value?: string | number
  unit?: string
}

export function SparklineWithLabel({
  label,
  value,
  unit,
  ...sparklineProps
}: SparklineWithLabelProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="text-xs text-muted-foreground">{label}</div>
      )}
      <div className="flex items-center gap-2">
        {value !== undefined && (
          <span className="text-sm font-medium">
            {value}{unit}
          </span>
        )}
        <Sparkline {...sparklineProps} />
      </div>
    </div>
  )
}
