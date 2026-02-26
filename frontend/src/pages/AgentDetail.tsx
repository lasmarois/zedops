import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAgents } from "@/hooks/useAgents"
import { HardDrive, Cpu, MemoryStick, Loader2, Trash2, Bell, BellOff } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AgentServerList } from "@/components/AgentServerList"
import { AgentLogViewer } from "@/components/AgentLogViewer"
import {
  fetchAgentConfig, updateAgentConfig, deleteAgent, type AgentConfig,
  fetchAgentNotificationOverrides, setAgentNotificationOverride, removeAgentNotificationOverride,
} from "@/lib/api"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

// Helper to get color based on percentage
function getMetricColor(value: number): string {
  if (value > 80) return '#F75555'
  if (value > 60) return '#FFC952'
  return '#3DDC97'
}

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: agentsData, isLoading } = useAgents()
  const [activeTab, setActiveTab] = useState('overview')

  // Inline config editing state
  const [isEditing, setIsEditing] = useState(false)
  const [serverDataPath, setServerDataPath] = useState('')
  const [steamZomboidRegistry, setSteamZomboidRegistry] = useState('')
  const [hostname, setHostname] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configSuccess, setConfigSuccess] = useState(false)

  // Fetch agent configuration - MUST be before any early returns (React hooks rule)
  const { data: agentConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['agentConfig', id],
    queryFn: () => fetchAgentConfig(id!),
    enabled: !!id && activeTab === 'config', // Fetch when config tab active
  })

  // Update agent configuration mutation - MUST be before any early returns
  const updateConfigMutation = useMutation({
    mutationFn: (config: Partial<AgentConfig>) => updateAgentConfig(id!, config),
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['agentConfig', id] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })

  // Remove agent state
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const removeAgentMutation = useMutation({
    mutationFn: () => deleteAgent(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      navigate('/agents')
    },
  })

  // Notification mute state
  const { data: notifOverrides } = useQuery({
    queryKey: ['notification-overrides'],
    queryFn: fetchAgentNotificationOverrides,
  })

  const setOverrideMutation = useMutation({
    mutationFn: ({ agentId, prefs }: { agentId: string; prefs: { alertOffline: boolean; alertRecovery: boolean } }) =>
      setAgentNotificationOverride(agentId, prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-overrides'] }),
  })

  const removeOverrideMutation = useMutation({
    mutationFn: (agentId: string) => removeAgentNotificationOverride(agentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-overrides'] }),
  })

  const isMuted = id ? notifOverrides?.some(o => o.agentId === id && !o.alertOffline && !o.alertRecovery) ?? false : false

  const toggleMute = () => {
    if (!id) return
    if (isMuted) {
      removeOverrideMutation.mutate(id)
    } else {
      setOverrideMutation.mutate({ agentId: id, prefs: { alertOffline: false, alertRecovery: false } })
    }
  }

  const agent = agentsData?.agents.find(a => a.id === id)

  // Reset edit mode when leaving config tab
  useEffect(() => {
    if (activeTab !== 'config') {
      setIsEditing(false)
      setConfigError(null)
      setConfigSuccess(false)
    }
  }, [activeTab])

  // Handlers for inline config editing
  const handleStartEdit = () => {
    if (agentConfig) {
      setServerDataPath(agentConfig.server_data_path || '')
      setSteamZomboidRegistry(agentConfig.steam_zomboid_registry || '')
      setHostname(agentConfig.hostname || '')
      setConfigError(null)
      setConfigSuccess(false)
    }
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setConfigError(null)
    setConfigSuccess(false)
  }

  const handleSaveConfig = async () => {
    setConfigError(null)
    setConfigSuccess(false)

    // Validation
    if (!serverDataPath) {
      setConfigError('Server data path is required')
      return
    }

    if (!serverDataPath.startsWith('/')) {
      setConfigError('Server data path must be an absolute path (start with /)')
      return
    }

    if (serverDataPath === '/') {
      setConfigError('Cannot use root directory as server data path')
      return
    }

    // Build update payload - only include changed fields
    const updates: Partial<AgentConfig> = {}

    if (serverDataPath !== agentConfig?.server_data_path) {
      updates.server_data_path = serverDataPath
    }

    if (steamZomboidRegistry !== agentConfig?.steam_zomboid_registry) {
      updates.steam_zomboid_registry = steamZomboidRegistry
    }

    const currentHostname = agentConfig?.hostname || ''
    if (hostname !== currentHostname) {
      updates.hostname = hostname.trim() || null
    }

    if (Object.keys(updates).length === 0) {
      setConfigError('No changes to save')
      return
    }

    setIsSaving(true)
    try {
      await updateConfigMutation.mutateAsync(updates)
      setConfigSuccess(true)
      // Exit edit mode after brief delay
      setTimeout(() => {
        setIsEditing(false)
        setConfigSuccess(false)
      }, 1500)
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="p-4 md:p-8">
        <Breadcrumb items={[
          { label: "Agents", href: "/agents" },
          { label: "Not Found" }
        ]} />
        <div className="mt-8 text-center">
          <h1 className="text-2xl font-bold">Agent Not Found</h1>
          <p className="text-muted-foreground mt-2">The agent you're looking for doesn't exist.</p>
          <Button className="mt-6" onClick={() => navigate('/agents')}>
            Back to Agents
          </Button>
        </div>
      </div>
    )
  }

  const metrics = agent.metadata?.metrics
  const cpuPercent = metrics?.cpuPercent
  const memUsedGB = metrics ? (metrics.memoryUsedMB / 1024).toFixed(1) : null
  const memTotalGB = metrics ? (metrics.memoryTotalMB / 1024).toFixed(1) : null
  const memPercent = metrics ? (metrics.memoryUsedMB / metrics.memoryTotalMB) * 100 : null
  const disks = metrics?.disks || []

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: "Agents", href: "/agents" },
        { label: agent.name }
      ]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <h1 className="text-2xl md:text-3xl font-bold">{agent.name}</h1>
          <StatusBadge
            variant={agent.status === 'online' ? 'success' : 'error'}
            icon={agent.status === 'online' ? 'pulse' : 'cross'}
          >
            {agent.status === 'online' ? 'Online' : 'Offline'}
          </StatusBadge>
          {agent.status === 'online' && agent.lastSeen && (
            <span className="text-sm text-muted-foreground">
              Last seen: {new Date(agent.lastSeen * 1000).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-start">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className={isMuted ? 'text-muted-foreground' : ''}
                >
                  {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isMuted ? 'Alerts muted' : 'Alerts enabled'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="glass-destructive"
            onClick={() => setShowRemoveConfirm(true)}
            disabled={removeAgentMutation.isPending}
          >
            {removeAgentMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Remove Agent
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6" onValueChange={setActiveTab}>
        <div className="relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 md:hidden" />
          <TabsList className="overflow-x-auto scrollbar-hide w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="servers">Servers</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Host Metrics */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Host Metrics</h2>

            {/* CPU and Memory Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">CPU Usage</CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {agent.status === 'online' && cpuPercent !== null && cpuPercent !== undefined ? (
                    <>
                      <div className="text-3xl font-bold">{cpuPercent.toFixed(1)}%</div>
                      <div className="mt-4">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${Math.min(cpuPercent, 100)}%`, backgroundColor: getMetricColor(cpuPercent) }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">No data</div>
                  )}
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Memory Usage</CardTitle>
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {agent.status === 'online' && memPercent !== null && memPercent !== undefined ? (
                    <>
                      <div className="text-3xl font-bold">{memPercent.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground mt-1">{memUsedGB}GB / {memTotalGB}GB</div>
                      <div className="mt-4">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${Math.min(memPercent, 100)}%`, backgroundColor: getMetricColor(memPercent) }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">No data</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Storage Table */}
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Storage
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {agent.status === 'online' && disks.length > 0 ? (
                  <>
                    {/* Desktop: table */}
                    <div className="hidden md:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left text-xs font-medium text-muted-foreground p-3">Mount</th>
                            <th className="text-right text-xs font-medium text-muted-foreground p-3">Used</th>
                            <th className="text-right text-xs font-medium text-muted-foreground p-3">Total</th>
                            <th className="text-left text-xs font-medium text-muted-foreground p-3 w-48">Usage</th>
                            <th className="text-right text-xs font-medium text-muted-foreground p-3">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {disks.map((disk, index) => (
                            <tr key={index} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="p-3 text-sm font-medium truncate max-w-[200px]" title={disk.path}>{disk.label || disk.path}</td>
                              <td className="p-3 text-sm text-right text-muted-foreground">{disk.usedGB} GB</td>
                              <td className="p-3 text-sm text-right text-muted-foreground">{disk.totalGB} GB</td>
                              <td className="p-3">
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${Math.min(disk.percent, 100)}%`, backgroundColor: getMetricColor(disk.percent) }} />
                                </div>
                              </td>
                              <td className="p-3 text-sm text-right font-semibold" style={{ color: getMetricColor(disk.percent) }}>{disk.percent.toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: cards */}
                    <div className="md:hidden space-y-3 p-3">
                      {disks.map((disk, i) => (
                        <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium truncate flex-1 mr-2 text-sm">{disk.label || disk.path}</span>
                            <span className="text-sm font-semibold" style={{ color: getMetricColor(disk.percent) }}>{disk.percent.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(disk.percent, 100)}%`, backgroundColor: getMetricColor(disk.percent) }} />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{disk.usedGB} GB used</span>
                            <span>{disk.totalGB} GB total</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Servers on This Agent */}
          <div>
            {/* Embed AgentServerList for this agent */}
            <AgentServerList
              agentId={agent.id}
              agentName={agent.name}
              onBack={() => navigate('/agents')}
              onViewLogs={() => {}} // Not used in this context
            />
          </div>
        </TabsContent>

        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">All Servers</h2>
            <AgentServerList
              agentId={agent.id}
              agentName={agent.name}
              onBack={() => navigate('/agents')}
              onViewLogs={() => {}} // Not used in this context
            />
          </div>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Server Settings</CardTitle>
                {!isEditing ? (
                  <Button
                    variant="glass-info"
                    onClick={handleStartEdit}
                    disabled={agent.status !== 'online' || isLoadingConfig}
                  >
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="glass-muted"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="glass-success"
                      onClick={handleSaveConfig}
                      disabled={isSaving || configSuccess}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingConfig ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : agentConfig ? (
                <>
                  {/* Server Data Path */}
                  <div className="space-y-2">
                    <Label htmlFor="serverDataPath" className="text-sm font-medium">Server Data Path</Label>
                    {isEditing ? (
                      <Input
                        id="serverDataPath"
                        type="text"
                        value={serverDataPath}
                        onChange={(e) => setServerDataPath(e.target.value)}
                        placeholder="/var/lib/zedops/servers"
                        disabled={isSaving}
                      />
                    ) : (
                      <div className="p-3 bg-muted rounded-md font-mono text-sm">
                        {agentConfig.server_data_path}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Host directory where server data (bin, saves) will be stored.
                    </p>
                    {isEditing && (
                      <p className="text-xs text-warning">
                        Changing this path does not move existing server data. You must manually migrate data if needed.
                      </p>
                    )}
                  </div>

                  {/* Docker Registry */}
                  <div className="space-y-2">
                    <Label htmlFor="steamZomboidRegistry" className="text-sm font-medium">Docker Registry</Label>
                    {isEditing ? (
                      <Input
                        id="steamZomboidRegistry"
                        type="text"
                        value={steamZomboidRegistry}
                        onChange={(e) => setSteamZomboidRegistry(e.target.value)}
                        placeholder="registry.gitlab.nicomarois.com/nicolas/steam-zomboid"
                        disabled={isSaving}
                      />
                    ) : (
                      <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
                        {agentConfig.steam_zomboid_registry}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Docker registry URL for the Steam Zomboid server image.
                    </p>
                  </div>

                  {/* Hostname */}
                  <div className="space-y-2">
                    <Label htmlFor="hostname" className="text-sm font-medium">Hostname (Optional)</Label>
                    {isEditing ? (
                      <Input
                        id="hostname"
                        type="text"
                        value={hostname}
                        onChange={(e) => setHostname(e.target.value)}
                        placeholder="myserver.duckdns.org"
                        disabled={isSaving}
                      />
                    ) : (
                      <div className="p-3 bg-muted rounded-md font-mono text-sm">
                        {agentConfig.hostname || <span className="text-muted-foreground italic">Not set (using auto-detected IP)</span>}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Custom hostname for server connections. If set, this will be displayed instead of the auto-detected IP.
                      Useful for dynamic DNS services like DuckDNS.
                    </p>
                  </div>

                  {/* Error Alert */}
                  {configError && (
                    <Alert variant="destructive">
                      <AlertDescription>{configError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Success Alert */}
                  {configSuccess && (
                    <Alert className="border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
                      <AlertDescription>Configuration saved successfully!</AlertDescription>
                    </Alert>
                  )}

                  {/* Info Banner */}
                  {!isEditing && (
                    <Alert>
                      <AlertDescription>
                        These settings are inherited by new servers created on this agent.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    Failed to load agent configuration. Please try refreshing the page.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab - M9.8.33 */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <AgentLogViewer agentId={id!} agentName={agent.name} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={showRemoveConfirm}
        onOpenChange={setShowRemoveConfirm}
        title="Remove Agent"
        description={`Are you sure you want to remove "${agent.name}"? This will permanently delete the agent and all associated servers and backups. This action cannot be undone.`}
        confirmText="Remove Agent"
        variant="destructive"
        onConfirm={() => removeAgentMutation.mutate()}
      />
    </div>
  )
}
