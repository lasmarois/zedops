import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllServers, usePurgeServer, useRestoreServer, useCreateServer } from "@/hooks/useServers"
import { useAgents } from "@/hooks/useAgents"
import { Plus, Search, Trash2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getDisplayStatus } from "@/lib/server-status"
import type { Server, CreateServerRequest } from "@/lib/api"
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
} from "@/components/ui/dialog"
import { ServerForm } from "@/components/ServerForm"

interface ServerWithAgent {
  id: string
  name: string
  status: string
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
}

export function ServerList() {
  const navigate = useNavigate()
  const { data: serversData, isLoading } = useAllServers()
  const { data: agentsData } = useAgents()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showDeletedServers, setShowDeletedServers] = useState(false)
  const purgeServerMutation = usePurgeServer()
  const restoreServerMutation = useRestoreServer()
  const createServerMutation = useCreateServer()

  // Modal state for server creation
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // Map API data to component format
  const allServers: ServerWithAgent[] = serversData?.servers?.map((server: Server) => ({
    id: server.id,
    name: server.name,
    status: server.status,
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

  // Handler for purging deleted servers
  const handlePurge = (server: ServerWithAgent) => {
    const removeData = confirm(
      `Permanently purge server "${server.name}"?\n\n` +
      `This will remove the server record and container.\n\n` +
      `⚠️ Click OK to also DELETE SERVER DATA (saves, mods, configs)\n` +
      `Click Cancel to keep the data on disk`
    )

    if (removeData !== null) { // User didn't cancel first prompt
      const finalConfirm = confirm(
        removeData
          ? `⚠️ FINAL WARNING: Delete "${server.name}" AND all its data? This cannot be undone!`
          : `Purge "${server.name}" record but keep data on disk?`
      )

      if (finalConfirm) {
        purgeServerMutation.mutate({
          agentId: server.agentId,
          serverId: server.id,
          removeData: removeData,
        })
      }
    }
  }

  // Handler for restoring deleted servers (M9.8.24)
  const handleRestore = (server: ServerWithAgent) => {
    const confirmed = confirm(
      `Restore server "${server.name}"?\n\n` +
      `This will restore the server from deleted status.\n` +
      `The container will need to be started manually after restore.`
    )

    if (confirmed) {
      restoreServerMutation.mutate({
        agentId: server.agentId,
        serverId: server.id,
      })
    }
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
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb items={[{ label: "Servers" }]} />
          <h1 className="text-3xl font-bold mt-4">All Servers</h1>
          <p className="text-muted-foreground mt-2">
            Global server list across all agents
          </p>
        </div>
        {hasAgents ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
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
          <Button onClick={() => navigate('/agents')}>
            <Plus className="h-4 w-4" />
            Add Agent First
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
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
              <p className="text-lg font-medium mb-2">No servers found</p>
              <p className="text-sm mb-6">
                Create your first server to get started
              </p>
              {hasAgents ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
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
                <Button onClick={() => navigate('/agents')}>
                  <Plus className="h-4 w-4" />
                  Add Agent First
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredServers.map(server => {
            // Compute display status based on agent connectivity
            // Note: We don't have all Server fields in ServerWithAgent, but getDisplayStatus
            // only needs agent_status and status fields
            const displayStatus = getDisplayStatus({
              id: server.id,
              name: server.name,
              status: server.status as any,
              agent_id: server.agentId,
              agent_name: server.agentName,
              agent_status: server.agentStatus,
              agent_server_data_path: server.agentServerDataPath,
              steam_zomboid_registry: null, // M9.8.32: Not needed for display status
              game_port: server.gamePort,
              udp_port: server.udpPort,
              rcon_port: server.rconPort,
              image: null, // M9.8.32: Not needed for display status
              image_tag: server.imageTag,
              created_at: server.createdAt,
              container_id: server.containerId,
              config: server.config,
              server_data_path: server.serverDataPath,
              data_exists: server.dataExists,
              deleted_at: server.deletedAt,
              updated_at: server.updatedAt,
            });

            // Border color based on display status
            const borderColor =
              displayStatus.variant === 'success' ? '#3DDC97' :
              displayStatus.variant === 'warning' ? '#FFA500' :
              displayStatus.variant === 'error' ? '#F75555' : '#6c757d';

            // Icon based on display status
            const icon =
              displayStatus.status === 'running' ? 'pulse' :
              displayStatus.status === 'agent_offline' ? 'cross' :
              displayStatus.status === 'stopped' ? 'dot' : 'cross';

            return (
            <Card
              key={server.id}
              className="hover:shadow-md transition-all duration-200 cursor-pointer border-l-4"
              style={{ borderLeftColor: borderColor }}
              onClick={() => navigate(`/servers/${server.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <StatusBadge
                      variant={displayStatus.variant}
                      icon={icon}
                      iconOnly
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-lg truncate">{server.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Agent: {server.agentName} | Tag: {server.imageTag}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground flex-shrink-0">
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
                </div>
              </CardContent>
            </Card>
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
                          variant="success"
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
                          variant="destructive"
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
    </div>
  )
}
