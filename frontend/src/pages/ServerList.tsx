import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgents } from "@/hooks/useAgents"
import { Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

interface ServerWithAgent {
  id: string
  name: string
  status: string
  agentId: string
  agentName: string
  gamePort: number
  udpPort: number
  rconPort: number
  imageTag: string
  createdAt: number
}

export function ServerList() {
  const navigate = useNavigate()
  const { isLoading: agentsLoading } = useAgents()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Fetch servers for each agent and combine them
  const allServers: ServerWithAgent[] = []

  // This is a placeholder - in reality we'd need to fetch servers for each agent
  // For now, showing empty state until global server API is implemented
  // TODO: Implement global server fetching in Phase 4

  // Filter servers
  const filteredServers = allServers.filter(server => {
    const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         server.agentName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || server.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const isLoading = agentsLoading

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
        <Button onClick={() => navigate('/agents')}>
          <Plus className="h-4 w-4" />
          Create Server
        </Button>
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
              <Button onClick={() => navigate('/agents')}>
                <Plus className="h-4 w-4" />
                Create Server
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredServers.map(server => (
            <Card
              key={server.id}
              className="hover:shadow-md transition-all duration-200 cursor-pointer border-l-4"
              style={{
                borderLeftColor: server.status === 'running' ? '#3DDC97' :
                                server.status === 'stopped' ? '#6c757d' : '#F75555'
              }}
              onClick={() => navigate(`/servers/${server.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <StatusBadge
                      variant={
                        server.status === 'running' ? 'success' :
                        server.status === 'stopped' ? 'muted' : 'error'
                      }
                      icon={
                        server.status === 'running' ? 'pulse' :
                        server.status === 'stopped' ? 'dot' : 'cross'
                      }
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
          ))}
        </div>
      )}

      {/* Pagination - TODO: Implement when API supports it */}
      {filteredServers.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {filteredServers.length} server{filteredServers.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
