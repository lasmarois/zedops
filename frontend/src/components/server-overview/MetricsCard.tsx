import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, ChevronRight, Cpu, HardDrive, MemoryStick } from "lucide-react"
import { Sparkline } from "@/components/ui/sparkline"

interface MetricsCardProps {
  cpuPercent: number
  memoryUsedGB: number
  memoryLimitGB: number
  diskReadGB: number
  diskWriteGB: number
  cpuData: (number | null)[]
  memoryData: (number | null)[]
  isRunning: boolean
  onViewDetails: () => void
}

export function MetricsCard({
  cpuPercent,
  memoryUsedGB,
  memoryLimitGB,
  diskReadGB,
  diskWriteGB,
  cpuData,
  memoryData,
  isRunning,
  onViewDetails,
}: MetricsCardProps) {
  return (
    <Card className="col-span-2 md:col-span-2 lg:col-span-3 hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Server Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 divide-x divide-border">
          {/* CPU Column */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Cpu className="h-3 w-3" />
              CPU
            </div>
            <div className="text-xl font-bold">
              {isRunning ? `${cpuPercent.toFixed(1)}%` : "—"}
            </div>
            {isRunning && (
              <div className="h-6 mt-2 w-full flex justify-center">
                <Sparkline
                  data={cpuData}
                  width={80}
                  height={24}
                  color="hsl(var(--primary))"
                  style="line"
                />
              </div>
            )}
          </div>

          {/* Memory Column */}
          <div className="flex flex-col items-center pl-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <MemoryStick className="h-3 w-3" />
              Memory
            </div>
            <div className="text-xl font-bold">
              {isRunning ? `${memoryUsedGB.toFixed(1)}GB` : "—"}
            </div>
            {isRunning && memoryLimitGB > 0 && (
              <div className="text-xs text-muted-foreground">
                / {memoryLimitGB.toFixed(1)}GB
              </div>
            )}
            {isRunning && (
              <div className="h-6 mt-1 w-full flex justify-center">
                <Sparkline
                  data={memoryData}
                  width={80}
                  height={24}
                  color="hsl(var(--primary))"
                  style="line"
                />
              </div>
            )}
          </div>

          {/* Disk I/O Column */}
          <div className="flex flex-col items-center pl-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <HardDrive className="h-3 w-3" />
              Disk I/O
            </div>
            {isRunning ? (
              <div className="text-center">
                <div className="text-sm font-bold">↓ {diskReadGB.toFixed(2)}GB</div>
                <div className="text-sm font-bold">↑ {diskWriteGB.toFixed(2)}GB</div>
              </div>
            ) : (
              <div className="text-xl font-bold">—</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              Cumulative
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <button
          onClick={onViewDetails}
          className="w-full mt-4 pt-3 border-t border-border text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
        >
          View Performance Details
          <ChevronRight className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  )
}
