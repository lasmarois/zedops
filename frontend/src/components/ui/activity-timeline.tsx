import { useState } from "react"
import { Button } from "./button"
import { Card, CardContent } from "./card"
import { Separator } from "./separator"
import { cn } from "@/lib/utils"

interface ActivityEvent {
  id: string
  timestamp: string
  user: string
  action: string
  target: string
  actionColor: "success" | "warning" | "error" | "info" | "muted"
  icon?: "check" | "alert" | "cross" | "info" | "dot" | "pulse"
  details?: Record<string, string>
}

interface ActivityTimelineProps {
  events: ActivityEvent[]
}

// Timeline icon components (matching StatusBadge design)
const TimelineIcons = {
  dot: ({ color }: { color: string }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" className={color}>
      <circle cx="6" cy="6" r="4" fill="currentColor" />
    </svg>
  ),
  pulse: ({ color }: { color: string }) => (
    <span className="relative flex h-3 w-3">
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", color)}></span>
      <span className={cn("relative inline-flex rounded-full h-3 w-3", color)}></span>
    </span>
  ),
  check: ({ color }: { color: string }) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className={color}>
      <path d="M2.5 7L5.5 10L11.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  alert: ({ color }: { color: string }) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className={color}>
      <path d="M7 4.5V8M7 10V10.5" strokeLinecap="round" />
      <path d="M7 1.5L1.5 11.5H12.5L7 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cross: ({ color }: { color: string }) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className={color}>
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: ({ color }: { color: string }) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className={color}>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M7 6V10M7 4V4.5" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  ),
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // Auto-select icon based on action color if not specified
  const getIcon = (event: ActivityEvent): keyof typeof TimelineIcons => {
    if (event.icon) return event.icon

    // Smart defaults based on action color
    switch (event.actionColor) {
      case "success": return "check"
      case "error": return "cross"
      case "warning": return "alert"
      case "info": return "info"
      default: return "dot"
    }
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const IconComponent = TimelineIcons[getIcon(event)]
        const colorClass = cn(
          event.actionColor === "success" && "text-success bg-success",
          event.actionColor === "warning" && "text-warning bg-warning",
          event.actionColor === "error" && "text-error bg-error",
          event.actionColor === "info" && "text-info bg-info",
          event.actionColor === "muted" && "text-muted-foreground bg-muted-foreground"
        )

        return (
          <div
            key={event.id}
            className="group hover:bg-muted/30 rounded-lg transition-all duration-200 border border-transparent hover:border-border hover:shadow-sm overflow-hidden"
          >
            <div className="flex items-stretch">
              {/* Vertical bar with glow */}
              <div className="relative flex-shrink-0 w-1">
                {/* Glow effect */}
                <div className={cn(
                  "absolute inset-0 blur-sm opacity-40",
                  colorClass
                )} />
                {/* Solid bar */}
                <div className={cn(
                  "relative h-full w-full",
                  event.actionColor === "success" && "bg-success",
                  event.actionColor === "warning" && "bg-warning",
                  event.actionColor === "error" && "bg-error",
                  event.actionColor === "info" && "bg-info",
                  event.actionColor === "muted" && "bg-muted-foreground"
                )} />
              </div>

              <div className="flex-1 min-w-0 p-3">
                {/* Header: User + timestamp */}
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-foreground">{event.user}</span>
                  <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                  {event.details && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1.5 text-xs ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setExpanded(expanded === event.id ? null : event.id)}
                    >
                      {expanded === event.id ? (
                        <span className="flex items-center gap-0.5">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 7L6 4L9 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Hide
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 5L6 8L9 5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Details
                        </span>
                      )}
                    </Button>
                  )}
                </div>

                {/* Action badge + target */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset",
                      event.actionColor === "success" && "bg-success/10 text-success ring-success/20",
                      event.actionColor === "warning" && "bg-warning/10 text-warning ring-warning/20",
                      event.actionColor === "error" && "bg-error/10 text-error ring-error/20",
                      event.actionColor === "info" && "bg-info/10 text-info ring-info/20",
                      event.actionColor === "muted" && "bg-muted/10 text-muted-foreground ring-muted/20"
                    )}
                  >
                    {event.action}
                  </span>
                  <span className="text-sm text-foreground/90">{event.target}</span>
                </div>

                {/* Expanded details with enhanced styling */}
                {expanded === event.id && event.details && (
                  <div className="mt-3 rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4 animate-in fade-in-50 slide-in-from-top-2 duration-200">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Event Details</h4>
                    <dl className="grid gap-2 text-sm">
                      {Object.entries(event.details).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <dt className="text-muted-foreground min-w-[120px] font-medium">{key}:</dt>
                          <dd className="text-foreground flex-1 font-mono text-xs">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Usage example:
// const events: ActivityEvent[] = [
//   {
//     id: "1",
//     timestamp: "2 minutes ago",
//     user: "admin",
//     action: "started",
//     target: "server jeanguy",
//     actionColor: "success",
//     details: {
//       "Event ID": "evt_1234567890",
//       "Duration": "2.3 seconds",
//       "Status": "Success"
//     }
//   },
// ]
// <ActivityTimeline events={events} />
