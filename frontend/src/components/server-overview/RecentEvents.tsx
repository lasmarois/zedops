import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CompactAuditLog, type AuditLogEntry } from "@/components/ui/compact-audit-log"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuditLogs } from "@/hooks/useAuditLogs"
import { History } from "lucide-react"

interface RecentEventsProps {
  serverId: string
  serverName: string
}

export function RecentEvents({ serverId, serverName }: RecentEventsProps) {
  // Fetch recent audit logs (we'll filter client-side by server)
  const { data, isLoading, error } = useAuditLogs({
    pageSize: 50, // Fetch more to filter down to server-specific events
  })

  // Filter logs that relate to this server
  const serverEvents = data?.logs.filter(log => {
    // Match by target_id (exact server ID match)
    if (log.target_id === serverId) return true
    // Match by details containing server ID or name
    if (log.details) {
      const detailsStr = typeof log.details === 'string' ? log.details : JSON.stringify(log.details)
      if (detailsStr.includes(serverId) || detailsStr.toLowerCase().includes(serverName.toLowerCase())) {
        return true
      }
    }
    return false
  }) || []

  // Take only the most recent 10 events
  const recentEvents = serverEvents.slice(0, 10)

  // Transform to AuditLogEntry format (same as Dashboard)
  const entries: AuditLogEntry[] = recentEvents.map(log => {
    const timestamp = new Date(log.timestamp)
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    let timeAgo: string
    if (diffMins < 1) {
      timeAgo = 'now'
    } else if (diffMins < 60) {
      timeAgo = `${diffMins}m ago`
    } else if (diffHours < 24) {
      timeAgo = `${diffHours}h ago`
    } else {
      timeAgo = `${diffDays}d ago`
    }

    // Parse details if it's a JSON string
    let parsedDetails: Record<string, string> | undefined
    if (log.details) {
      try {
        const parsed = typeof log.details === 'string' ? JSON.parse(log.details) : log.details
        if (typeof parsed === 'object' && parsed !== null) {
          parsedDetails = Object.fromEntries(
            Object.entries(parsed).map(([k, v]) => [k, String(v)])
          )
        }
      } catch {
        parsedDetails = { Details: String(log.details) }
      }
    }

    return {
      id: log.id,
      timestamp: timeAgo,
      user: log.user_email?.split('@')[0] || 'system',
      action: log.action,
      targetType: log.target_type || 'server',
      targetName: serverName,
      details: parsedDetails,
    }
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          Recent Activity
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Latest events for this server
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive text-center py-4">
            Failed to load activity
          </p>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent activity for this server
          </div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto">
            <CompactAuditLog entries={entries} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
