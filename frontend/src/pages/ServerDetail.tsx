import { useParams, useNavigate } from "react-router-dom"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { LogViewer } from "@/components/LogViewer"
import { RconTerminal } from "@/components/RconTerminal"
import { useServerById } from "@/hooks/useServers"
import { Clock, Cpu, HardDrive, Users, PlayCircle, StopCircle, RefreshCw, Wrench, Trash2 } from "lucide-react"

export function ServerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: serverData, isLoading, error } = useServerById(id || null)

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !serverData?.server) {
    return (
      <div className="p-8 space-y-6">
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold text-error">Server Not Found</h2>
          <p className="text-muted-foreground mt-2">
            The server you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button className="mt-6" onClick={() => navigate('/servers')}>
            Back to Servers
          </Button>
        </div>
      </div>
    )
  }

  // Extract server data from API response
  const server = serverData.server
  const serverId = server.id
  const serverName = server.name
  const agentName = server.agent_name
  const agentId = server.agent_id
  const status = server.status as 'running' | 'stopped' | 'failed'
  const containerID = server.container_id || ''
  const rconPort = server.rcon_port

  // Parse config to get RCON password
  const config = server.config ? JSON.parse(server.config) : {}
  const rconPassword = config.RCON_PASSWORD || config.ADMIN_PASSWORD || ''

  // Placeholder for metrics (TODO: Get from agent metrics)
  const uptime = "N/A" // TODO: Calculate from container start time
  const players = { current: 0, max: 32 } // TODO: Get from RCON
  const cpuPercent = 0 // TODO: Get from agent metrics
  const memoryUsedGB = 0 // TODO: Get from agent metrics
  const diskUsedGB = 0 // TODO: Get from agent metrics

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: "Servers", href: "/servers" },
        { label: serverName }
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{serverName}</h1>
          <span className="text-sm text-muted-foreground">
            on {agentName}
          </span>
          <StatusBadge
            variant={status === 'running' ? 'success' : status === 'stopped' ? 'muted' : 'error'}
            icon={status === 'running' ? 'pulse' : status === 'stopped' ? 'dot' : 'cross'}
          >
            {status === 'running' ? 'Running' : status === 'stopped' ? 'Stopped' : 'Failed'}
          </StatusBadge>
          {status === 'running' && (
            <span className="text-sm text-muted-foreground">
              {players.current}/{players.max} players • Uptime: {uptime}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {status === 'stopped' && (
            <Button variant="success">
              <PlayCircle className="h-4 w-4" />
              Start
            </Button>
          )}
          {status === 'running' && (
            <>
              <Button variant="warning">
                <StopCircle className="h-4 w-4" />
                Stop
              </Button>
              <Button variant="info">
                <RefreshCw className="h-4 w-4" />
                Restart
              </Button>
            </>
          )}
          <Button variant="info">
            <Wrench className="h-4 w-4" />
            Rebuild
          </Button>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="rcon">RCON</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Server Metrics */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Server Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Uptime Card */}
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Uptime
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{uptime}</div>
                </CardContent>
              </Card>

              {/* CPU Card */}
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    CPU
                  </CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cpuPercent}%</div>
                  <div className="text-xs text-success">▲ Normal</div>
                </CardContent>
              </Card>

              {/* Memory Card */}
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Memory
                  </CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{memoryUsedGB}GB</div>
                </CardContent>
              </Card>

              {/* Disk Card */}
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Disk
                  </CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{diskUsedGB}GB</div>
                </CardContent>
              </Card>

              {/* Players Card */}
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Players
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{players.current}/{players.max}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Log Preview */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Log Preview</h2>
              <Button variant="outline" size="sm" onClick={() => {
                // Navigate to logs tab
                const tabsList = document.querySelector('[value="logs"]') as HTMLButtonElement
                if (tabsList) tabsList.click()
              }}>
                Expand View →
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground space-y-1 font-mono">
                  <div>[12:34:56] Server started on port 16261</div>
                  <div>[12:35:02] Player 'John' connected</div>
                  <div className="text-warning">[12:35:45] WARNING: High memory usage</div>
                  <div>[12:36:15] Player 'Sarah' connected</div>
                  <div>[12:37:22] Autosaving world...</div>
                  <div className="text-xs text-center text-muted-foreground pt-2">
                    Last 5 lines • Click "Expand View" for full logs
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RCON Preview */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">RCON Preview</h2>
              <Button variant="outline" size="sm" onClick={() => {
                const tabsList = document.querySelector('[value="rcon"]') as HTMLButtonElement
                if (tabsList) tabsList.click()
              }}>
                Expand View →
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground space-y-2 font-mono">
                  <div>
                    <span className="text-primary">&gt;</span> players
                  </div>
                  <div>Players online (5): John, Sarah, Mike, Alex, Jordan</div>
                  <div className="pt-2">
                    <span className="text-primary">&gt;</span> servermsg Welcome to the server!
                  </div>
                  <div>Message broadcast to all players</div>
                  <div className="text-xs text-center text-muted-foreground pt-2">
                    Click "Expand View" for full RCON terminal
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">Restart Server</Button>
              <Button variant="outline">Save World</Button>
              <Button variant="outline">Backup Now</Button>
              <Button variant="outline">Broadcast Message</Button>
              <Button variant="outline">View Players</Button>
              <Button variant="outline" className="text-error hover:text-error">
                Emergency Stop
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Server Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Docker ENV configuration editor will be available in a future update.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Planned features: Basic settings, network configuration, port management with conflict detection.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Server Logs: {serverName}</h2>
            {agentId && containerID ? (
              <LogViewer
                agentId={agentId}
                containerId={containerID}
                containerName={serverName}
                onBack={() => {}} // Not used in tab context
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    Server must be running to view logs
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* RCON Tab */}
        <TabsContent value="rcon" className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">RCON Console: {serverName}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Players</Button>
                <Button variant="outline" size="sm">Save</Button>
                <Button variant="outline" size="sm">Broadcast Message</Button>
              </div>
            </div>
            {agentId && containerID ? (
              <RconTerminal
                agentId={agentId}
                serverId={serverId}
                serverName={serverName}
                containerID={containerID}
                rconPort={rconPort}
                rconPassword={rconPassword}
                onClose={() => {}} // Not used in tab context
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    Server must be running to use RCON
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Server Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Performance graphs and metrics will be available in a future update.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Planned features: CPU usage (24h), Memory usage (24h), Player count (24h).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backups Tab */}
        <TabsContent value="backups" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Server Backups</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Backup management will be available in a future update.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Planned features: Automatic backups, manual backup creation, backup restore, retention policies.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
