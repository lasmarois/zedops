import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, Save, MessageSquare, Archive, Terminal, Loader2, Check, AlertCircle } from "lucide-react"
import { executeRconCommand } from "@/lib/api"

interface QuickActionsProps {
  isRunning: boolean
  agentId: string
  serverId: string
  onNavigateToRcon: () => void
}

export function QuickActions({
  isRunning,
  agentId,
  serverId,
  onNavigateToRcon,
}: QuickActionsProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSaveWorld = async () => {
    if (!isRunning || saveStatus === 'loading') return

    setSaveStatus('loading')
    setSaveError(null)

    try {
      const result = await executeRconCommand(agentId, serverId, 'save')
      if (result.success) {
        setSaveStatus('success')
        // Reset to idle after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
        setSaveError(result.error || 'Save failed')
        setTimeout(() => setSaveStatus('idle'), 5000)
      }
    } catch (error) {
      setSaveStatus('error')
      setSaveError(error instanceof Error ? error.message : 'Save failed')
      setTimeout(() => setSaveStatus('idle'), 5000)
    }
  }

  const getSaveButtonContent = () => {
    switch (saveStatus) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">Saving...</span>
          </>
        )
      case 'success':
        return (
          <>
            <Check className="h-5 w-5 text-success" />
            <span className="text-xs text-success">Saved!</span>
          </>
        )
      case 'error':
        return (
          <>
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-xs text-destructive">Failed</span>
          </>
        )
      default:
        return (
          <>
            <Save className="h-5 w-5" />
            <span className="text-xs">Save World</span>
          </>
        )
    }
  }

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
          {/* Save World - executes RCON save command directly */}
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            disabled={!isRunning || saveStatus === 'loading'}
            onClick={handleSaveWorld}
            title={saveError || "Save the world now"}
          >
            {getSaveButtonContent()}
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
