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

// Log level icons (matching design system)
const LogIcons = {
  INFO: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-info">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M7 6V10M7 4V4.5" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  ),
  DEBUG: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
      <circle cx="7" cy="7" r="3" />
      <path d="M7 1V3M7 11V13M1 7H3M11 7H13" strokeLinecap="round" />
    </svg>
  ),
  WARN: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning">
      <path d="M7 4.5V8M7 10V10.5" strokeLinecap="round" />
      <path d="M7 1.5L1.5 11.5H12.5L7 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ERROR: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-error">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M4.5 4.5L9.5 9.5M9.5 4.5L4.5 9.5" strokeLinecap="round" />
    </svg>
  ),
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
        const LevelIcon = LogIcons[log.level]

        // INFO/DEBUG: compact terminal style with icon badge
        if (log.level === "INFO" || log.level === "DEBUG") {
          return (
            <div key={i} className="flex items-start gap-2 py-0.5 leading-relaxed group hover:bg-muted/5 rounded px-1 -mx-1">
              <div className="flex-shrink-0 mt-0.5">
                <LevelIcon />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground text-xs">{log.timestamp}</span>
                {" "}
                <span
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
                    log.level === "INFO" && "bg-info/10 text-info",
                    log.level === "DEBUG" && "bg-muted/10 text-muted-foreground"
                  )}
                >
                  {log.level}
                </span>
                {" "}
                <span className="text-foreground">{log.message}</span>
              </div>
            </div>
          )
        }

        // WARN: highlighted line with icon and badge
        if (log.level === "WARN") {
          return (
            <div key={i} className="flex items-start gap-2 py-1.5 px-2 -mx-2 rounded-lg bg-warning/5 border-l-2 border-warning leading-relaxed">
              <div className="flex-shrink-0 mt-0.5">
                <LevelIcon />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground text-xs">{log.timestamp}</span>
                {" "}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">
                  WARN
                </span>
                {" "}
                <span className="text-warning font-medium">{log.message}</span>
              </div>
            </div>
          )
        }

        // ERROR: auto-expanded card with icon
        const isCollapsed = collapsedErrors.has(i)

        return (
          <Card key={i} className="bg-error/5 border-error/20 my-2 shadow-sm shadow-error/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-error blur-sm opacity-20" />
                    <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-error/10 ring-2 ring-error/20">
                      <LevelIcon />
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-medium">{log.timestamp}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-error/10 text-error ring-1 ring-error/20">
                        ERROR
                      </span>
                    </div>
                    {log.details && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleErrorCollapse(i)}
                        className="h-6 px-2 text-xs flex-shrink-0"
                      >
                        {isCollapsed ? (
                          <span className="flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 5L6 8L9 5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Expand
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 7L6 4L9 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Collapse
                          </span>
                        )}
                      </Button>
                    )}
                  </div>

                  <div className="text-sm font-medium text-error">{log.message}</div>

                  {!isCollapsed && log.details && (
                    <div className="mt-4 space-y-3 text-sm animate-in fade-in-50 slide-in-from-top-2 duration-200">
                      {log.details.context && (
                        <div className="rounded-lg border border-border bg-card/50 p-3">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Context</div>
                          <dl className="grid gap-1.5">
                            {Object.entries(log.details.context).map(([key, value]) => (
                              <div key={key} className="flex items-start gap-2">
                                <dt className="text-muted-foreground min-w-[100px] font-medium text-xs">{key}:</dt>
                                <dd className="text-foreground flex-1 font-mono text-xs">{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}

                      {log.details.stackTrace && (
                        <div className="rounded-lg border border-border bg-card/50 p-3">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Stack Trace</div>
                          <pre className="text-xs bg-background/80 p-3 rounded border border-border overflow-x-auto text-foreground leading-relaxed">
                            {log.details.stackTrace}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
