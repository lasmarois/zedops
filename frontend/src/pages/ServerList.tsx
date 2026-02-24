import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllServers, usePurgeServer, useRestoreServer, useCreateServer } from "@/hooks/useServers"
import { useAgents } from "@/hooks/useAgents"
import { Plus, Search, Trash2, ChevronDown, ChevronUp, RefreshCw, ShieldAlert } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Server, CreateServerRequest } from "@/lib/api"
import { ServerCard } from "@/components/ServerCard"
import { ServerCardLayoutToggle } from "@/components/ServerCardLayoutToggle"
import { useServerCardLayout } from "@/contexts/ServerCardLayoutContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ServerForm } from "@/components/ServerForm"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUser } from "@/contexts/UserContext"

interface ServerWithAgent {
  id: string
  name: string
  status: string
  health?: string
  agentId: string
  agentName: string
  agentStatus: 'online' | 'offline'
  agentServerDataPath: string | null
  gamePort: number
  udpPort: number
  rconPort: number
  imageTag: string
  createdAt: number
  containerId: string | null
  config: string
  serverDataPath: string | null
  dataExists: boolean
  deletedAt: number | null
  updatedAt: number
  // M9.8.41: Player stats
  playerCount: number | null
  maxPlayers: number | null
  players: string[] | null
  // Goal #21: INI mod data
  iniMods: string | null
  iniWorkshopItems: string | null
}

export function ServerList() {
  const navigate = useNavigate()
  const { user } = useUser()
  const isAdmin = user?.role === 'admin'
  const { data: serversData, isLoading } = useAllServers()
  const { data: agentsData } = useAgents()
  const { layout } = useServerCardLayout()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showDeletedServers, setShowDeletedServers] = useState(false)
  const purgeServerMutation = usePurgeServer()
  const restoreServerMutation = useRestoreServer()
  const createServerMutation = useCreateServer()

  // Modal state for server creation
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // Confirmation dialog state
  const [confirmPurge, setConfirmPurge] = useState<ServerWithAgent | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<ServerWithAgent | null>(null)

  // Map API data to component format
  const allServers: ServerWithAgent[] = serversData?.servers?.map((server: Server) => ({
    id: server.id,
    name: server.name,
    status: server.status,
    health: server.health,
    agentId: server.agent_id,
    agentName: server.agent_name,
    agentStatus: server.agent_status,
    agentServerDataPath: server.agent_server_data_path,
    gamePort: server.game_port,
    udpPort: server.udp_port,
    rconPort: server.rcon_port,
    imageTag: server.image_tag,
    createdAt: server.created_at,
    containerId: server.container_id,
    config: server.config,
    serverDataPath: server.server_data_path,
    dataExists: server.data_exists,
    deletedAt: server.deleted_at,
    updatedAt: server.updated_at,
    // M9.8.41: Player stats
    playerCount: server.player_count,
    maxPlayers: server.max_players,
    players: server.players,
    // Goal #21: INI mod data
    iniMods: server.ini_mods,
    iniWorkshopItems: server.ini_workshop_items,
  })) || []

  // Separate active and deleted servers
  const activeServers = allServers.filter(server => server.status !== 'deleted')
  const deletedServers = allServers.filter(server => server.status === 'deleted')

  // Filter active servers
  const filteredServers = activeServers.filter(server => {
    const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         server.agentName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || server.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Handler for purging deleted servers - opens dialog
  const handlePurge = (server: ServerWithAgent) => {
    setConfirmPurge(server)
  }

  // Confirm purge action
  const confirmPurgeServer = (removeData: boolean) => {
    const server = confirmPurge
    if (!server) return

    // Close dialog immediately
    setConfirmPurge(null)

    purgeServerMutation.mutate({
      agentId: server.agentId,
      serverId: server.id,
      removeData: removeData,
    })
  }

  // Handler for restoring deleted servers - opens dialog
  const handleRestore = (server: ServerWithAgent) => {
    setConfirmRestore(server)
  }

  // Confirm restore action
  const confirmRestoreServer = () => {
    const server = confirmRestore
    if (!server) return

    // Close dialog immediately
    setConfirmRestore(null)

    restoreServerMutation.mutate({
      agentId: server.agentId,
      serverId: server.id,
    })
  }

  // Handler for agent selection from dropdown
  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId)
    setIsModalOpen(true)
  }

  // Handler for form submission
  const handleCreateServer = (request: CreateServerRequest) => {
    if (!selectedAgentId) return

    createServerMutation.mutate(
      { agentId: selectedAgentId, request },
      {
        onSuccess: () => {
          setIsModalOpen(false)
          setSelectedAgentId(null)
        },
      }
    )
  }

  // Handler for modal cancel
  const handleModalCancel = () => {
    setIsModalOpen(false)
    setSelectedAgentId(null)
  }

  // Get agents list
  const agents = agentsData?.agents || []
  const onlineAgents = agents.filter(agent => agent.status === 'online')
  const hasAgents = agents.length > 0
  const hasOnlineAgents = onlineAgents.length > 0

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "Servers" }]} />
          <h1 className="text-2xl md:text-3xl font-bold mt-4">All Servers</h1>
          <p className="text-muted-foreground mt-2">
            Global server list across all agents
          </p>
        </div>
        {hasAgents ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="glass-primary">
                <Plus className="h-4 w-4" />
                Create Server
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Select Agent</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hasOnlineAgents ? (
                agents.map(agent => (
                  <DropdownMenuItem
                    key={agent.id}
                    disabled={agent.status !== 'online'}
                    onClick={() => agent.status === 'online' && handleAgentSelect(agent.id)}
                    className="flex flex-col items-start py-3"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className={`h-2 w-2 rounded-full ${agent.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-medium">{agent.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-4">
                      {agent.status === 'online' ? 'Ready' : 'Offline - cannot create servers'}
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  All agents are offline
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="glass-primary" onClick={() => navigate('/agents')}>
            <Plus className="h-4 w-4" />
            Add Agent First
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search servers or agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-4 rounded-lg border border-border bg-background text-sm"
        >
          <option value="all">All Status</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="failed">Failed</option>
        </select>
        <ServerCardLayoutToggle />
      </div>

      {/* Server List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredServers.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              {!isAdmin && activeServers.length === 0 ? (
                <>
                  <ShieldAlert className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">No servers assigned</p>
                  <p className="text-sm">
                    You don't have access to any servers yet. Contact your administrator to get access.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium mb-2">No servers found</p>
                  <p className="text-sm mb-6">
                    {searchQuery || statusFilter !== "all"
                      ? "No servers match your filters"
                      : "Create your first server to get started"}
                  </p>
                  {!searchQuery && statusFilter === "all" && isAdmin && (
                    hasAgents ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="glass-primary">
                            <Plus className="h-4 w-4" />
                            Create Server
                            <ChevronDown className="h-4 w-4 ml-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-64">
                          <DropdownMenuLabel>Select Agent</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {hasOnlineAgents ? (
                            agents.map(agent => (
                              <DropdownMenuItem
                                key={agent.id}
                                disabled={agent.status !== 'online'}
                                onClick={() => agent.status === 'online' && handleAgentSelect(agent.id)}
                                className="flex flex-col items-start py-3"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <div className={`h-2 w-2 rounded-full ${agent.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                                  <span className="font-medium">{agent.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground ml-4">
                                  {agent.status === 'online' ? 'Ready' : 'Offline - cannot create servers'}
                                </span>
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                              All agents are offline
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button variant="glass-primary" onClick={() => navigate('/agents')}>
                        <Plus className="h-4 w-4" />
                        Add Agent First
                      </Button>
                    )
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredServers.map(server => {
            // Convert ServerWithAgent to Server format for ServerCard
            const serverData: Server = {
              id: server.id,
              name: server.name,
              status: server.status as Server['status'],
              health: server.health,
              agent_id: server.agentId,
              agent_name: server.agentName,
              agent_status: server.agentStatus,
              agent_server_data_path: server.agentServerDataPath,
              steam_zomboid_registry: null,
              game_port: server.gamePort,
              udp_port: server.udpPort,
              rcon_port: server.rconPort,
              image: null,
              image_tag: server.imageTag,
              created_at: server.createdAt,
              container_id: server.containerId,
              config: server.config,
              server_data_path: server.serverDataPath,
              data_exists: server.dataExists,
              ini_mods: server.iniMods,
              ini_workshop_items: server.iniWorkshopItems,
              deleted_at: server.deletedAt,
              updated_at: server.updatedAt,
              // M9.8.41: Player stats
              player_count: server.playerCount,
              max_players: server.maxPlayers,
              players: server.players,
            };

            return (
              <ServerCard
                key={server.id}
                server={serverData}
                layout={layout}
                showAgent={true}
              />
            );
          })}
        </div>
      )}

      {/* Pagination - TODO: Implement when API supports it */}
      {filteredServers.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {filteredServers.length} active server{filteredServers.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Deleted Servers Section */}
      {deletedServers.length > 0 && (
        <div className="pt-8 border-t border-border">
          <div
            className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowDeletedServers(!showDeletedServers)}
          >
            <div>
              <h2 className="text-2xl font-bold">Deleted Servers</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {deletedServers.length} server{deletedServers.length !== 1 ? 's' : ''} pending purge (data preserved for 24h)
              </p>
            </div>
            <Button variant="ghost" size="sm">
              {showDeletedServers ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>

          {showDeletedServers && (
            <div className="space-y-3 mt-6">
              {deletedServers.map(server => (
                <Card
                  key={server.id}
                  className="border-l-4 border-l-muted-foreground bg-muted/20"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <StatusBadge variant="muted" icon="cross" iconOnly />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-lg truncate text-muted-foreground">
                            {server.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Agent: {server.agentName} | Tag: {server.imageTag}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 items-center flex-shrink-0">
                        <div className="text-sm text-muted-foreground flex gap-4">
                          <div>
                            <span className="font-medium">Game:</span> {server.gamePort}
                          </div>
                          <div>
                            <span className="font-medium">UDP:</span> {server.udpPort}
                          </div>
                          <div>
                            <span className="font-medium">RCON:</span> {server.rconPort}
                          </div>
                        </div>
                        <Button
                          variant="glass-success"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestore(server)
                          }}
                          disabled={restoreServerMutation.isPending && restoreServerMutation.variables?.serverId === server.id}
                        >
                          <RefreshCw className="h-4 w-4" />
                          {restoreServerMutation.isPending && restoreServerMutation.variables?.serverId === server.id ? 'Restoring...' : 'Restore'}
                        </Button>
                        <Button
                          variant="glass-destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePurge(server)
                          }}
                          disabled={purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          {purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id ? 'Purging...' : 'Purge'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Server Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedAgentId && (
            <ServerForm
              agentId={selectedAgentId}
              onSubmit={handleCreateServer}
              onCancel={handleModalCancel}
              isSubmitting={createServerMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Purge Confirmation Dialog */}
      <Dialog open={!!confirmPurge} onOpenChange={(open) => !open && setConfirmPurge(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl">Permanently Delete Server?</DialogTitle>
            <DialogDescription className="pt-2">
              <span className="font-semibold text-foreground">{confirmPurge?.name}</span> will be permanently removed from the database.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={() => confirmPurgeServer(false)}
              disabled={purgeServerMutation.isPending}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">Keep server data on disk</span>
                <span className="text-xs text-muted-foreground">Remove record only, preserve saves & configs</span>
              </div>
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={() => confirmPurgeServer(true)}
              disabled={purgeServerMutation.isPending}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{purgeServerMutation.isPending ? 'Purging...' : 'Delete everything'}</span>
                <span className="text-xs text-destructive-foreground/70">Remove record AND all server data</span>
              </div>
            </Button>
          </div>
          <DialogFooter className="mt-4 sm:justify-center">
            <Button variant="ghost" onClick={() => setConfirmPurge(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmRestore}
        onOpenChange={(open) => !open && setConfirmRestore(null)}
        title="Restore Server"
        description={`Restore server "${confirmRestore?.name}"? This will restore the server from deleted status. The container will need to be started manually after restore.`}
        confirmText="Restore"
        onConfirm={confirmRestoreServer}
      />
    </div>
  )
}
