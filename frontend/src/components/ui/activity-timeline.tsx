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
  details?: Record<string, string>
}

interface ActivityTimelineProps {
  events: ActivityEvent[]
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="group">
          <div className="flex items-start gap-3">
            {/* Timeline dot */}
            <div
              className={cn(
                "mt-1.5 h-2 w-2 rounded-full flex-shrink-0",
                event.actionColor === "success" && "bg-success",
                event.actionColor === "warning" && "bg-warning",
                event.actionColor === "error" && "bg-error",
                event.actionColor === "info" && "bg-info",
                event.actionColor === "muted" && "bg-muted-foreground"
              )}
            />

            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">{event.timestamp}</div>
              <div className="text-sm">
                <span className="text-primary font-medium">{event.user}</span>
                {" "}
                <span
                  className={cn(
                    "font-medium",
                    event.actionColor === "success" && "text-success",
                    event.actionColor === "warning" && "text-warning",
                    event.actionColor === "error" && "text-error",
                    event.actionColor === "info" && "text-info",
                    event.actionColor === "muted" && "text-muted-foreground"
                  )}
                >
                  {event.action}
                </span>
                {" "}
                <span className="text-foreground">{event.target}</span>
              </div>

              {/* Expanded details */}
              {expanded === event.id && event.details && (
                <Card className="mt-3 bg-muted border-border">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-semibold mb-3">Event Details</h4>
                    <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-sm">
                      {Object.entries(event.details).map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="text-muted-foreground">{key}:</dt>
                          <dd className="text-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              )}
            </div>

            {event.details && (
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setExpanded(expanded === event.id ? null : event.id)}
              >
                {expanded === event.id ? "Collapse ▲" : "Details ▼"}
              </Button>
            )}
          </div>

          <Separator className="my-4 opacity-30" />
        </div>
      ))}
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
