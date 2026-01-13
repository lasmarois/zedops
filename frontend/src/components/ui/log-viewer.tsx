import { useState } from "react"
import { Card, CardContent } from "./card"
import { Button } from "./button"
import { cn } from "@/lib/utils"

interface LogEntry {
  timestamp: string
  level: "INFO" | "DEBUG" | "WARN" | "ERROR"
  message: string
  details?: {
    stackTrace?: string
    context?: Record<string, string>
  }
}

interface LogViewerProps {
  logs: LogEntry[]
  className?: string
}

export function LogViewer({ logs, className }: LogViewerProps) {
  const [collapsedErrors, setCollapsedErrors] = useState<Set<number>>(new Set())

  const toggleErrorCollapse = (index: number) => {
    setCollapsedErrors((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  return (
    <div className={cn("font-mono text-sm space-y-1", className)}>
      {logs.map((log, i) => {
        // Normal logs: compact terminal style
        if (log.level === "INFO" || log.level === "DEBUG") {
          return (
            <div key={i} className="text-muted-foreground leading-relaxed">
              <span className="text-muted-foreground">[{log.timestamp}]</span>
              {" "}
              <span className={cn(log.level === "DEBUG" && "text-info")}>
                [{log.level}]
              </span>
              {" "}
              <span className="text-foreground">{log.message}</span>
            </div>
          )
        }

        // Warnings: highlighted line
        if (log.level === "WARN") {
          return (
            <div key={i} className="text-warning leading-relaxed">
              <span className="text-muted-foreground">[{log.timestamp}]</span>
              {" "}
              <span>[WARN]</span>
              {" "}
              {log.message}
            </div>
          )
        }

        // Errors: auto-expanded card (or collapsed if manually collapsed)
        const isCollapsed = collapsedErrors.has(i)

        return (
          <Card key={i} className="bg-muted border-error/20 my-2">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="font-mono text-sm flex-1">
                  <span className="text-muted-foreground">[{log.timestamp}]</span>
                  {" "}
                  <span className="text-error font-semibold">[ERROR]</span>
                  {" "}
                  <span className="text-foreground">{log.message}</span>
                </div>
                {log.details && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleErrorCollapse(i)}
                    className="flex-shrink-0"
                  >
                    {isCollapsed ? "Expand ▼" : "Collapse ▲"}
                  </Button>
                )}
              </div>

              {!isCollapsed && log.details && (
                <div className="mt-3 space-y-2 text-sm">
                  {log.details.context && (
                    <>
                      <div className="text-muted-foreground">Details:</div>
                      <ul className="space-y-1 ml-4">
                        {Object.entries(log.details.context).map(([key, value]) => (
                          <li key={key} className="text-foreground">
                            • {key}: {value}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {log.details.stackTrace && (
                    <>
                      <div className="text-muted-foreground mt-3">Stack trace:</div>
                      <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto text-foreground">
                        {log.details.stackTrace}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Usage example:
// const logs: LogEntry[] = [
//   {
//     timestamp: "12:34:56",
//     level: "INFO",
//     message: "Server started on port 16261"
//   },
//   {
//     timestamp: "12:35:45",
//     level: "WARN",
//     message: "High memory usage (1.8GB/2GB)"
//   },
//   {
//     timestamp: "12:36:12",
//     level: "ERROR",
//     message: "Connection timeout to Steam API",
//     details: {
//       context: {
//         "Endpoint": "api.steampowered.com:443",
//         "Timeout": "30 seconds",
//         "Retry": "Attempt 1/3"
//       },
//       stackTrace: "at SteamClient.connect (steam.js:45)\nat GameServer.init (server.js:123)"
//     }
//   }
// ]
// <LogViewer logs={logs} />
