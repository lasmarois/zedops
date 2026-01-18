import { useState } from "react"
import { ChevronDown, ChevronUp, User } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getAuditActionColor,
  getAuditActionIcon,
  getTargetTypeIcon,
  getTargetTypeColor,
  type AuditActionColor,
} from "@/lib/audit-colors"

export interface AuditLogEntry {
  id: string
  timestamp: string
  user: string
  action: string
  targetType: string
  targetName: string
  details?: Record<string, string>
}

interface CompactAuditLogProps {
  entries: AuditLogEntry[]
}

const colorClasses: Record<AuditActionColor, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
  muted: "text-muted-foreground",
}

export function CompactAuditLog({ entries }: CompactAuditLogProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-0.5">
      {entries.map((entry) => {
        const actionColor = getAuditActionColor(entry.action)
        const ActionIcon = getAuditActionIcon(entry.action)
        const targetColor = getTargetTypeColor(entry.targetType)
        const TargetIcon = getTargetTypeIcon(entry.targetType)
        const isExpanded = expanded === entry.id

        return (
          <div key={entry.id}>
            <div
              className={cn(
                "grid grid-cols-[180px_120px_1fr_70px_auto] items-center gap-4 px-3 py-2 rounded-md text-sm",
                "hover:bg-muted/50 transition-colors cursor-pointer",
                isExpanded && "bg-muted/30"
              )}
              onClick={() => setExpanded(isExpanded ? null : entry.id)}
            >
              {/* Action: icon + text */}
              <div className={cn("flex items-center gap-2", colorClasses[actionColor])}>
                <ActionIcon className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium truncate">
                  {entry.action.replace(/[._]/g, ' ')}
                </span>
              </div>

              {/* Actor with user icon */}
              <div className="flex items-center gap-1.5 text-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{entry.user}</span>
              </div>

              {/* Target: icon + text */}
              <div className={cn("flex items-center gap-2 min-w-0", colorClasses[targetColor])}>
                <TargetIcon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {entry.targetName || entry.targetType}
                </span>
              </div>

              {/* Timestamp */}
              <span className="text-muted-foreground text-xs text-right">
                {entry.timestamp}
              </span>

              {/* Expand button */}
              {entry.details ? (
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors justify-end"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(isExpanded ? null : entry.id)
                  }}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span />
              )}
            </div>

            {/* Expanded details */}
            {isExpanded && entry.details && (
              <div className="ml-6 mr-3 mb-2 mt-1 p-3 rounded-md border border-border bg-card/50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {Object.entries(entry.details).map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="text-muted-foreground">{key}:</dt>
                      <dd className="text-foreground font-mono text-xs">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
