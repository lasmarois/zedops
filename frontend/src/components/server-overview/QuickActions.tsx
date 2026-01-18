import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, Save, MessageSquare, Archive, Terminal } from "lucide-react"

interface QuickActionsProps {
  isRunning: boolean
  onNavigateToRcon: () => void
}

export function QuickActions({
  isRunning,
  onNavigateToRcon,
}: QuickActionsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {/* Save World - navigates to RCON with hint */}
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            disabled={!isRunning}
            onClick={onNavigateToRcon}
            title="Open RCON and run 'save' command"
          >
            <Save className="h-5 w-5" />
            <span className="text-xs">Save World</span>
          </Button>

          {/* Broadcast Message - navigates to RCON */}
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            disabled={!isRunning}
            onClick={onNavigateToRcon}
            title="Open RCON to broadcast a message"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs">Broadcast</span>
          </Button>

          {/* Backup Now - placeholder */}
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1 opacity-50"
            disabled
            title="Coming soon"
          >
            <Archive className="h-5 w-5" />
            <span className="text-xs">Backup Now</span>
          </Button>

          {/* Open RCON Console */}
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            disabled={!isRunning}
            onClick={onNavigateToRcon}
          >
            <Terminal className="h-5 w-5" />
            <span className="text-xs">RCON Console</span>
          </Button>
        </div>

        {!isRunning && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Start the server to use quick actions
          </p>
        )}
      </CardContent>
    </Card>
  )
}
