import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { LogViewer } from "@/components/LogViewer"
import { RconTerminal } from "@/components/RconTerminal"
import { ConfigurationDisplay } from "@/components/ConfigurationDisplay"
import { ConfigurationEdit } from "@/components/ConfigurationEdit"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useServerById, useStartServer, useStopServer, useRebuildServer, useDeleteServer, useServerMetrics, useUpdateServerConfig, useApplyServerConfig } from "@/hooks/useServers"
import { useRestartContainer } from "@/hooks/useContainers"
import { useLogStream } from "@/hooks/useLogStream"
import { useMoveProgress } from "@/hooks/useMoveProgress"
import { RconHistoryProvider, useRconHistory } from "@/contexts/RconHistoryContext"
import { Clock, Cpu, HardDrive, Users, PlayCircle, StopCircle, RefreshCw, Wrench, Trash2 } from "lucide-react"
import { getDisplayStatus } from "@/lib/server-status"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ErrorDialog } from "@/components/ui/error-dialog"

function ServerDetailContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: serverData, isLoading, error } = useServerById(id || null)

  // Mutation hooks for server actions
  const startServerMutation = useStartServer()
  const stopServerMutation = useStopServer()
  const restartContainerMutation = useRestartContainer()
  const rebuildServerMutation = useRebuildServer()
  const deleteServerMutation = useDeleteServer()
  const updateConfigMutation = useUpdateServerConfig()
  const applyConfigMutation = useApplyServerConfig()

  // Configuration edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<{
    pendingRestart: boolean;
    dataPathChanged: boolean;
    configChanged: boolean;
    oldDataPath?: string; // M9.8.29: Store old path for data migration
  } | null>(null)

  // M9.8.31: Track if data migration is in progress
  const [isMigrating, setIsMigrating] = useState(false)

  // Fetch server metrics (must be called unconditionally - hooks rule)
  const { data: metricsData } = useServerMetrics(
    serverData?.server?.agent_id || null,
    id || null,
    serverData?.server?.status === 'running' // Only fetch when running
  )

  // Fetch log stream for preview (must be called unconditionally - hooks rule)
  const { logs, clearLogs } = useLogStream({
    agentId: serverData?.server?.agent_id || '',
    containerId: serverData?.server?.container_id || '',
    enabled: serverData?.server?.status === 'running' && !!serverData?.server?.container_id
  })

  // M9.8.31: Move progress streaming (enabled only during migration)
  const { progress: moveProgress, reset: resetMoveProgress } = useMoveProgress({
    agentId: serverData?.server?.agent_id || '',
    serverName: serverData?.server?.name || '',
    enabled: isMigrating && !!serverData?.server?.agent_id && !!serverData?.server?.name
  })

  // Log preview controls state
  const [logsPaused, setLogsPaused] = useState(false)
  const [logsAutoScroll, setLogsAutoScroll] = useState(true)

  // Confirmation dialogs state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false)
  const [showApplyConfigConfirm, setShowApplyConfigConfirm] = useState(false)

  // Error dialog state
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // RCON history from context
  const { history: rconHistory } = useRconHistory()

  // Handler functions for button clicks
  const handleStart = () => {
    if (!id) return
    const agentId = serverData?.server?.agent_id
    if (!agentId) return
    startServerMutation.mutate({ agentId, serverId: id })
  }

  const handleStop = () => {
    if (!id) return
    const agentId = serverData?.server?.agent_id
    if (!agentId) return
    stopServerMutation.mutate({ agentId, serverId: id })
  }

  const handleRestart = () => {
    if (!id) return
    const agentId = serverData?.server?.agent_id
    const containerId = serverData?.server?.container_id
    if (!agentId || !containerId) return
    restartContainerMutation.mutate({ agentId, containerId })
  }

  const handleRebuild = () => {
    setShowRebuildConfirm(true)
  }

  const confirmRebuild = () => {
    if (!id) return
    const agentId = serverData?.server?.agent_id
    if (!agentId) return
    rebuildServerMutation.mutate({ agentId, serverId: id })
  }

  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (!id) return
    const agentId = serverData?.server?.agent_id
    if (!agentId) return
    deleteServerMutation.mutate(
      { agentId, serverId: id, removeVolumes: false },
      {
        onSuccess: () => {
          navigate('/servers')
        }
      }
    )
  }

  // M9.8.32: Added image parameter for per-server registry override
  const handleSaveConfig = (config: Record<string, string>, imageTag?: string, serverDataPath?: string | null, image?: string | null) => {
    if (!id) return
    const agentId = serverData?.server?.agent_id
    if (!agentId) return

    updateConfigMutation.mutate(
      { agentId, serverId: id, config, imageTag, serverDataPath, image },
      {
        onSuccess: (data) => {
          setPendingChanges({
            pendingRestart: data.pendingRestart,
            dataPathChanged: data.dataPathChanged,
            configChanged: data.configChanged,
            // M9.8.29: Store old path for data migration when applying
            oldDataPath: data.oldDataPath,
          })
          setIsEditMode(false)
        },
        onError: (error) => {
          setErrorMessage(`Failed to save configuration: ${error.message}`)
        }
      }
    )
  }

  const handleApplyConfig = () => {
    if (!id) return
    const agentId = serverData?.server?.agent_id
    if (!agentId) return
    setShowApplyConfigConfirm(true)
  }

  const confirmApplyConfig = () => {
    if (!id) return
    const agentId = serverData?.server?.agent_id
    if (!agentId) return

    // M9.8.31: Start migration tracking if data path is changing
    if (pendingChanges?.dataPathChanged) {
      setIsMigrating(true)
      resetMoveProgress()
    }

    // M9.8.29: Pass oldDataPath if data path changed (triggers data migration)
    applyConfigMutation.mutate(
      { agentId, serverId: id, oldDataPath: pendingChanges?.oldDataPath },
      {
        onSuccess: () => {
          setPendingChanges(null)
          setIsMigrating(false)
          resetMoveProgress()
        },
        onError: (error) => {
          setIsMigrating(false)
          resetMoveProgress()
          setErrorMessage(`Failed to apply configuration: ${error.message}`)
        }
      }
    )
  }

  const handleCancelEdit = () => {
    if (updateConfigMutation.isPending) return
    setIsEditMode(false)
  }

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

  // Compute display status considering agent connectivity
  const displayStatus = getDisplayStatus(server)

  // Parse config to get RCON password
  const config = server.config ? JSON.parse(server.config) : {}
  const rconPassword = config.RCON_PASSWORD || config.ADMIN_PASSWORD || ''

  // Extract metrics or use placeholders (metrics fetched at top of component)
  const metrics = metricsData?.metrics
  const uptime = metrics?.uptime || "N/A"
  // M9.8.41: Get player count from server data (RCON polling)
  const players = {
    current: serverData?.server?.player_count ?? 0,
    max: serverData?.server?.max_players ?? 32,
    names: serverData?.server?.players ?? [],
  }
  const cpuPercent = metrics?.cpuPercent ? metrics.cpuPercent.toFixed(1) : 0
  const memoryUsedGB = metrics ? (metrics.memoryUsedMB / 1024).toFixed(1) : 0
  const memoryLimitGB = metrics ? (metrics.memoryLimitMB / 1024).toFixed(1) : 0
  const diskReadGB = metrics ? (metrics.diskReadMB / 1024).toFixed(2) : 0
  const diskWriteGB = metrics ? (metrics.diskWriteMB / 1024).toFixed(2) : 0

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
            variant={displayStatus.variant}
            icon={
              displayStatus.status === 'running' ? 'pulse' :
              displayStatus.status === 'starting' ? 'loader' :
              displayStatus.status === 'agent_offline' ? 'cross' :
              displayStatus.status === 'stopped' ? 'dot' : 'cross'
            }
          >
            {displayStatus.label}
          </StatusBadge>
          {status === 'running' && (
            <span className="text-sm text-muted-foreground">
              {players.current}/{players.max} players • Uptime: {uptime}
            </span>
          )}
        </div>

        {/* Segmented Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Primary Actions Group */}
          <div className="flex items-center rounded-xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-lg">
            {status === 'stopped' ? (
              <button
                onClick={handleStart}
                disabled={startServerMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 transition-all duration-200 text-success hover:bg-success/20 hover:shadow-[inset_0_0_20px_rgba(61,220,151,0.2)] disabled:opacity-50"
              >
                <PlayCircle className={`h-4 w-4 ${startServerMutation.isPending ? 'animate-spin' : ''}`} />
                <span className="font-medium">{startServerMutation.isPending ? 'Starting...' : 'Start'}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleStop}
                  disabled={stopServerMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2.5 transition-all duration-200 text-warning hover:bg-warning/20 hover:shadow-[inset_0_0_20px_rgba(255,201,82,0.2)] disabled:opacity-50"
                >
                  <StopCircle className={`h-4 w-4 ${stopServerMutation.isPending ? 'animate-pulse' : ''}`} />
                  <span className="font-medium">{stopServerMutation.isPending ? 'Stopping...' : 'Stop'}</span>
                </button>
                <div className="w-px h-6 bg-white/10" />
                <button
                  onClick={handleRestart}
                  disabled={restartContainerMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2.5 transition-all duration-200 text-info hover:bg-info/20 hover:shadow-[inset_0_0_20px_rgba(51,225,255,0.2)] disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${restartContainerMutation.isPending ? 'animate-spin' : ''}`} />
                  <span className="font-medium">{restartContainerMutation.isPending ? 'Restarting...' : 'Restart'}</span>
                </button>
              </>
            )}
          </div>

          {/* Secondary Actions Group */}
          <div className="flex items-center rounded-xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-lg">
            <button
              onClick={handleRebuild}
              disabled={rebuildServerMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 transition-all duration-200 text-info hover:bg-info/20 hover:shadow-[inset_0_0_20px_rgba(51,225,255,0.2)] disabled:opacity-50"
            >
              <Wrench className={`h-4 w-4 ${rebuildServerMutation.isPending ? 'animate-spin' : ''}`} />
              <span className="font-medium">{rebuildServerMutation.isPending ? 'Rebuilding...' : 'Rebuild'}</span>
            </button>
            <div className="w-px h-6 bg-white/10" />
            <button
              onClick={handleDelete}
              disabled={deleteServerMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 transition-all duration-200 text-destructive hover:bg-destructive/20 hover:shadow-[inset_0_0_20px_rgba(220,38,38,0.2)] disabled:opacity-50"
            >
              <Trash2 className={`h-4 w-4 ${deleteServerMutation.isPending ? 'animate-pulse' : ''}`} />
              <span className="font-medium">{deleteServerMutation.isPending ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
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
            {status !== 'running' && (
              <div className="mb-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                Metrics are only available when the server is running
              </div>
            )}
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
                  {memoryLimitGB && (
                    <div className="text-xs text-muted-foreground">of {memoryLimitGB}GB</div>
                  )}
                </CardContent>
              </Card>

              {/* Disk I/O Card */}
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Disk I/O
                  </CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">↓ {diskReadGB}GB</div>
                  <div className="text-sm font-bold">↑ {diskWriteGB}GB</div>
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
              <h2 className="text-xl font-semibold">LOG PREVIEW</h2>
              <Button variant="outline" size="sm" onClick={() => {
                // Navigate to logs tab
                const tabsList = document.querySelector('[value="logs"]') as HTMLButtonElement
                if (tabsList) tabsList.click()
              }}>
                ▼ Expand View
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                {status !== 'running' ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Server must be running to view logs
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No logs yet. Waiting for container output...
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground space-y-1 font-mono mb-3">
                      {(logsPaused ? logs.slice(-5) : logs.slice(-5)).map((log, index) => {
                        const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        });
                        const streamColor = log.stream === 'stderr' ? 'text-error' : '';
                        return (
                          <div key={`${log.timestamp}-${index}`} className={streamColor}>
                            [{timestamp}] {log.message}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 items-center justify-center pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLogsAutoScroll(!logsAutoScroll)}
                        className="text-xs"
                      >
                        Auto-scroll {logsAutoScroll ? '✓' : ''}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLogsPaused(!logsPaused)}
                        className="text-xs"
                      >
                        {logsPaused ? 'Resume' : 'Pause'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => clearLogs()}
                        className="text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RCON Preview */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">RCON PREVIEW</h2>
              <Button variant="outline" size="sm" onClick={() => {
                const tabsList = document.querySelector('[value="rcon"]') as HTMLButtonElement
                if (tabsList) tabsList.click()
              }}>
                ▼ Expand View
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                {status !== 'running' ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Server must be running to use RCON
                  </div>
                ) : rconHistory.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No RCON commands yet. Open the RCON tab to interact with your server.
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground space-y-2 font-mono mb-3">
                      {rconHistory.slice(-3).map((entry, index) => (
                        <div key={`${entry.timestamp}-${index}`} className="space-y-1">
                          <div className="text-primary">
                            &gt; {entry.command}
                          </div>
                          <div className="pl-4">
                            {entry.response}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 items-center justify-center pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const tabsList = document.querySelector('[value="rcon"]') as HTMLButtonElement
                          if (tabsList) tabsList.click()
                        }}
                        className="text-xs"
                      >
                        History ▲▼
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const tabsList = document.querySelector('[value="rcon"]') as HTMLButtonElement
                          if (tabsList) tabsList.click()
                        }}
                        className="text-xs"
                      >
                        Quick Commands ▼
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleRestart}
                disabled={status !== 'running' || restartContainerMutation.isPending}
              >
                {restartContainerMutation.isPending ? 'Restarting...' : 'Restart Server'}
              </Button>
              <Button variant="outline" disabled>Save World (TODO)</Button>
              <Button variant="outline" disabled>Backup Now</Button>
              <Button variant="outline" disabled>Broadcast Message</Button>
              <Button variant="outline" disabled>View Players</Button>
              <Button
                variant="outline"
                className="text-error hover:text-error"
                onClick={handleStop}
                disabled={stopServerMutation.isPending || status !== 'running'}
              >
                {stopServerMutation.isPending ? 'Stopping...' : 'Emergency Stop'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          {/* M9.8.31: Migration Progress Banner - Slick UI matching app theme */}
          {isMigrating && (
            <div className="rounded-lg border border-[hsl(199,92%,65%,0.3)] bg-card p-4 shadow-[0_0_15px_rgba(51,225,255,0.1)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#33E1FF] animate-pulse" />
                    <strong className="text-foreground">Migrating server data...</strong>
                  </div>
                  <span className="text-sm font-medium" style={{ color: '#33E1FF' }}>
                    {moveProgress?.phase === 'copying' && 'Copying files'}
                    {moveProgress?.phase === 'verifying' && 'Verifying copy'}
                    {moveProgress?.phase === 'cleaning' && 'Cleaning up'}
                    {moveProgress?.phase === 'complete' && 'Complete!'}
                    {!moveProgress && 'Connecting...'}
                  </span>
                </div>
                {/* Progress Bar - Animated gradient */}
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${moveProgress?.percent || 0}%`,
                      background: 'linear-gradient(90deg, #3B82F6 0%, #33E1FF 50%, #3DDC97 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s linear infinite',
                    }}
                  />
                </div>
                {/* Progress Details */}
                {moveProgress && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{moveProgress.percent || 0}%</span>
                    <span>
                      {(moveProgress.filesCopied || 0).toLocaleString()} / {(moveProgress.filesTotal || 0).toLocaleString()} files
                      <span className="mx-2 opacity-50">•</span>
                      {((moveProgress.bytesCopied || 0) / 1024 / 1024).toFixed(1)} / {((moveProgress.bytesTotal || 0) / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                )}
                {moveProgress?.currentFile && (
                  <div className="text-xs text-muted-foreground truncate font-mono opacity-70">
                    → {moveProgress.currentFile}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pending Changes Banner */}
          {pendingChanges && pendingChanges.pendingRestart && !isEditMode && !isMigrating && (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <strong>Configuration changes saved.</strong>
                  {pendingChanges.dataPathChanged && (
                    <span className="ml-2">Data path will be migrated when applied.</span>
                  )}
                  <span className="ml-2">Click "Apply Changes" to restart the server with new configuration.</span>
                </div>
                <Button
                  onClick={handleApplyConfig}
                  disabled={applyConfigMutation.isPending}
                  size="sm"
                >
                  {applyConfigMutation.isPending ? 'Applying...' : 'Apply Changes'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Display or Edit Mode */}
          {isEditMode ? (
            <ConfigurationEdit
              server={server}
              onSave={handleSaveConfig}
              onCancel={handleCancelEdit}
              isSaving={updateConfigMutation.isPending}
            />
          ) : (
            <ConfigurationDisplay
              server={server}
              onEdit={() => setIsEditMode(true)}
            />
          )}
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
          {agentId && containerID ? (
            <RconTerminal
              agentId={agentId}
              serverId={serverId}
              serverName={serverName}
              containerID={containerID}
              rconPort={rconPort}
              rconPassword={rconPassword}
              onClose={() => {}}
              embedded={true}
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

      {/* Delete Server Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Server"
        description={`Delete server "${serverName}"? This will stop and remove the container. Server data will be preserved for 24 hours.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Rebuild Server Confirmation Dialog */}
      <ConfirmDialog
        open={showRebuildConfirm}
        onOpenChange={setShowRebuildConfirm}
        title="Rebuild Server"
        description="Rebuild server? This will pull the latest image and recreate the container. The server will be temporarily unavailable."
        confirmText="Rebuild"
        onConfirm={confirmRebuild}
      />

      {/* Apply Config Confirmation Dialog */}
      <ConfirmDialog
        open={showApplyConfigConfirm}
        onOpenChange={setShowApplyConfigConfirm}
        title="Apply Configuration"
        description={
          pendingChanges?.dataPathChanged
            ? `Apply configuration changes to "${serverName}"? This will restart the server and migrate data to the new path. This may take several minutes depending on data size.`
            : `Apply configuration changes to "${serverName}"? This will restart the server (~30 seconds downtime).`
        }
        confirmText={pendingChanges?.dataPathChanged ? "Apply & Migrate" : "Apply Changes"}
        onConfirm={confirmApplyConfig}
      />

      {/* Error Dialog */}
      <ErrorDialog
        open={!!errorMessage}
        onOpenChange={(open) => !open && setErrorMessage(null)}
        message={errorMessage || ''}
      />
    </div>
  )
}

// Wrapper component with RconHistoryProvider
export function ServerDetail() {
  const { id } = useParams<{ id: string }>()

  if (!id) {
    return <div className="p-8 text-center">Server ID not provided</div>
  }

  return (
    <RconHistoryProvider serverId={id}>
      <ServerDetailContent />
    </RconHistoryProvider>
  )
}
