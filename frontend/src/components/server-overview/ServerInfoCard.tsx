import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Server, Map, Package, FolderOpen } from "lucide-react"

interface ServerInfoCardProps {
  imageTag: string | null
  config: Record<string, string>
  serverDataPath: string | null
  agentDefaultDataPath: string | null
}

export function ServerInfoCard({
  imageTag,
  config,
  serverDataPath,
  agentDefaultDataPath,
}: ServerInfoCardProps) {
  // Parse config for display
  const mapName = config.MAP || "Muldraugh, KY"
  const modsCount = config.SERVER_MODS
    ? config.SERVER_MODS.split(';').filter(Boolean).length
    : 0
  const workshopCount = config.SERVER_WORKSHOP_ITEMS
    ? config.SERVER_WORKSHOP_ITEMS.split(';').filter(Boolean).length
    : 0

  // Use server-specific path or fall back to agent default
  const dataPath = serverDataPath || agentDefaultDataPath || "/data"

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Server className="h-4 w-4" />
          Server Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Image/Version */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Version</span>
          <span className="text-sm font-medium font-mono">
            {imageTag || "latest"}
          </span>
        </div>

        {/* Map */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Map className="h-3.5 w-3.5" />
            Map
          </span>
          <span className="text-sm font-medium">
            {mapName}
          </span>
        </div>

        {/* Mods */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Mods
          </span>
          <span className="text-sm font-medium">
            {modsCount > 0 ? `${modsCount} mod${modsCount > 1 ? 's' : ''}` : "None"}
            {workshopCount > 0 && ` + ${workshopCount} workshop`}
          </span>
        </div>

        {/* Data Path */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
            <FolderOpen className="h-3.5 w-3.5" />
            Data
          </span>
          <span className="text-sm font-medium font-mono text-right truncate" title={dataPath}>
            {dataPath}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
