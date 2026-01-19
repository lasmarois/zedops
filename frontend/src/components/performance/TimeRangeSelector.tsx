import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { MetricsTimeRange } from "@/lib/api"

interface TimeRangeSelectorProps {
  value: MetricsTimeRange
  onChange: (range: MetricsTimeRange) => void
}

const TIME_RANGES: { value: MetricsTimeRange; label: string }[] = [
  { value: '30m', label: '30m' },
  { value: '3h', label: '3h' },
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
  { value: '3d', label: '3d' },
]

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-border overflow-hidden">
        {TIME_RANGES.map((range) => (
          <Button
            key={range.value}
            variant={value === range.value ? "default" : "ghost"}
            size="sm"
            className={`rounded-none px-3 h-8 ${
              value === range.value
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'hover:bg-muted'
            }`}
            onClick={() => onChange(range.value)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      {/* Data retention info */}
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
              <Info className="h-3.5 w-3.5" />
              <span>Data retained: 3 days</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Metrics are collected every 10 seconds.</p>
            <p>Historical data is retained for 3 days.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
