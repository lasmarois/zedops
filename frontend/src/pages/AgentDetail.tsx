import { useParams, useNavigate } from "react-router-dom"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgents } from "@/hooks/useAgents"
import { Laptop, Server, HardDrive, Plus } from "lucide-react"
import { ContainerList } from "@/components/ContainerList"

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: agentsData, isLoading } = useAgents()

  const agent = agentsData?.agents.find(a => a.id === id)

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="p-8">
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
  const diskUsedGB = metrics?.diskUsedGB
  const diskTotalGB = metrics?.diskTotalGB
  const diskPercent = metrics?.diskPercent

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: "Agents", href: "/agents" },
        { label: agent.name }
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{agent.name}</h1>
          <StatusBadge
            variant={agent.status === 'online' ? 'success' : 'error'}
            icon={agent.status === 'online' ? 'pulse' : 'cross'}
          >
            {agent.status === 'online' ? 'Online' : 'Offline'}
          </StatusBadge>
          {agent.status === 'online' && agent.lastSeen && (
            <span className="text-sm text-muted-foreground">
              Last seen: {new Date(agent.lastSeen).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" disabled={agent.status !== 'online'}>
            Configure
          </Button>
          <Button variant="outline" className="text-error hover:text-error">
            Disconnect
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Host Metrics */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Host Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CPU Card */}
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    CPU Usage
                  </CardTitle>
                  <Laptop className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {agent.status === 'online' && cpuPercent !== null && cpuPercent !== undefined ? (
                    <>
                      <div className="text-3xl font-bold">{cpuPercent.toFixed(1)}%</div>
                      <div className="mt-4">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(cpuPercent, 100)}%`,
                              backgroundColor: cpuPercent > 80 ? '#F75555' : cpuPercent > 60 ? '#FFC952' : '#3DDC97'
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">No data</div>
                  )}
                </CardContent>
              </Card>

              {/* Memory Card */}
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Memory Usage
                  </CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {agent.status === 'online' && memPercent !== null && memPercent !== undefined ? (
                    <>
                      <div className="text-3xl font-bold">{memPercent.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {memUsedGB}GB / {memTotalGB}GB
                      </div>
                      <div className="mt-4">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(memPercent, 100)}%`,
                              backgroundColor: memPercent > 80 ? '#F75555' : memPercent > 60 ? '#FFC952' : '#3DDC97'
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">No data</div>
                  )}
                </CardContent>
              </Card>

              {/* Disk Card */}
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Disk Usage
                  </CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {agent.status === 'online' && diskPercent !== null && diskPercent !== undefined ? (
                    <>
                      <div className="text-3xl font-bold">{diskPercent.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {diskUsedGB?.toFixed(0)}GB / {diskTotalGB?.toFixed(0)}GB
                      </div>
                      <div className="mt-4">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(diskPercent, 100)}%`,
                              backgroundColor: diskPercent > 80 ? '#F75555' : diskPercent > 60 ? '#FFC952' : '#3DDC97'
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">No data</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Servers on This Agent */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Servers on This Agent</h2>
              <Button onClick={() => navigate('/agents')}>
                <Plus className="h-4 w-4" />
                Create Server
              </Button>
            </div>

            {/* Embed ContainerList for this agent */}
            <ContainerList
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
            <ContainerList
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
              <CardTitle>Agent Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Agent configuration settings will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
