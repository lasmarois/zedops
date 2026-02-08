import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { CompactAuditLog, type AuditLogEntry } from "@/components/ui/compact-audit-log"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgents } from "@/hooks/useAgents"
import { useAllServers } from "@/hooks/useServers"
import { useUsers } from "@/hooks/useUsers"
import { useAuditLogs } from "@/hooks/useAuditLogs"
import { useUser } from "@/contexts/UserContext"
import { Server as ServerIcon, Laptop, Users, GamepadIcon, RefreshCw, Plus, ShieldAlert } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { getDisplayStatus } from "@/lib/server-status"
import type { Server } from "@/lib/api"

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useUser()
  const isAdmin = user?.role === 'admin'
  const { data: agentsData, isLoading: agentsLoading } = useAgents()
  const { data: serversData, isLoading: serversLoading } = useAllServers()
  const { data: usersData, isLoading: usersLoading } = useUsers()
  const { data: auditLogsData, isLoading: auditLoading } = useAuditLogs({ pageSize: 10 })

  // Calculate stats
  const totalAgents = agentsData?.count || 0
  const onlineAgents = agentsData?.agents.filter(a => a.status === 'online').length || 0
  const offlineAgents = totalAgents - onlineAgents

  // Count total servers across all agents
  const totalServers = serversData?.count || 0
  // Count servers that are actually running (agent must be online)
  const runningServers = serversData?.servers?.filter((s: Server) => {
    const displayStatus = getDisplayStatus(s)
    return displayStatus.status === 'running'
  }).length || 0

  const totalUsers = usersData?.users.length || 0

  // Create lookup map for ID -> name resolution
  const nameLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    if (serversData?.servers) {
      for (const server of serversData.servers) {
        lookup[server.id] = server.name
      }
    }
    if (usersData?.users) {
      for (const user of usersData.users) {
        lookup[user.id] = user.email.split('@')[0]
      }
    }
    if (agentsData?.agents) {
      for (const agent of agentsData.agents) {
        lookup[agent.id] = agent.name
      }
    }
    return lookup
  }, [serversData, usersData, agentsData])

  // Helper to check if a string looks like a UUID
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

  // Convert audit logs to compact entries
  const auditEntries: AuditLogEntry[] = (auditLogsData?.logs || []).slice(0, 5).map(log => {
    const rawDetails = log.details ? JSON.parse(log.details) : {}

    // Find name from details, resolving UUIDs
    const findName = (obj: Record<string, unknown>): string => {
      const nameKeys = ['name', 'servername', 'server_name', 'username', 'user_name', 'agentname', 'agent_name']
      for (const [key, value] of Object.entries(obj)) {
        if (nameKeys.includes(key.toLowerCase()) && typeof value === 'string' && value) {
          if (isUuid(value)) {
            return nameLookup[value] || value
          }
          return value
        }
      }
      return ''
    }

    const targetId = log.target_id || ''
    const targetName = findName(rawDetails) || nameLookup[targetId] || targetId

    // Resolve IDs in details for display
    const resolvedDetails: Record<string, string> = {}
    for (const [key, value] of Object.entries(rawDetails)) {
      if (typeof value === 'string') {
        if (isUuid(value) && nameLookup[value]) {
          resolvedDetails[key] = nameLookup[value]
        } else {
          resolvedDetails[key] = value
        }
      } else if (value !== null && value !== undefined) {
        resolvedDetails[key] = String(value)
      }
    }

    return {
      id: log.id,
      timestamp: formatDistanceToNow(new Date(log.timestamp), { addSuffix: true }),
      user: log.user_email.split('@')[0],
      action: log.action,
      targetType: log.target_type || '',
      targetName: targetName,
      details: {
        'Timestamp': new Date(log.timestamp).toLocaleString(),
        'IP Address': log.ip_address,
        ...resolvedDetails,
      },
    }
  })

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb items={[{ label: "Dashboard" }]} />
          <h1 className="text-3xl font-bold mt-4">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Infrastructure overview and recent activity
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Non-admin empty state */}
      {!isAdmin && !serversLoading && totalServers === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">No servers assigned yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                You don't have access to any servers. Contact your administrator to get server access assigned to your account.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-6`}>
        {/* Agents Card */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agents
            </CardTitle>
            <Laptop className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <Skeleton className="h-9 w-12" />
            ) : (
              <>
                <div className="text-3xl font-bold">{totalAgents}</div>
                <div className="mt-2 space-y-1">
                  <div className={`text-sm ${onlineAgents > 0 ? 'text-success' : 'text-muted-foreground'}`}>{onlineAgents} online</div>
                  <div className="text-sm text-muted-foreground">{offlineAgents} offline</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-4 w-full"
                  onClick={() => navigate('/agents')}
                >
                  View All →
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Servers Card */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Servers
            </CardTitle>
            <ServerIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {serversLoading ? (
              <Skeleton className="h-9 w-12" />
            ) : (
              <>
                <div className="text-3xl font-bold">{totalServers}</div>
                <div className="mt-2 space-y-1">
                  <div className={`text-sm ${runningServers > 0 ? 'text-success' : 'text-muted-foreground'}`}>{runningServers} running</div>
                  <div className="text-sm text-muted-foreground">{totalServers - runningServers} stopped</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-4 w-full"
                  onClick={() => navigate('/servers')}
                >
                  View All →
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Users Card (admin only) */}
        {isAdmin && (
          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <Skeleton className="h-9 w-12" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{totalUsers}</div>
                  <div className="mt-2 space-y-1">
                    <div className="text-sm text-muted-foreground">Manage access</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-4 w-full"
                    onClick={() => navigate('/users')}
                  >
                    View All →
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Players Card */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Players
            </CardTitle>
            <GamepadIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <div className="mt-2 space-y-1">
              <div className="text-sm text-muted-foreground">Across all servers</div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-4 w-full"
              disabled
            >
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Agent Status Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Agent Status</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Quick overview of your infrastructure agents
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/agents')}
          >
            View All →
          </Button>
        </CardHeader>
        <CardContent>
          {agentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : agentsData && agentsData.agents.length > 0 ? (
            <div className="space-y-2">
              {agentsData.agents.slice(0, 5).map(agent => {
                const metrics = agent.metadata?.metrics
                const cpuPercent = metrics?.cpuPercent
                const memPercent = metrics ? (metrics.memoryUsedMB / metrics.memoryTotalMB) * 100 : null
                // Use first disk for compact display, or show volume count
                // Fallback to legacy diskPercent if disks array not available
                const primaryDisk = metrics?.disks?.[0]
                const diskCount = metrics?.disks?.length || 0
                const legacyDiskPercent = metrics?.diskPercent

                return (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/30 transition-all duration-200 cursor-pointer"
                    onClick={() => navigate('/agents')}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <StatusBadge
                          variant={agent.status === 'online' ? 'success' : 'error'}
                          icon={agent.status === 'online' ? 'pulse' : 'cross'}
                          iconOnly
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{agent.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {agent.status === 'online' ? 'Online' : 'Offline'}
                        </div>
                      </div>
                      {agent.status === 'online' && metrics && (
                        <div className="flex gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            CPU: {cpuPercent?.toFixed(1)}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            MEM: {memPercent?.toFixed(1)}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {diskCount > 1
                              ? `DISK: ${diskCount} vols`
                              : diskCount === 1
                              ? `DISK: ${primaryDisk?.percent?.toFixed(1) ?? 'N/A'}%`
                              : legacyDiskPercent !== undefined
                              ? `DISK: ${legacyDiskPercent.toFixed(1)}%`
                              : 'DISK: N/A'
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No agents connected yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Latest system events and actions
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/audit-logs')}
            >
              View All →
            </Button>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="space-y-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : auditEntries.length > 0 ? (
              <CompactAuditLog entries={auditEntries} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <>
                <Button variant="glass-primary" onClick={() => navigate('/agents')}>
                  <Plus className="h-4 w-4" />
                  Create Server
                </Button>
                <Button variant="glass-primary" onClick={() => navigate('/users')}>
                  <Plus className="h-4 w-4" />
                  Invite User
                </Button>
                <Button variant="outline" onClick={() => navigate('/audit-logs')}>
                  View All Logs
                </Button>
              </>
            )}
            <Button variant={isAdmin ? "outline" : "default"} onClick={() => navigate('/servers')}>
              View Servers
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
